const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const indexConfig = JSON.parse(readFileSync(
    path.join(__dirname, '..', 'firestore.indexes.json'),
    'utf8'
));

test('Firestore TTL overrides target each document collection group', () => {
    const ttlGroups = indexConfig.fieldOverrides
        .filter(override => override.fieldPath === 'expiresAt' && override.ttl === true)
        .map(override => override.collectionGroup)
        .sort();

    assert.deepEqual(ttlGroups, ['numbersRunLimits', 'numbersRuns', 'operations']);
});
