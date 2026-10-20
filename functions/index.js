const { createHash } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const { consumeCallableRateLimit } = require('./callable-rate-limit');
const { normalizeProgressPayload, syncProgressData } = require('./progress-sync');
const { normalizeProfileName, normalizeRunId, SCORE_MODES } = require('./score-validation');
const {
    INITIAL_LIVES,
    MAX_RUN_DURATION_MS,
    RUN_RULES_VERSION,
    calculateNumbersFinalResult,
    calculateNumbersRoundPoints,
    createNumbersRunQuestions
} = require('./numbers-run');

setGlobalOptions({ maxInstances: 10 });

initializeApp();

const db = getFirestore();
const RUN_COLLECTION = 'numbersRuns';
const MAX_RUN_ATTEMPTS_PER_QUESTION = INITIAL_LIVES - 1;
const MAX_SCORE = 50000;
const RESULT_SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const consumeRateLimit = (uid, operation) =>
    consumeCallableRateLimit({ db, HttpsError }, uid, operation);

function requireVerifiedUser(request, action = 'submit a global score') {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', `Sign in to ${action}.`);
    }

    if (request.auth.token.email_verified !== true) {
        throw new HttpsError('permission-denied', `Verify your email before you ${action}.`);
    }

    return request.auth.uid;
}

function getRunReference(runId) {
    return db.collection(RUN_COLLECTION).doc(runId);
}

function requireCurrentRunRules(run) {
    if (run.rulesVersion !== RUN_RULES_VERSION) {
        throw new HttpsError('failed-precondition', 'This Numbers run uses an unsupported scoring rules version.');
    }
}

function isRunExpired(run, now) {
    return !run.expiresAt || typeof run.expiresAt.toMillis !== 'function' || run.expiresAt.toMillis() <= now;
}

function getPublicQuestion(question) {
    return { word: question.word, options: [...question.options] };
}

exports.syncProgress = onCall(async (request) => {
    const uid = requireVerifiedUser(request, 'sync saved progress');
    await consumeRateLimit(uid, 'syncProgress');
    if (request.data?.expectedUid !== uid) {
        throw new HttpsError('permission-denied', 'The signed-in account changed before progress could sync.');
    }
    const progress = normalizeProgressPayload(request.data?.progress, HttpsError);

    return syncProgressData({
        db,
        uid,
        progress,
        profileName: request.data?.profileName,
        email: request.auth.token.email,
        FieldValue,
        HttpsError
    });
});

exports.startNumbersRun = onCall(async (request) => {
    const uid = requireVerifiedUser(request);
    const mode = typeof request.data?.mode === 'string' ? request.data.mode : '';
    if (!SCORE_MODES.has(mode)) {
        throw new HttpsError('invalid-argument', 'Choose a supported Numbers mode.');
    }

    const questions = createNumbersRunQuestions(mode);
    if (!questions?.length) {
        throw new HttpsError('invalid-argument', 'The selected Numbers mode has no questions.');
    }

    await consumeRateLimit(uid, 'startNumbersRun');

    const now = Date.now();
    const runRef = getRunReference(db.collection(RUN_COLLECTION).doc().id);
    const run = {
        uid,
        mode,
        rulesVersion: RUN_RULES_VERSION,
        questions,
        questionIndex: 0,
        score: 0,
        streak: 0,
        livesRemaining: INITIAL_LIVES,
        attemptCount: 0,
        startedAtMs: null,
        roundStartedAtMs: null,
        roundStartedQuestionIndex: null,
        processedAttempts: {},
        status: 'active',
        leaderboardSubmitted: false,
        expiresAt: Timestamp.fromMillis(now + MAX_RUN_DURATION_MS),
        createdAt: FieldValue.serverTimestamp()
    };

    await runRef.create(run);

    return {
        runId: runRef.id,
        mode,
        rulesVersion: RUN_RULES_VERSION,
        questionCount: questions.length
    };
});

exports.startNumbersQuestion = onCall(async (request) => {
    const uid = requireVerifiedUser(request);
    const runId = normalizeRunId(request.data);
    const questionIndex = request.data?.questionIndex;
    if (!runId || !Number.isSafeInteger(questionIndex) || questionIndex < 0) {
        throw new HttpsError('invalid-argument', 'The Numbers question is invalid.');
    }

    await consumeRateLimit(uid, 'startNumbersQuestion');
    const runRef = getRunReference(runId);
    const now = Date.now();

    return db.runTransaction(async (transaction) => {
        const runSnapshot = await transaction.get(runRef);
        if (!runSnapshot.exists) {
            throw new HttpsError('not-found', 'The Numbers run was not found.');
        }

        const run = runSnapshot.data();
        if (run.uid !== uid) {
            throw new HttpsError('permission-denied', 'This Numbers run belongs to another account.');
        }
        requireCurrentRunRules(run);
        if (run.status !== 'active' || isRunExpired(run, now)) {
            throw new HttpsError('failed-precondition', 'This Numbers run is no longer active.');
        }
        if (questionIndex !== run.questionIndex || questionIndex >= run.questions.length) {
            throw new HttpsError('failed-precondition', 'Start the current question before answering.');
        }

        if (run.roundStartedAtMs != null) {
            if (run.roundStartedQuestionIndex === questionIndex) {
                return {
                    started: true,
                    questionIndex,
                    question: getPublicQuestion(run.questions[questionIndex])
                };
            }
            throw new HttpsError('failed-precondition', 'Another Numbers question is already in progress.');
        }

        const update = {
            roundStartedAtMs: now,
            roundStartedQuestionIndex: questionIndex
        };
        if (questionIndex === 0 && run.startedAtMs == null) update.startedAtMs = now;
        transaction.update(runRef, update);
        return {
            started: true,
            questionIndex,
            question: getPublicQuestion(run.questions[questionIndex])
        };
    });
});

