const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const progressData = require('../functions/shared/progress-profile-data.js');

const source = fs.readFileSync(path.join(__dirname, '../js/progress-profile-mutations.js'), 'utf8');
const window = { EnglishNextLevelProgressData: progressData };
const sandbox = { window, module: { exports: {} } };
vm.runInNewContext(source, sandbox);
const mutations = sandbox.module.exports;

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

test('Numbers mutation returns a new progress object and updates cumulative and daily bests', () => {
    const input = progressData.emptyProgress();
    input.numbers.bestScores.numbers = 80;
    input.history.days['2025-02-01'] = { numbers: { bestScores: { numbers: 90 } } };
    const before = plain(input);

    const result = mutations.recordNumbersBest(input, 'numbers', '125.8', {
        dateKey: '2025-02-02',
        now: 1000
    });

    assert.notEqual(result, input);
    assert.deepEqual(plain(input), before, 'mutation must leave the caller\'s object unchanged');
    assert.equal(result.numbers.bestScores.numbers, 125);
    assert.equal(result.history.days['2025-02-02'].numbers.bestScores.numbers, 125);
    assert.equal(result.history.days['2025-02-02'].updatedAt, 1000);
    assert.equal(result.history.days['2025-02-01'].numbers.bestScores.numbers, 90);
    assert.equal(mutations.recordNumbersBest(input, 'unknown-mode', 99, { dateKey: '2025-02-02', now: 1000 }), null);
});

test('Words mutation keeps the highest score and fastest positive time', () => {
    const input = progressData.emptyProgress();
    input.words.present = { completed: true, bestScore: 80, bestTime: 60 };
    input.history.days['2025-02-02'] = {
        words: { present: { completed: true, bestScore: 100, bestTime: 50 } }
    };

    const result = mutations.recordWordsResult(input, {
        mode: 'present', score: 120, timeSeconds: 55
    }, { dateKey: '2025-02-02', now: 2000 });

    assert.equal(result.words.present.completed, true);
    assert.equal(result.words.present.bestScore, 120);
    assert.equal(result.words.present.bestTime, 50);
    assert.equal(result.history.days['2025-02-02'].words.present.bestScore, 120);
    assert.equal(result.history.days['2025-02-02'].words.present.bestTime, 50);
    assert.equal(mutations.recordWordsResult(input, { mode: 'unknown', score: 100 }, { dateKey: '2025-02-02', now: 2000 }), null);
});

test('review-item mutation adds valid cards once and leaves input unchanged', () => {
    const input = progressData.emptyProgress();
    const before = plain(input);
    const result = mutations.recordVocabularyReviewItems(input, {
        mode: 'present',
        setId: 'verbs1',
        items: [
            { id: 1, english: '  jump ', portuguese: ' pular ' },
            { id: 1, english: 'duplicate', portuguese: 'duplicada' },
            { id: 2, english: '', portuguese: 'invalid' },
            { id: 1000, english: 'outside', portuguese: 'fora' }
        ]
    }, { now: 3000 });

    assert.deepEqual(plain(input), before);
    assert.equal(result.added, 1);
    assert.equal(result.progress.vocabularyReviews.cards['present:verbs1:1'].front, 'jump');
    assert.equal(result.progress.vocabularyReviews.cards['present:verbs1:1'].back, 'pular');
    assert.equal(result.progress.vocabularyReviews.cards['present:verbs1:1'].due, 3000);
    assert.deepEqual(plain(mutations.recordVocabularyReviewItems(input, {
        mode: 'invalid', setId: 'verbs1', items: []
    }, { now: 3000 })), { progress: null, added: 0 });
});

test('review-card mutation normalizes accepted cards and rejects malformed input', () => {
    const input = progressData.emptyProgress();
    const cardId = 'present:verbs1:1';
    const result = mutations.recordVocabularyReviewCard(input, cardId, {
        front: 'jump', back: 'pular', due: 100, updatedAt: 50, state: 1, reps: '3.8'
    }, { now: 4000 });

    assert.equal(result.vocabularyReviews.cards[cardId].reps, 3);
    assert.equal(result.vocabularyReviews.cards[cardId].updatedAt, 4000);
    assert.equal(mutations.recordVocabularyReviewCard(input, 'invalid', {}, { now: 4000 }), null);
    assert.equal(mutations.recordVocabularyReviewCard(input, cardId, {}, { now: 4000 }), null);
});

test('Topics mutation updates cumulative and daily completion and best results', () => {
    const input = progressData.emptyProgress();
    const result = mutations.recordTopicResult(input, {
        topicId: 'food', levelId: 'beginner', volumeId: 'first',
        gameType: 'match', score: 1100, timeSeconds: 43
    }, { dateKey: '2025-02-03', now: 5000 });

    assert.equal(result.topics.food.beginner.first.match, true);
    assert.equal(result.history.days['2025-02-03'].topics.food.beginner.first.match, true);
    assert.deepEqual(plain(result.topicStats.food.beginner.first.match), { bestScore: 1000, bestTime: 43 });
    assert.deepEqual(plain(result.history.days['2025-02-03'].topicStats.food.beginner.first.match), {
        bestScore: 1000, bestTime: 43
    });
    assert.equal(mutations.recordTopicResult(input, {
        topicId: 'food', levelId: 'beginner', volumeId: 'first', gameType: 'other'
    }, { dateKey: '2025-02-03', now: 5000 }), null);
});
