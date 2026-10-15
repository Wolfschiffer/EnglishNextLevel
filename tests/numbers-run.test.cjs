const test = require('node:test');
const assert = require('node:assert/strict');
const {
    calculateNumbersFinalResult,
    calculateNumbersRoundPoints,
    createNumbersRunQuestions,
    getNumberPool,
    numberToWords
} = require('../functions/numbers-run');

test('number words match the Numbers game style for units through thousands', () => {
    for (const [value, word] of [
        [1, 'one'],
        [19, 'nineteen'],
        [20, 'twenty'],
        [21, 'twenty-one'],
        [100, 'one hundred'],
        [119, 'one hundred nineteen'],
        [999, 'nine hundred ninety-nine'],
        [1000, 'one thousand'],
        [1001, 'one thousand one'],
        [9999, 'nine thousand nine hundred ninety-nine']
    ]) {
        assert.equal(numberToWords(value), word);
    }
});

test('number word conversion rejects unsupported values', () => {
    for (const value of [0, -1, 10000, 1.5, NaN]) {
        assert.throws(() => numberToWords(value), RangeError);
    }
});

test('server pools match the supported Numbers mode ranges', () => {
    assert.deepEqual(getNumberPool('numbers'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(getNumberPool('numbers11-20'), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    assert.deepEqual(getNumberPool('tens'), [20, 30, 40, 50, 60, 70, 80, 90]);
    const numbers21To99 = getNumberPool('random21_99');
    assert.equal(numbers21To99.length, 72);
    assert.deepEqual(
        numbers21To99,
        Array.from({ length: 72 }, (_, index) => 21 + Math.floor(index / 9) * 10 + (index % 9))
    );
    assert.equal(new Set(numbers21To99).size, numbers21To99.length);
    assert.deepEqual(getNumberPool('hundreds'), [100, 200, 300, 400, 500, 600, 700, 800, 900]);

    const numbers101To999 = getNumberPool('random101_999');
    assert.equal(numbers101To999.length, 900);
    assert.equal(numbers101To999[0], 100);
    assert.equal(numbers101To999.at(-1), 999);
    assert.ok(numbers101To999.every((value, index) => value === index + 100));

    assert.deepEqual(getNumberPool('thousands'), [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000]);

    const numbers1001To9999 = getNumberPool('random1001_9999');
    assert.equal(numbers1001To9999.length, 8999);
    assert.equal(numbers1001To9999[0], 1001);
    assert.equal(numbers1001To9999.at(-1), 9999);
    assert.ok(numbers1001To9999.every((value, index) => value === index + 1001));

    const componentModes = [
        'numbers', 'numbers11-20', 'tens', 'random21_99', 'hundreds',
        'random101_999', 'thousands', 'random1001_9999'
    ];
    const expectedMixedValues = [...new Set(componentModes.flatMap(getNumberPool))].sort((a, b) => a - b);
    assert.deepEqual(getNumberPool('mixedAdvanced').sort((a, b) => a - b), expectedMixedValues);
    assert.deepEqual(getNumberPool('invalid-mode'), []);
});

test('run questions fit each mode and contain unique answer options', () => {
    for (const [mode, expectedCount] of [
        ['numbers', 10],
        ['numbers11-20', 10],
        ['tens', 8],
        ['random21_99', 10],
        ['hundreds', 9],
        ['random101_999', 10],
        ['thousands', 9],
        ['random1001_9999', 10],
        ['mixedAdvanced', 10]
    ]) {
        const questions = createNumbersRunQuestions(mode, () => 0);
        const allowedValues = new Set(getNumberPool(mode));

        assert.equal(questions.length, expectedCount, mode);
        assert.equal(new Set(questions.map(question => question.value)).size, expectedCount, mode);
        for (const question of questions) {
            assert.ok(allowedValues.has(question.value), mode);
            assert.equal(question.options.length, 3, mode);
            assert.equal(new Set(question.options).size, 3, mode);
            assert.ok(question.options.includes(question.value), mode);
            assert.equal(question.word, numberToWords(question.value), mode);
        }
    }

    assert.equal(createNumbersRunQuestions('invalid-mode'), null);
});

test('server round scoring uses the shared streak and timing curve', () => {
    assert.deepEqual(calculateNumbersRoundPoints(0, 2500), {
        base: 100,
        streakBonus: 0,
        timeBonus: 2.5,
        roundTime: 2.5,
        points: 250
    });
    assert.equal(calculateNumbersRoundPoints(1, 12000).points, 135);
    assert.equal(calculateNumbersRoundPoints(10, 13000).points, 275);
});

test('server final score keeps the current time and remaining-lives bonuses', () => {
    assert.deepEqual(calculateNumbersFinalResult(1000, 22, 3), {
        baseScore: 1000,
        speedBonus: 2.4,
        lifeBonus: 1.6,
        finalScore: 3840,
        totalGameTime: 22,
        livesRemaining: 3
    });
    assert.equal(calculateNumbersFinalResult(1000, 91, 0).finalScore, 1000);
});