exports.recordNumbersAnswer = onCall(async (request) => {
    const uid = requireVerifiedUser(request);
    const runId = normalizeRunId(request.data);
    const attemptId = typeof request.data?.attemptId === 'string' ? request.data.attemptId : '';
    const questionIndex = request.data?.questionIndex;
    const answerValue = request.data?.answerValue;

    if (!runId || !/^[A-Za-z0-9_-]{8,80}$/.test(attemptId) ||
        !Number.isSafeInteger(questionIndex) || questionIndex < 0 ||
        !Number.isSafeInteger(answerValue) || answerValue < 1 || answerValue > 9999) {
        throw new HttpsError('invalid-argument', 'The answer attempt is invalid.');
    }

    await consumeRateLimit(uid, 'recordNumbersAnswer');
    const runRef = getRunReference(runId);
    const now = Date.now();

    return db.runTransaction(async (transaction) => {
        const runSnapshot = await transaction.get(runRef);
        if (!runSnapshot.exists) {
            throw new HttpsError('not-found', 'The Numbers run was not found.');
        }

        const run = runSnapshot.data();
        if (run.uid !== uid) {
            throw new HttpsError('permission-denied', 'This Numbers run belongs to another account.');
        }
        requireCurrentRunRules(run);

        const previousResult = run.processedAttempts &&
            Object.hasOwn(run.processedAttempts, attemptId)
            ? run.processedAttempts[attemptId]
            : null;
        if (previousResult) return previousResult;

        if (run.status !== 'active' || isRunExpired(run, now)) {
            throw new HttpsError('failed-precondition', 'This Numbers run is no longer active.');
        }

        if (questionIndex !== run.questionIndex) {
            throw new HttpsError('failed-precondition', 'Answer the current question before continuing.');
        }

        const maxAttempts = run.questions.length + MAX_RUN_ATTEMPTS_PER_QUESTION;
        if (run.attemptCount >= maxAttempts) {
            throw new HttpsError('resource-exhausted', 'This Numbers run has reached its answer limit.');
        }

        const question = run.questions[run.questionIndex];
        if (!question || !question.options.includes(answerValue)) {
            throw new HttpsError('invalid-argument', 'Choose one of the displayed answers.');
        }
        if (run.roundStartedQuestionIndex !== questionIndex || !Number.isSafeInteger(run.roundStartedAtMs)) {
            throw new HttpsError('failed-precondition', 'Start the current question before answering.');
        }

        const elapsedMs = Math.max(0, now - run.roundStartedAtMs);
        const isCorrect = answerValue === question.value;
        let nextIndex = run.questionIndex;
        let nextScore = run.score;
        let nextStreak = run.streak;
        let nextLives = run.livesRemaining;
        let nextRoundStartedAtMs = run.roundStartedAtMs;
        let nextRoundStartedQuestionIndex = run.roundStartedQuestionIndex;
        let nextFinishedAtMs = run.finishedAtMs || null;
        let nextStatus = run.status;

        if (isCorrect) {
            const round = calculateNumbersRoundPoints(run.streak, elapsedMs);
            nextScore += round.points;
            nextStreak += 1;
            nextIndex += 1;
            nextRoundStartedAtMs = null;
            nextRoundStartedQuestionIndex = null;
            if (nextIndex >= run.questions.length) {
                nextStatus = 'ready-to-finish';
                nextFinishedAtMs = now;
            }
        } else {
            nextLives -= 1;
            nextStreak = 0;
            if (nextLives <= 0) nextStatus = 'lost';
        }

        const result = {
            accepted: true,
            correct: isCorrect,
            questionIndex: nextIndex,
            currentScore: nextScore,
            livesRemaining: nextLives,
            status: nextStatus
        };
        const processedAttempts = { ...(run.processedAttempts || {}), [attemptId]: result };

        transaction.update(runRef, {
            questionIndex: nextIndex,
            score: nextScore,
            streak: nextStreak,
            livesRemaining: nextLives,
            attemptCount: run.attemptCount + 1,
            processedAttempts,
            roundStartedAtMs: nextRoundStartedAtMs,
            roundStartedQuestionIndex: nextRoundStartedQuestionIndex,
            finishedAtMs: nextFinishedAtMs,
            status: nextStatus
        });

        return result;
    });
});

