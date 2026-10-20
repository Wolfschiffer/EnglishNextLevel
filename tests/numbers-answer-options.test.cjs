const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const answerOptions = require('../js/numbers-answer-options.js');

const root = path.join(__dirname, '..');

test('Numbers answer options include the correct value once and two unique distractors', () => {
    const chooser = answerOptions.create({ random: () => 0 });
    const values = [1, 2, 3, 4];
    const options = chooser.generate(values, 3);

    assert.equal(options.length, 3);
    assert.equal(options.filter(value => value === 3).length, 1);
    assert.equal(new Set(options).size, 3);
    assert.ok(options.every(value => values.includes(value)));
});

test('Numbers answer position never repeats three times in a row', () => {
    const chooser = answerOptions.create({ random: () => 0 });
    const correctIndexes = Array.from({ length: 30 }, () => (
        chooser.generate([1, 2, 3, 4], 4).indexOf(4)
    ));

    for (let index = 2; index < correctIndexes.length; index++) {
        if (correctIndexes[index - 1] === correctIndexes[index - 2]) {
            assert.notEqual(correctIndexes[index], correctIndexes[index - 2]);
        }
    }
});

test('Numbers answer position history resets when a new game starts', () => {
    const chooser = answerOptions.create({ random: () => 0 });
    assert.equal(chooser.generate([1, 2, 3, 4], 4).indexOf(4), 0);
    assert.equal(chooser.generate([1, 2, 3, 4], 4).indexOf(4), 0);

    chooser.reset();

    assert.equal(chooser.generate([1, 2, 3, 4], 4).indexOf(4), 0);
});

test('index loads Numbers answer selection before the game and the service worker caches it', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const scriptPaths = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
    const answerOptionsIndex = scriptPaths.indexOf('js/numbers-answer-options.js');
    const gameIndex = scriptPaths.indexOf('js/numbers-game.js');
    const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

    assert.notEqual(answerOptionsIndex, -1);
    assert.ok(answerOptionsIndex < gameIndex);
    assert.match(serviceWorker, /\.\/js\/numbers-answer-options\.js/);
});
