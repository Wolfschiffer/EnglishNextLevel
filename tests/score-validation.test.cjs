const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProfileName, normalizeRunId } = require('../functions/score-validation');

test('run ID validator accepts a Firestore auto ID in callable data', () => {
    const runId = 'AbCdEf0123456789_-xy';
    assert.equal(runId.length, 20);
    assert.equal(normalizeRunId({ runId }), runId);
});

test('run ID validator rejects malformed or non-object inputs', () => {
    for (const data of [
        null,
        [],
        'AbCdEf0123456789_-xy',
        {},
        { runId: 'short' },
        { runId: 'AbCdEf0123456789_-xy!' },
        { runId: 'A'.repeat(21) }
    ]) {
        assert.equal(normalizeRunId(data), null);
    }
});

test('public leaderboard names come from the user profile and are normalized', () => {
    assert.equal(normalizeProfileName('  Marcus  '), 'Marcus');
    assert.equal(normalizeProfileName('x'.repeat(21)), 'x'.repeat(20));
    assert.equal(normalizeProfileName('   '), null);
    assert.equal(normalizeProfileName(null), null);
});
