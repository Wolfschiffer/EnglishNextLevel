const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const window = {};
const source = fs.readFileSync(path.join(ROOT, 'js/topics/speech-answer.js'), 'utf8');
vm.runInNewContext(source, { window });

test('spoken answer normalization ignores case, accents, punctuation, and repeated spaces', () => {
    assert.equal(window.TopicSpeakAnswer.normalize('  L’été,   TODAY! '), 'lete today');
});

test('answer matching accepts the English word and optional leading articles', () => {
    const word = { english: 'apple' };

    assert.equal(window.TopicSpeakAnswer.isCorrect('Apple!', word), true);
    assert.equal(window.TopicSpeakAnswer.isCorrect('an apple', word), true);
    assert.equal(window.TopicSpeakAnswer.isCorrect('the apple', word), true);
    assert.equal(window.TopicSpeakAnswer.isCorrect('pineapple', word), false);
});

test('explicit accepted forms and speech aliases extend answer matching', () => {
    const word = {
        english: 'color',
        accepted: ['colour'],
        recognitionAliases: ['color']
    };

    assert.equal(window.TopicSpeakAnswer.isCorrect('colour', word), true);
    assert.equal(window.TopicSpeakAnswer.isCorrect('color', word), true);
    assert.equal(window.TopicSpeakAnswer.isCorrect('colourful', word), false);
});

test('Speak corrects a known close transcript to the expected word', () => {
    const word = {
        english: 'ladle',
        recognitionAliases: ['ledo']
    };

    assert.deepEqual({ ...window.TopicSpeakAnswer.match('Ledo', word) }, {
        correct: true,
        answer: 'ladle',
        corrected: true
    });
});

test('Speak accepts only a one-letter recognition difference on longer words', () => {
    assert.equal(window.TopicSpeakAnswer.isCorrect('refrigerater', { english: 'refrigerator' }), true);
    assert.equal(window.TopicSpeakAnswer.isCorrect('plane', { english: 'plate' }), false);
    assert.equal(window.TopicSpeakAnswer.isCorrect('greater', { english: 'peeler' }), false);
});
