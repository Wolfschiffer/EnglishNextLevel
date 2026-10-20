const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const PROJECT_ID = 'demo-english-next-level';
const RUN_RULES_VERSION = 2;
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001';
const RUN_START_WINDOW_MS = 10 * 60 * 1000;
const MAX_RUN_STARTS_PER_WINDOW = 10;

function requireLoopbackHost(host, port, serviceName) {
    const url = new URL(`http://${host}`);
    assert.ok(
        ['127.0.0.1', 'localhost', '::1'].includes(url.hostname) && url.port === String(port),
        `${serviceName} test must use the local emulator at port ${port}`
    );
}

requireLoopbackHost(AUTH_HOST, 9099, 'Auth');
requireLoopbackHost(FIRESTORE_HOST, 8080, 'Firestore');
requireLoopbackHost(FUNCTIONS_HOST, 5001, 'Functions');
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

const requireFunctions = createRequire(path.join(__dirname, '..', 'functions', 'package.json'));
const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
const { getAuth } = requireFunctions('firebase-admin/auth');
const { FieldValue, Timestamp, getFirestore } = requireFunctions('firebase-admin/firestore');

const app = initializeApp({ projectId: PROJECT_ID }, `numbers-run-test-${randomUUID()}`);
const auth = getAuth(app);
const db = getFirestore(app);
const authBase = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1`;
const functionBase = `http://${FUNCTIONS_HOST}/${PROJECT_ID}/us-central1`;
let account = null;
let otherVerifiedAccount = null;
let userRef = null;
let scoreRef = null;
const runRefs = [];
const limitRefs = [];

async function readJson(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        return { rawBody: text };
    }
}

async function post(url, data, token) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    return fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
}

async function callFunction(name, token, data) {
    return post(`${functionBase}/${name}`, { data }, token);
}

async function expectCallableError(response, expectedStatus, description) {
    const body = await readJson(response);
    assert.ok(
        !response.ok,
        `${description}: expected HTTP error ${expectedStatus}, got HTTP ${response.status}: ${JSON.stringify(body)}`
    );
    assert.equal(
        body.error?.status,
        expectedStatus,
        `${description}: HTTP ${response.status}: ${JSON.stringify(body)}`
    );
}

async function expectCallableResult(response, description) {
    const body = await readJson(response);
    assert.equal(response.status, 200, `${description}: ${JSON.stringify(body)}`);
    return body.result;
}

async function signUp(email, password) {
    const response = await post(`${authBase}/accounts:signUp?key=fake-api-key`, {
        email,
        password,
        returnSecureToken: true
    });
    const body = await readJson(response);
    assert.equal(response.status, 200, `Auth signup failed: ${JSON.stringify(body)}`);
    return body;
}

async function signIn(email, password) {
    const response = await post(`${authBase}/accounts:signInWithPassword?key=fake-api-key`, {
        email,
        password,
        returnSecureToken: true
    });
    const body = await readJson(response);
    assert.equal(response.status, 200, `Auth sign-in failed: ${JSON.stringify(body)}`);
    return body;
}

async function startQuestion(token, runId, questionIndex) {
    return expectCallableResult(
        await callFunction('startNumbersQuestion', token, { runId, questionIndex }),
        `Question ${questionIndex} start should succeed`
    );
}

async function answer(token, runId, questionIndex, answerValue, attemptId = randomUUID()) {
    return expectCallableResult(
        await callFunction('recordNumbersAnswer', token, { runId, questionIndex, answerValue, attemptId }),
        `Question ${questionIndex} answer should succeed`
    );
}

