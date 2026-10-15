const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function createSession({ client = {}, mode = 'numbers', findNumberByWord } = {}) {
    const warnings = [];
    const state = { activeRun: null, gameActive: true, mode };
    const context = vm.createContext({ window: {}, console });
    const source = fs.readFileSync(path.join(ROOT, 'js/numbers-run-session.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'numbers-run-session.js' });
    const api = context.window.EnglishNextLevelNumbersRunSession;
    const session = api.create({
        getClient: () => client,
        getCurrentRun: () => state.activeRun,
        getCurrentMode: () => state.mode,
        isGameActive: () => state.gameActive,
        findNumberByWord: findNumberByWord ?? (word => ({ word, value: 10 })),
        logger: { warn(...args) { warnings.push(args); } }
    });

    return { session, state, warnings };
}

function serverRun(overrides = {}) {
    return { mode: 'numbers', questionCount: 2, runId: 'run-1', ...overrides };
}

function createRun(harness, overrides = {}) {
    const run = harness.session.prepare(serverRun(overrides));
    assert.ok(run);
    harness.state.activeRun = run;
    return run;
}

test('prepare accepts only a server run for the current mode with a supported question count', () => {
    const harness = createSession();

    assert.equal(harness.session.prepare(serverRun({ questionCount: 1 })).questions.length, 1);
    assert.equal(harness.session.prepare(serverRun({ questionCount: 0 })), null);
    assert.equal(harness.session.prepare(serverRun({ questionCount: 11 })), null);
    assert.equal(harness.session.prepare(serverRun({ questionCount: 1.5 })), null);
    assert.equal(harness.session.prepare(serverRun({ mode: 'tens' })), null);
});

test('question start resolves local data and stores the verified question', async () => {
    const client = {
        async startQuestion(runId, questionIndex) {
            assert.equal(runId, 'run-1');
            assert.equal(questionIndex, 0);
            return { question: { word: 'ten', options: [10, 20, 30, 40] } };
        }
    };
    const harness = createSession({ client, findNumberByWord: word => ({ word, value: 10 }) });
    const run = createRun(harness);

    const question = await harness.session.startQuestion(run, 0);

    assert.deepEqual({ ...question, options: [...question.options] }, {
        word: 'ten', value: 10, options: [10, 20, 30, 40]
    });
    assert.equal(run.questions[0].value, 10);
});

test('a server question that cannot be matched to local data invalidates the run', async () => {
    const client = {
        async startQuestion() {
            return { question: { word: 'unknown', options: [10, 20] } };
        }
    };
    const harness = createSession({ client, findNumberByWord: () => null });
    const run = createRun(harness);

    assert.equal(await harness.session.startQuestion(run, 0), null);
    assert.equal(run.valid, false);
    assert.equal(harness.warnings.length, 1);
});

test('leaving the run while a question request is pending ignores its late response', async () => {
    const response = deferred();
    const client = { startQuestion: () => response.promise };
    const harness = createSession({ client });
    const run = createRun(harness);

    const pendingQuestion = harness.session.startQuestion(run, 0);
    await Promise.resolve();
    harness.session.invalidate(run);
    harness.state.activeRun = null;
    response.resolve({ question: { word: 'ten', options: [10, 20] } });

    assert.equal(await pendingQuestion, null);
    assert.equal(run.questions[0], null);
    assert.equal(run.valid, false);
});

test('answer requests wait for question data and serialize in order', async () => {
    const firstAnswer = deferred();
    const answerCalls = [];
    let attemptId = 0;
    const client = {
        createAttemptId() { attemptId += 1; return `attempt-${attemptId}`; },
        async startQuestion() {
            return { question: { word: 'ten', options: [10, 20] } };
        },
        recordAnswer(...args) {
            answerCalls.push(args);
            return answerCalls.length === 1
                ? firstAnswer.promise
                : Promise.resolve({ correct: false, questionIndex: 1 });
        }
    };
    const harness = createSession({ client });
    const run = createRun(harness);

    const questionStart = harness.session.startQuestion(run, 0);
    harness.session.queueAnswer(run, 0, 10, true);
    const firstChain = run.pendingAnswers;
    harness.session.queueAnswer(run, 1, 20, false);
    const allAnswers = run.pendingAnswers;

    assert.equal(answerCalls.length, 0);
    await questionStart;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(answerCalls.length, 1);
    assert.deepEqual(answerCalls[0], ['run-1', 0, 10, 'attempt-1']);

    firstAnswer.resolve({ correct: true, questionIndex: 1 });
    await firstChain;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(answerCalls.length, 2);
    assert.deepEqual(answerCalls[1], ['run-1', 1, 20, 'attempt-2']);
    await allAnswers;
    assert.equal(run.valid, true);
});

test('a server answer state that disagrees with the local result invalidates the run', async () => {
    const client = {
        createAttemptId: () => 'attempt-1',
        recordAnswer: async () => ({ correct: false, questionIndex: 0 })
    };
    const harness = createSession({ client });
    const run = createRun(harness);

    harness.session.queueAnswer(run, 0, 10, true);
    await run.pendingAnswers;

    assert.equal(run.valid, false);
    assert.equal(harness.warnings.length, 1);
});

test('finish waits for pending answers before submitting the final run', async () => {
    const pendingAnswers = deferred();
    let finishCalls = 0;
    const expectedResult = { finalScore: 1200, totalGameTime: 45, livesRemaining: 2 };
    const client = {
        async finish(runId) {
            finishCalls += 1;
            assert.equal(runId, 'run-1');
            return expectedResult;
        }
    };
    const harness = createSession({ client });
    const run = createRun(harness);
    run.pendingAnswers = pendingAnswers.promise;

    const finishing = harness.session.finish(run);
    await Promise.resolve();
    assert.equal(finishCalls, 0);
    pendingAnswers.resolve();

    assert.deepEqual({ ...await finishing }, {
        result: expectedResult, mode: 'numbers', runId: 'run-1'
    });
    assert.equal(finishCalls, 1);
});

test('a verified finish result is preserved when navigation invalidates the run', async () => {
    const finishResponse = deferred();
    const client = { finish: () => finishResponse.promise };
    const harness = createSession({ client });
    const run = createRun(harness);

    const finishing = harness.session.finish(run);
    await Promise.resolve();
    harness.session.invalidate(run);
    harness.state.activeRun = null;
    finishResponse.resolve({ finalScore: 9999 });

    const finished = await finishing;
    assert.equal(finished.result.finalScore, 9999);
    assert.equal(finished.mode, 'numbers');
    assert.equal(finished.runId, 'run-1');
});

test('finish refuses to submit an invalid run', async () => {
    let finishCalls = 0;
    const client = { async finish() { finishCalls += 1; } };
    const harness = createSession({ client });
    const run = createRun(harness);

    harness.session.invalidate(run);
    await assert.rejects(harness.session.finish(run), /could not be verified/);
    assert.equal(finishCalls, 0);
});
