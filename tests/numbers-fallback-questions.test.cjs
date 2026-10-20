const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFallbackNumbers } = require('../js/numbers-fallback-questions.js');

const numbers = (values) => values.map(value => ({ value, word: `number-${value}` }));
const valuesOf = (items) => items.map(number => number.value);

test('fallback questions keep available unseen numbers in their current order', () => {
    const result = buildFallbackNumbers({
        availableNumbers: numbers([1, 2, 3, 4]),
        allNumbers: numbers([1, 2, 3, 4, 5]),
        shownValues: new Set([2]),
        remainingCount: 2
    });

    assert.deepEqual(valuesOf(result), [1, 3]);
});

test('fallback questions fill from the full mode without duplicates or seen values', () => {
    const availableNumbers = numbers([4, 4, 5]);
    const result = buildFallbackNumbers({
        availableNumbers,
        allNumbers: numbers([1, 2, 3, 4, 5, 6]),
        shownValues: new Set([1, 2]),
        remainingCount: 4
    });

    assert.deepEqual(valuesOf(result), [4, 5, 3, 6]);
    assert.equal(new Set(valuesOf(result)).size, result.length);
    assert.deepEqual(valuesOf(availableNumbers), [4, 4, 5], 'the helper must not mutate its inputs');
});

test('fallback questions stop at the requested count and return none for zero remaining slots', () => {
    const allNumbers = numbers([1, 2, 3]);

    assert.deepEqual(valuesOf(buildFallbackNumbers({
        allNumbers,
        remainingCount: 2
    })), [1, 2]);
    assert.deepEqual(buildFallbackNumbers({
        allNumbers,
        remainingCount: 0
    }), []);
});