async function main() {
    const suffix = randomUUID();
    const email = `enl-run-${suffix}@example.test`;
    const password = `ENL-${suffix}-Aa1!`;

    try {
        account = await signUp(email, password);
        userRef = db.doc(`users/${account.localId}`);
        const scoreId = createHash('sha256').update(account.localId).digest('hex');
        scoreRef = db.doc(`leaderboards/numbers/scores/${scoreId}`);

        await expectCallableError(
            await callFunction('startNumbersRun', null, { mode: 'numbers' }),
            'UNAUTHENTICATED',
            'Unauthenticated run creation must be rejected'
        );
        console.log('PASS unauthenticated run creation denied');

        await expectCallableError(
            await callFunction('startNumbersRun', account.idToken, { mode: 'numbers' }),
            'PERMISSION_DENIED',
            'Unverified account run creation must be rejected'
        );
        console.log('PASS unverified account run creation denied');

        await auth.updateUser(account.localId, { emailVerified: true });
        account = await signIn(email, password);
        await userRef.set({ name: 'Trusted Profile Name', email, createdAt: new Date() });
        const limitRef = db.doc(`numbersRunLimits/${account.localId}`);
        limitRefs.push(limitRef);

        await expectCallableError(
            await callFunction('startNumbersRun', account.idToken, { mode: 'not-a-mode' }),
            'INVALID_ARGUMENT',
            'Unsupported Numbers mode must be rejected'
        );
        console.log('PASS unsupported game mode rejected');

        const startResult = await expectCallableResult(
            await callFunction('startNumbersRun', account.idToken, { mode: 'numbers' }),
            'Verified run creation should succeed'
        );
        assert.equal(startResult.mode, 'numbers');
        assert.equal(startResult.rulesVersion, RUN_RULES_VERSION);
        assert.equal(startResult.questionCount, 10);
        assert.equal(Object.hasOwn(startResult, 'questions'), false);
        const runId = startResult.runId;
        const runRef = db.doc(`numbersRuns/${runId}`);
        runRefs.push(runRef);

        for (let count = 1; count < MAX_RUN_STARTS_PER_WINDOW; count++) {
            const additionalRun = await expectCallableResult(
                await callFunction('startNumbersRun', account.idToken, { mode: 'numbers' }),
                `Run ${count + 1} within the rate limit should succeed`
            );
            runRefs.push(db.doc(`numbersRuns/${additionalRun.runId}`));
        }
        await expectCallableError(
            await callFunction('startNumbersRun', account.idToken, { mode: 'numbers' }),
            'RESOURCE_EXHAUSTED',
            'Starting more than the allowed number of runs in a window must be rejected'
        );
        assert.equal((await db.collection('numbersRuns').where('uid', '==', account.localId).get()).size,
            MAX_RUN_STARTS_PER_WINDOW,
            'A rejected start must not create another run');
        console.log('PASS per-account Numbers run start limit enforced without creating an extra run');

        const otherEmail = `enl-run-other-${suffix}@example.test`;
        const otherPassword = `ENL-${suffix}-Bb2!`;
        otherVerifiedAccount = await signUp(otherEmail, otherPassword);
        await auth.updateUser(otherVerifiedAccount.localId, { emailVerified: true });
        otherVerifiedAccount = await signIn(otherEmail, otherPassword);
        const otherLimitRef = db.doc(`numbersRunLimits/${otherVerifiedAccount.localId}`);
        limitRefs.push(otherLimitRef);
        const otherUserRun = await expectCallableResult(
            await callFunction('startNumbersRun', otherVerifiedAccount.idToken, { mode: 'numbers' }),
            'A different verified account should have an independent run limit'
        );
        runRefs.push(db.doc(`numbersRuns/${otherUserRun.runId}`));
        console.log('PASS Numbers run limit is isolated per account');

        await limitRef.set({
            windowStartedAtMs: Date.now() - RUN_START_WINDOW_MS - 1,
            count: MAX_RUN_STARTS_PER_WINDOW,
            expiresAt: Timestamp.fromMillis(Date.now() + RUN_START_WINDOW_MS)
        });
        const resetWindowRun = await expectCallableResult(
            await callFunction('startNumbersRun', account.idToken, { mode: 'numbers' }),
            'An expired rate-limit window should allow a new run'
        );
        runRefs.push(db.doc(`numbersRuns/${resetWindowRun.runId}`));
        const resetLimit = (await limitRef.get()).data();
        assert.equal(resetLimit.count, 1);
        assert.ok(resetLimit.windowStartedAtMs >= Date.now() - 5000);
        console.log('PASS expired Numbers run limit window resets');

        let runSnapshot = await runRef.get();
        let run = runSnapshot.data();
        const firstQuestion = run.questions[0];

        await expectCallableError(
            await callFunction('recordNumbersAnswer', account.idToken, {
                runId,
                questionIndex: 0,
                answerValue: firstQuestion.options[0],
                attemptId: randomUUID()
            }),
            'FAILED_PRECONDITION',
            'A question must start before it can be answered'
        );
        console.log('PASS full question sequence stays private and answers require a server timer');

        await expectCallableError(
            await callFunction('submitScore', account.idToken, { runId, score: 50000, name: 'Forged Name' }),
            'FAILED_PRECONDITION',
            'An unfinished run cannot be submitted'
        );
        console.log('PASS unfinished run cannot be submitted');

        const firstQuestionStart = await startQuestion(account.idToken, runId, 0);
        assert.deepEqual(firstQuestionStart, {
            started: true,
            questionIndex: 0,
            question: { word: firstQuestion.word, options: firstQuestion.options }
        });
        assert.equal(Object.hasOwn(firstQuestionStart.question, 'value'), false);
        runSnapshot = await runRef.get();
        const firstStartAt = runSnapshot.data().roundStartedAtMs;
        assert.ok(Number.isSafeInteger(firstStartAt));
        assert.equal(runSnapshot.data().startedAtMs, firstStartAt);
        assert.deepEqual(await startQuestion(account.idToken, runId, 0), firstQuestionStart);
        assert.equal((await runRef.get()).data().roundStartedAtMs, firstStartAt);

        await expectCallableError(
            await callFunction('startNumbersQuestion', otherVerifiedAccount.idToken, {
                runId,
                questionIndex: 0
            }),
            'PERMISSION_DENIED',
            'Another account cannot read a question from this run'
        );
        await expectCallableError(
            await callFunction('recordNumbersAnswer', otherVerifiedAccount.idToken, {
                runId,
                questionIndex: 0,
                answerValue: firstQuestion.options[0],
                attemptId: randomUUID()
            }),
            'PERMISSION_DENIED',
            'Another account cannot answer a question in this run'
        );
        await expectCallableError(
            await callFunction('finishNumbersRun', otherVerifiedAccount.idToken, { runId }),
            'PERMISSION_DENIED',
            'Another account cannot finish this run'
        );
        await expectCallableError(
            await callFunction('submitScore', otherVerifiedAccount.idToken, { runId }),
            'PERMISSION_DENIED',
            'Another account cannot submit this run result'
        );
        console.log('PASS Numbers run operations reject a different account');

        await expectCallableError(
            await callFunction('startNumbersQuestion', account.idToken, { runId, questionIndex: 1 }),
            'FAILED_PRECONDITION',
            'A later question cannot start before the current answer'
        );

        const wrongValue = firstQuestion.options.find(value => value !== firstQuestion.value);
        const wrongAttemptId = randomUUID();
        const wrongResult = await answer(account.idToken, runId, 0, wrongValue, wrongAttemptId);
        assert.equal(wrongResult.correct, false);
        assert.equal(wrongResult.questionIndex, 0);
        assert.equal(wrongResult.livesRemaining, 2);
        assert.deepEqual(await expectCallableResult(
            await callFunction('recordNumbersAnswer', account.idToken, {
                runId, questionIndex: 0, answerValue: wrongValue, attemptId: wrongAttemptId
            }),
            'A repeated answer attempt should return its original result'
        ), wrongResult);
        run = (await runRef.get()).data();
        assert.equal(run.roundStartedAtMs, firstStartAt, 'Wrong answers keep the current timer running');
        assert.equal(run.attemptCount, 1, 'A repeated attempt must not be counted twice');

        await expectCallableError(
            await callFunction('recordNumbersAnswer', account.idToken, {
                runId, questionIndex: 0, answerValue: 9999, attemptId: randomUUID()
            }),
            'INVALID_ARGUMENT',
            'An answer outside the displayed choices must be rejected'
        );

        const firstCorrect = await answer(account.idToken, runId, 0, firstQuestion.value);
        assert.equal(firstCorrect.correct, true);
        assert.equal(firstCorrect.questionIndex, 1);
        assert.equal(firstCorrect.livesRemaining, 2);
        assert.equal((await runRef.get()).data().roundStartedAtMs, null);

        for (let questionIndex = 1; questionIndex < run.questions.length; questionIndex++) {
            await startQuestion(account.idToken, runId, questionIndex);
            const question = run.questions[questionIndex];
            const result = await answer(account.idToken, runId, questionIndex, question.value);
            assert.equal(result.correct, true);
            assert.equal(result.questionIndex, questionIndex + 1);
        }

        run = (await runRef.get()).data();
        assert.equal(run.status, 'ready-to-finish');
        assert.equal(run.questionIndex, run.questions.length);
        assert.ok(Number.isSafeInteger(run.finishedAtMs));
        assert.equal(run.roundStartedAtMs, null);

        const finalResult = await expectCallableResult(
            await callFunction('finishNumbersRun', account.idToken, {
                runId,
                totalGameTimeMs: 0,
                score: 50000,
                mode: 'not-a-mode'
            }),
            'A completed run should produce a server-calculated result'
        );
        assert.equal(finalResult.mode, 'numbers');
        assert.equal(finalResult.rulesVersion, RUN_RULES_VERSION);
        assert.ok(finalResult.totalGameTime >= 0 && finalResult.totalGameTime < 1800);
        assert.ok(finalResult.finalScore > 0 && finalResult.finalScore !== 50000);
        assert.deepEqual(await expectCallableResult(
            await callFunction('finishNumbersRun', account.idToken, { runId, totalGameTimeMs: 1800000 }),
            'Finishing a run twice should return the saved result'
        ), finalResult);
        console.log('PASS server owns question timing and final score calculation');

        const saved = await expectCallableResult(
            await callFunction('submitScore', account.idToken, {
                runId, mode: 'not-a-mode', score: 50000, name: 'Forged Name'
            }),
            'A completed verified run should submit'
        );
        assert.deepEqual(saved, { saved: true, improved: true, name: 'Trusted Profile Name' });
        assert.deepEqual(await expectCallableResult(
            await callFunction('submitScore', account.idToken, { runId }),
            'Submitting the same run twice should be idempotent'
        ), saved);

        const storedScore = await scoreRef.get();
        assert.equal(storedScore.data().score, finalResult.finalScore);
        assert.equal(storedScore.data().name, 'Trusted Profile Name');
        assert.deepEqual(Object.keys(storedScore.data()).sort(), ['date', 'name', 'score']);
        console.log('PASS leaderboard uses the profile name and only the run result');

        for (const [label, score, expectedImproved] of [
            ['lower', finalResult.finalScore - 1, false],
            ['higher', finalResult.finalScore + 1, true]
        ]) {
            const syntheticRunRef = db.collection('numbersRuns').doc();
            runRefs.push(syntheticRunRef);
            await syntheticRunRef.set({
                uid: account.localId,
                mode: 'numbers',
                rulesVersion: RUN_RULES_VERSION,
                status: 'completed',
                result: { finalScore: score },
                leaderboardSubmitted: false,
                submissionDeadlineMs: Date.now() + 60_000,
                expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
                createdAt: FieldValue.serverTimestamp()
            });
            const submission = await expectCallableResult(
                await callFunction('submitScore', account.idToken, {
                    runId: syntheticRunRef.id, score: 50000, name: 'Forged Name'
                }),
                `A ${label} completed score should be processed`
            );
            assert.equal(submission.improved, expectedImproved);
        }
        assert.equal((await scoreRef.get()).data().score, finalResult.finalScore + 1);
        console.log('PASS leaderboard keeps only a new best score');

        const staleRunRef = db.collection('numbersRuns').doc();
        runRefs.push(staleRunRef);
        await staleRunRef.set({ uid: account.localId, rulesVersion: 1, status: 'active' });
        await expectCallableError(
            await callFunction('startNumbersQuestion', account.idToken, {
                runId: staleRunRef.id,
                questionIndex: 0
            }),
            'FAILED_PRECONDITION',
            'A run with an older scoring rules version must be rejected'
        );
        console.log('PASS stale scoring rules version rejected');

        console.log('\n12 Numbers run and leaderboard checks passed.');
    } finally {
        for (const runRef of runRefs) await runRef.delete().catch(() => {});
        for (const limitRef of limitRefs) await limitRef.delete().catch(() => {});
        if (scoreRef) await scoreRef.delete().catch(() => {});
        if (userRef) await userRef.delete().catch(() => {});
        for (const user of [account, otherVerifiedAccount].filter(Boolean)) {
            await auth.deleteUser(user.localId).catch(() => {});
        }
        await deleteApp(app);
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
