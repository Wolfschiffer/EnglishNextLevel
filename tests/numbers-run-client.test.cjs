const test = require('node:test');
const assert = require('node:assert/strict');
const { createNumbersRunClient } = require('../js/numbers-run-client');

const verifiedUser = { uid: 'user-1', emailVerified: true };
const runId = 'AbCdEf0123456789_-xy';
const validRun = {
    runId,
    mode: 'numbers',
    rulesVersion: 2,
    questionCount: 1
};

function makeClient({ user = verifiedUser, isGuest = false, responses = {}, calls = [] } = {}) {
    return createNumbersRunClient({
        getCurrentUser: () => user,
        isGuest: () => isGuest,
        createAttemptId: () => 'attempt-123456',
        callFunction: async (name, data) => {
            calls.push({ name, data });
            if (responses[name] instanceof Error) throw responses[name];
            return { data: responses[name] };
        }
    });
}

test('global runs require a signed-in verified non-guest profile', async () => {
    const guests = [
        makeClient({ user: null }),
        makeClient({ user: { uid: 'user-1', emailVerified: false } }),
        makeClient({ isGuest: true })
    ];

    assert.equal(guests[0].canSubmitGlobally(), false);
    assert.equal(guests[1].canSubmitGlobally(), false);
    assert.equal(guests[2].canSubmitGlobally(), false);
    assert.equal(await guests[0].start('numbers'), null);
    assert.equal(await guests[2].start('numbers'), null);
});

test('starts a server run without downloading its question sequence', async () => {
    const calls = [];
    const client = makeClient({ responses: { startNumbersRun: validRun }, calls });
    assert.deepEqual(await client.start('numbers'), validRun);
    assert.deepEqual(calls, [{ name: 'startNumbersRun', data: { mode: 'numbers' } }]);
});

test('rejects invalid or question-bearing run start responses', async () => {
    for (const run of [
        { ...validRun, runId: 'bad' },
        { ...validRun, rulesVersion: 1 },
        { ...validRun, questionCount: 0 },
        { ...validRun, questions: [{ word: 'one', options: [1, 2, 3] }] }
    ]) {
        const client = makeClient({ responses: { startNumbersRun: run } });
        await assert.rejects(client.start('numbers'), /invalid Numbers/);
    }
});

test('starts a question and records an answer with a generated idempotency ID', async () => {
    const calls = [];
    const response = {
        accepted: true, correct: true, questionIndex: 1,
        currentScore: 250, livesRemaining: 3, status: 'active'
    };
    const client = makeClient({ responses: { recordNumbersAnswer: response }, calls });
    const questionStart = {
        started: true,
        questionIndex: 0,
        question: { word: 'one', options: [1, 2, 3] }
    };
    const startClient = makeClient({ responses: { startNumbersQuestion: questionStart }, calls });
    assert.deepEqual(await startClient.startQuestion(runId, 0), questionStart);
    assert.deepEqual(await client.recordAnswer(runId, 0, 1), response);
    assert.deepEqual(calls, [{
        name: 'startNumbersQuestion',
        data: { runId, questionIndex: 0 }
    }, {
        name: 'recordNumbersAnswer',
        data: { runId, questionIndex: 0, answerValue: 1, attemptId: 'attempt-123456' }
    }]);
});

test('rejects invalid question payloads or an exposed answer key', async () => {
    for (const question of [
        { word: 'one', options: [1, 2, 2] },
        { word: 'one', options: [1, 2, 3], value: 1 },
        { word: '', options: [1, 2, 3] }
    ]) {
        const client = makeClient({ responses: {
            startNumbersQuestion: { started: true, questionIndex: 0, question }
        } });
        await assert.rejects(client.startQuestion(runId, 0), /invalid Numbers question/);
    }
});

test('finish and submit send only the server run ID', async () => {
    const calls = [];
    const finalResult = {
        baseScore: 250, speedBonus: 2.4, lifeBonus: 1.6,
        finalScore: 960, totalGameTime: 10, livesRemaining: 3
    };
    const client = makeClient({ responses: {
        finishNumbersRun: finalResult,
        submitScore: { saved: true, improved: true, name: 'Trusted Profile' }
    }, calls });
    assert.deepEqual(await client.finish(runId), finalResult);
    assert.deepEqual(await client.submitScore(runId), {
        saved: true, improved: true, name: 'Trusted Profile'
    });
    assert.deepEqual(calls, [
        { name: 'finishNumbersRun', data: { runId } },
        { name: 'submitScore', data: { runId } }
    ]);
});

test('does not call server functions for unverified users', async () => {
    const calls = [];
    const client = makeClient({ user: { uid: 'user-1', emailVerified: false }, calls });
    await assert.rejects(client.recordAnswer(runId, 0, 1), /verified account/);
    await assert.rejects(client.finish(runId), /verified account/);
    await assert.rejects(client.submitScore(runId), /verified account/);
    assert.deepEqual(calls, []);
});
