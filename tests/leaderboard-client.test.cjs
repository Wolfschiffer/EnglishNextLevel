const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createLatestRequestTracker,
    getLeaderboardScopeTitle,
    getLeaderboardReadFeedback,
    isServerBackedLeaderboardSnapshot,
    saveLeaderboardScore,
    getSuccessfulSaveFeedback
} = require('../js/leaderboard-client.js');

const quietLogger = { error() {} };

test('names the leaderboard according to the active Firebase environment', () => {
    assert.equal(getLeaderboardScopeTitle('qa'), 'QA Leaderboards');
    assert.equal(getLeaderboardScopeTitle('test'), 'Test Leaderboards');
    assert.equal(getLeaderboardScopeTitle('production'), 'Global Leaderboards');
});

test('only the newest leaderboard request can update the selected mode', () => {
    const tracker = createLatestRequestTracker();
    const earlierRequest = tracker.begin();
    const selectedModeRequest = tracker.begin();

    assert.equal(tracker.isCurrent(earlierRequest), false);
    assert.equal(tracker.isCurrent(selectedModeRequest), true);
});

test('does not treat a cached Firestore snapshot as a current shared leaderboard', () => {
    assert.equal(isServerBackedLeaderboardSnapshot({ metadata: { fromCache: true } }), false);
    assert.equal(isServerBackedLeaderboardSnapshot({ metadata: { fromCache: false } }), true);
});

test('distinguishes a successfully loaded empty shared leaderboard', () => {
    assert.deepEqual(getLeaderboardReadFeedback({
        cloudConfigured: true,
        cloudReadFailed: false,
        localStorageReadFailed: false,
        hasScores: false
    }), {
        type: 'global-empty',
        title: '',
        message: '',
        retry: false
    });
});

test('identifies local fallback scores after a shared leaderboard failure', () => {
    const feedback = getLeaderboardReadFeedback({
        cloudConfigured: true,
        cloudReadFailed: true,
        localStorageReadFailed: false,
        hasScores: true
    });

    assert.equal(feedback.type, 'local-fallback');
    assert.match(feedback.message, /saved on this device/i);
    assert.equal(feedback.retry, true);
});

test('offers retry when shared scores fail and no local scores exist', () => {
    const feedback = getLeaderboardReadFeedback({
        cloudConfigured: true,
        cloudReadFailed: true,
        localStorageReadFailed: false,
        hasScores: false
    });

    assert.equal(feedback.type, 'cloud-error');
    assert.equal(feedback.retry, true);
});

test('labels scores as device-only when no shared service is configured', () => {
    const feedback = getLeaderboardReadFeedback({
        cloudConfigured: false,
        cloudReadFailed: false,
        localStorageReadFailed: false,
        hasScores: true
    });

    assert.equal(feedback.type, 'local');
    assert.match(feedback.message, /not shared/i);
    assert.equal(feedback.retry, false);
});

test('reports an online save and does not also save locally', async () => {
    const calls = [];
    const result = await saveLeaderboardScore('numbers', '25', ' Ana ', {
        saveToCloud: async (...args) => {
            calls.push(['cloud', ...args]);
            return { saved: true, improved: true, name: 'Ana' };
        },
        saveLocally: async (...args) => calls.push(['local', ...args]),
        logger: quietLogger
    });

    assert.deepEqual(result, { saved: true, improved: true, destination: 'global', playerName: 'Ana' });
    assert.deepEqual(calls, [['cloud', 'numbers', 25, 'Ana']]);
});

test('labels emulator writes as test data rather than online scores', async () => {
    const result = await saveLeaderboardScore('numbers', 25, 'Ana', {
        saveToCloud: async () => {},
        cloudDestination: 'test',
        logger: quietLogger
    });

    assert.deepEqual(result, { saved: true, improved: true, destination: 'test', playerName: 'Ana' });
    assert.deepEqual(getSuccessfulSaveFeedback(result.destination, 'Ana'), {
        buttonText: 'Saved in test mode',
        statusText: 'Score saved to the local Firebase test environment as Ana. It will not appear on the online leaderboard.'
    });
});