exports.finishNumbersRun = onCall(async (request) => {
    const uid = requireVerifiedUser(request);
    const runId = normalizeRunId(request.data);
    if (!runId) throw new HttpsError('invalid-argument', 'The Numbers run is invalid.');

    await consumeRateLimit(uid, 'finishNumbersRun');
    const runRef = getRunReference(runId);
    const now = Date.now();

    return db.runTransaction(async (transaction) => {
        const runSnapshot = await transaction.get(runRef);
        if (!runSnapshot.exists) {
            throw new HttpsError('not-found', 'The Numbers run was not found.');
        }

        const run = runSnapshot.data();
        if (run.uid !== uid) {
            throw new HttpsError('permission-denied', 'This Numbers run belongs to another account.');
        }
        requireCurrentRunRules(run);

        if (run.status === 'completed') return run.result;
        if (run.status !== 'ready-to-finish' || run.questionIndex !== run.questions.length) {
            throw new HttpsError('failed-precondition', 'Answer every question before finishing the run.');
        }
        if (isRunExpired(run, now)) {
            throw new HttpsError('failed-precondition', 'This Numbers run has expired.');
        }
        if (!Number.isSafeInteger(run.startedAtMs) || !Number.isSafeInteger(run.finishedAtMs) ||
            run.roundStartedAtMs != null) {
            throw new HttpsError('failed-precondition', 'The Numbers run timer is not ready to finish.');
        }

        const totalGameTimeMs = run.finishedAtMs - run.startedAtMs;
        if (run.finishedAtMs > now || !Number.isSafeInteger(totalGameTimeMs) ||
            totalGameTimeMs < 0 || totalGameTimeMs > MAX_RUN_DURATION_MS) {
            throw new HttpsError('failed-precondition', 'The Numbers run duration is invalid.');
        }
        const totalGameTime = totalGameTimeMs / 1000;
        const result = {
            ...calculateNumbersFinalResult(run.score, totalGameTime, run.livesRemaining),
            mode: run.mode,
            rulesVersion: run.rulesVersion
        };

        if (!Number.isSafeInteger(result.finalScore) || result.finalScore < 0 || result.finalScore > MAX_SCORE) {
            throw new HttpsError('internal', 'The validated score is outside the supported range.');
        }

        transaction.update(runRef, {
            status: 'completed',
            result,
            completedAt: FieldValue.serverTimestamp(),
            submissionDeadlineMs: now + RESULT_SUBMISSION_WINDOW_MS,
            expiresAt: Timestamp.fromMillis(now + RESULT_SUBMISSION_WINDOW_MS)
        });

        return result;
    });
});

exports.submitScore = onCall(async (request) => {
    const uid = requireVerifiedUser(request);
    const runId = normalizeRunId(request.data);
    if (!runId) {
        throw new HttpsError('invalid-argument', 'Submit a completed Numbers run.');
    }

    await consumeRateLimit(uid, 'submitScore');
    const runRef = getRunReference(runId);
    const userRef = db.collection('users').doc(uid);
    const scoreId = createHash('sha256').update(uid).digest('hex');

    return db.runTransaction(async (transaction) => {
        const runSnapshot = await transaction.get(runRef);
        if (!runSnapshot.exists) {
            throw new HttpsError('not-found', 'The Numbers run was not found.');
        }

        const run = runSnapshot.data();
        if (run.uid !== uid) {
            throw new HttpsError('permission-denied', 'This Numbers run belongs to another account.');
        }
        requireCurrentRunRules(run);
        if (run.status !== 'completed' || !run.result) {
            throw new HttpsError('failed-precondition', 'Complete the Numbers run before submitting its score.');
        }
        if (run.submissionDeadlineMs < Date.now()) {
            throw new HttpsError('failed-precondition', 'This Numbers result is no longer eligible for submission.');
        }

        const scoreRef = db.collection('leaderboards')
            .doc(run.mode)
            .collection('scores')
            .doc(scoreId);
        const [userSnapshot, scoreSnapshot] = await Promise.all([
            transaction.get(userRef),
            transaction.get(scoreRef)
        ]);

        const name = normalizeProfileName(userSnapshot.data()?.name);
        if (!userSnapshot.exists || !name) {
            throw new HttpsError('failed-precondition', 'Add a valid profile name before submitting a score.');
        }

        if (run.leaderboardSubmitted) {
            return run.leaderboardResult || { saved: true, improved: false, name };
        }

        const score = run.result.finalScore;
        if (!Number.isSafeInteger(score) || score < 0 || score > MAX_SCORE || !SCORE_MODES.has(run.mode)) {
            throw new HttpsError('failed-precondition', 'The completed Numbers result is invalid.');
        }

        const improved = !scoreSnapshot.exists || scoreSnapshot.data().score < score;
        const result = { saved: true, improved, name };

        if (improved) {
            transaction.set(scoreRef, {
                name,
                score,
                date: FieldValue.serverTimestamp()
            });
        }

        transaction.update(runRef, {
            leaderboardSubmitted: true,
            leaderboardResult: result
        });

        return result;
    });
});
