const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateMatchPoints } = require('../js/vocabulary-scoring.js');

test('desktop scoring keeps each speed bonus threshold', () => {
    assert.equal(calculateMatchPoints(4), 200);
    assert.equal(calculateMatchPoints(7), 175);
    assert.equal(calculateMatchPoints(12), 150);
    assert.equal(calculateMatchPoints(18), 125);
    assert.equal(calculateMatchPoints(18.01), 100);
});

test('mobile scoring allows more time for each speed bonus', () => {
    assert.equal(calculateMatchPoints(5, true), 200);
    assert.equal(calculateMatchPoints(8, true), 175);
    assert.equal(calculateMatchPoints(13, true), 150);
    assert.equal(calculateMatchPoints(20, true), 125);
    assert.equal(calculateMatchPoints(20.01, true), 100);
});

test('scoring treats a missing speed measurement as the fixed base points', () => {
    assert.equal(calculateMatchPoints(Number.NaN), 100);
});
