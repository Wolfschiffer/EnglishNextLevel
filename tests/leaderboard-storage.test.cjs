const test = require('node:test');
const assert = require('node:assert/strict');
const { createLeaderboardStorage } = require('../js/leaderboard-storage.js');

function createMemoryStorage(initialEntries = {}) {
    const values = new Map(Object.entries(initialEntries));
    return {
        values,
        getItem(key) {
            if (this.failRead) throw new Error('read denied');
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            if (this.failWrite) throw new Error('write denied');
            values.set(key, value);
        },
        failRead: false,
        failWrite: false
    };
}

test('reads valid scores and skips malformed entries', () => {
    const storage = createMemoryStorage({
        leaderboard_numbers: JSON.stringify([
            { name: 'Ana', score: '12' },
            { name: '  ', score: 20 },
            { name: 'Bad score', score: 'x' },
            null
        ])
    });
    const leaderboard = createLeaderboardStorage(() => storage, { warn() {} });

    assert.deepEqual(leaderboard.readLocalLeaderboard('numbers'), [
        { name: 'Ana', score: 12 }
    ]);
    assert.deepEqual(leaderboard.readLocalLeaderboardResult('numbers'), {
        scores: [{ name: 'Ana', score: 12 }],
        ok: true
    });
});

test('malformed JSON is reported and is not overwritten by a save', () => {
    let warnings = 0;
    const storage = createMemoryStorage({ leaderboard_numbers: '{broken' });
    const leaderboard = createLeaderboardStorage(() => storage, { warn() { warnings += 1; } });

    assert.deepEqual(leaderboard.readLocalLeaderboard('numbers'), []);
    assert.deepEqual(leaderboard.readLocalLeaderboardResult('numbers'), { scores: [], ok: false });
    assert.equal(leaderboard.saveLocalLeaderboard('numbers', 10, 'Bia'), false);
    assert.equal(storage.values.get('leaderboard_numbers'), '{broken');
    assert.equal(warnings, 3);
});

test('valid JSON with an invalid leaderboard shape is reported as unavailable', () => {
    const storage = createMemoryStorage({
        leaderboard_numbers: JSON.stringify({ name: 'Ana', score: 10 })
    });
    const leaderboard = createLeaderboardStorage(() => storage, { warn() {} });

    assert.deepEqual(leaderboard.readLocalLeaderboardResult('numbers'), {
        scores: [],
        ok: false
    });
    assert.equal(leaderboard.saveLocalLeaderboard('numbers', 15, 'Bia'), false);
    assert.equal(storage.values.get('leaderboard_numbers'), JSON.stringify({ name: 'Ana', score: 10 }));

    const invalidEntries = JSON.stringify([{ name: 'Bad', score: 'x' }]);
    storage.values.set('leaderboard_numbers', invalidEntries);
    assert.deepEqual(leaderboard.readLocalLeaderboardResult('numbers'), {
        scores: [],
        ok: false
    });
    assert.equal(leaderboard.saveLocalLeaderboard('numbers', 15, 'Bia'), false);
    assert.equal(storage.values.get('leaderboard_numbers'), invalidEntries);
});

test('missing and empty leaderboards are valid empty lists', () => {
    const storage = createMemoryStorage();
    const leaderboard = createLeaderboardStorage(() => storage, { warn() {} });

    assert.deepEqual(leaderboard.readLocalLeaderboardResult('numbers'), { scores: [], ok: true });
    storage.values.set('leaderboard_numbers', '[]');
    assert.deepEqual(leaderboard.readLocalLeaderboardResult('numbers'), { scores: [], ok: true });
});

test('an empty stored string is reported as corrupted data', () => {
    const storage = createMemoryStorage({ leaderboard_numbers: '' });
    const leaderboard = createLeaderboardStorage(() => storage, { warn() {} });

    assert.deepEqual(leaderboard.readLocalLeaderboardResult('numbers'), { scores: [], ok: false });
    assert.equal(leaderboard.saveLocalLeaderboard('numbers', 15, 'Bia'), false);
    assert.equal(storage.values.get('leaderboard_numbers'), '');
});

test('saves scores in descending order and keeps only the best 50', () => {
    const initialScores = Array.from({ length: 50 }, (_, index) => ({
        name: `Player ${index + 1}`,
        score: 50 - index
    }));
    const storage = createMemoryStorage({ leaderboard_numbers: JSON.stringify(initialScores) });
    const leaderboard = createLeaderboardStorage(() => storage, { warn() {} });

    assert.equal(leaderboard.saveLocalLeaderboard('numbers', 100, ' New Player '), true);

    const saved = JSON.parse(storage.values.get('leaderboard_numbers'));
    assert.equal(saved.length, 50);
    assert.equal(saved[0].name, 'New Player');
    assert.equal(saved[0].score, 100);
    assert.equal(saved.at(-1).score, 2);
    assert.ok(Number.isFinite(Date.parse(saved[0].date)));
});

test('rejects invalid score and name values', () => {
    const storage = createMemoryStorage();
    const leaderboard = createLeaderboardStorage(() => storage, { warn() {} });

    for (const [score, name] of [
        [null, 'Ana'],
        ['', 'Ana'],
        [true, 'Ana'],
        [Infinity, 'Ana'],
        [-1, 'Ana'],
        [10, '   ']
    ]) {
        assert.equal(leaderboard.saveLocalLeaderboard('numbers', score, name), false);
    }
    assert.equal(storage.values.size, 0);
});

test('storage read or write failures never report a successful save', () => {
    let warnings = 0;
    const storage = createMemoryStorage();
    const leaderboard = createLeaderboardStorage(() => storage, { warn() { warnings += 1; } });

    storage.failRead = true;
    assert.deepEqual(leaderboard.readLocalLeaderboard('numbers'), []);
    assert.equal(leaderboard.saveLocalLeaderboard('numbers', 10, 'Ana'), false);
    storage.failRead = false;

    storage.failWrite = true;
    assert.equal(leaderboard.saveLocalLeaderboard('numbers', 10, 'Ana'), false);
    assert.ok(warnings >= 3);
});