test('labels QA project writes separately from test and production scores', async () => {
    const result = await saveLeaderboardScore('numbers', 25, 'Ana', {
        saveToCloud: async () => ({ saved: true, improved: true, name: 'Ana' }),
        cloudDestination: 'qa',
        logger: quietLogger
    });

    assert.deepEqual(result, { saved: true, improved: true, destination: 'qa', playerName: 'Ana' });
    assert.deepEqual(getSuccessfulSaveFeedback(result.destination, 'Ana'), {
        buttonText: 'Saved in QA',
        statusText: 'Score saved to the separate QA Firebase project as Ana. It will not appear on the production leaderboard.'
    });
    assert.match(getSuccessfulSaveFeedback('qa', 'Ana', false).statusText, /QA leaderboard record/);
});

test('uses clear feedback for online and device-only scores', () => {
    assert.deepEqual(getSuccessfulSaveFeedback('global', 'Ana'), {
        buttonText: 'Saved',
        statusText: 'Score saved online as Ana.'
    });
    assert.deepEqual(getSuccessfulSaveFeedback('local', 'Ana'), {
        buttonText: 'Saved on this device',
        statusText: 'Score saved on this device as Ana. We could not confirm whether it was added to the shared leaderboard.'
    });
});

test('reports when the existing leaderboard best was not improved', async () => {
    const result = await saveLeaderboardScore('numbers', 25, 'Typed Name', {
        saveToCloud: async () => ({ saved: true, improved: false, name: 'Profile Name' }),
        logger: quietLogger
    });

    assert.deepEqual(result, {
        saved: true,
        improved: false,
        destination: 'global',
        playerName: 'Profile Name'
    });
    assert.deepEqual(getSuccessfulSaveFeedback(result.destination, result.playerName, result.improved), {
        buttonText: 'Best score kept',
        statusText: 'Your score did not beat the existing online leaderboard record for Profile Name; the previous best remains.'
    });
});

test('reports a device-only save when the online save fails', async () => {
    const calls = [];
    const result = await saveLeaderboardScore('numbers', 25, 'Ana', {
        saveToCloud: async () => { throw new Error('offline'); },
        saveLocally: async (...args) => {
            calls.push(args);
            return true;
        },
        logger: quietLogger
    });

    assert.deepEqual(result, {
        saved: true,
        improved: true,
        destination: 'local',
        playerName: 'Ana'
    });
    assert.deepEqual(calls, [['numbers', 25, 'Ana']]);
});

test('uses device storage when no online service is configured', async () => {
    const result = await saveLeaderboardScore('numbers', 25, 'Ana', {
        saveLocally: async () => true,
        logger: quietLogger
    });

    assert.deepEqual(result, {
        saved: true,
        improved: true,
        destination: 'local',
        playerName: 'Ana'
    });
});

test('keeps saving available for retry when both destinations fail', async () => {
    const result = await saveLeaderboardScore('numbers', 25, 'Ana', {
        saveToCloud: async () => { throw new Error('offline'); },
        saveLocally: async () => false,
        logger: quietLogger
    });

    assert.deepEqual(result, { saved: false, destination: 'none' });
});

test('rejects invalid scores, names, and modes without calling storage', async () => {
    let calls = 0;
    const dependencies = {
        saveToCloud: async () => { calls += 1; },
        saveLocally: async () => { calls += 1; return true; },
        logger: quietLogger
    };

    for (const [mode, score, name] of [
        ['', 1, 'Ana'],
        ['numbers', -1, 'Ana'],
        ['numbers', Infinity, 'Ana'],
        ['numbers', 1, '  '],
        ['numbers', 1, null]
    ]) {
        assert.deepEqual(
            await saveLeaderboardScore(mode, score, name, dependencies),
            { saved: false, destination: 'none' }
        );
    }

    assert.equal(calls, 0);
});
