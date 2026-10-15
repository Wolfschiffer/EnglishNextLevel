const test = require('node:test');
const assert = require('node:assert/strict');
const progressData = require('../js/progress-profile-data.js');

test('empty progress creates independent defaults for every game mode', () => {
    const first = progressData.emptyProgress();
    const second = progressData.emptyProgress();
    const normalized = progressData.normalizeProgress({});

    assert.equal(first.version, 4);
    assert.deepEqual(Object.keys(normalized.numbers.bestScores), progressData.NUMBER_MODES.map(([id]) => id));
    assert.deepEqual(normalized.words, {
        present: { completed: false, bestScore: 0, bestTime: null },
        past: { completed: false, bestScore: 0, bestTime: null }
    });

    first.history.days['2025-01-01'] = {};
    assert.deepEqual(second.history, { days: {} });
});

test('normalizes saved values and ignores malformed modes, cards, and dates', () => {
    const normalized = progressData.normalizeProgress({
        updatedAt: '12.5',
        numbers: { bestScores: { numbers: '15.9', random21_99: 'invalid', unknown: 400 } },
        words: { present: { completed: true, bestScore: '9.7', bestTime: '0.8' } },
        topics: { food: { beginner: { first: { match: 1, speak: 0 } } } },
        topicStats: {
            food: {
                beginner: {
                    first: {
                        match: { bestScore: '1500', bestTime: '31.8' },
                        speak: { bestScore: -3, bestTime: 0 }
                    }
                }
            }
        },
        vocabularyReviews: {
            cards: {
                'present:verbs1:7': {
                    front: ' jump ', back: ' pular ', due: 10, updatedAt: 20,
                    state: 2, reps: '4.9', difficulty: 99
                },
                'present:verbs11:8': {
                    front: 'invalid set', back: 'x', due: 10, updatedAt: 20, state: 2
                }
            }
        },
        history: {
            days: {
                '2025-01-02': {
                    updatedAt: 2,
                    numbers: { bestScores: { numbers: '22.2' } },
                    words: { present: { completed: true, bestScore: 1, bestTime: 42 } }
                },
                'not-a-date': { numbers: { bestScores: { numbers: 999 } } }
            }
        }
    });

    assert.equal(normalized.updatedAt, 12.5);
    assert.equal(normalized.numbers.bestScores.numbers, 22);
    assert.equal(normalized.numbers.bestScores.random21_99, 0);
    assert.equal(Object.hasOwn(normalized.numbers.bestScores, 'unknown'), false);
    assert.equal(normalized.words.present.bestScore, 9);
    assert.equal(normalized.words.present.bestTime, 42);
    assert.equal(normalized.topics.food.beginner.first.match, true);
    assert.equal(normalized.topics.food.beginner.first.speak, false);
    assert.deepEqual(normalized.topicStats.food.beginner.first.match, { bestScore: 1000, bestTime: 31 });
    assert.deepEqual(normalized.topicStats.food.beginner.first.speak, { bestScore: 0, bestTime: null });
    assert.deepEqual(Object.keys(normalized.vocabularyReviews.cards), ['present:verbs1:7']);
    assert.equal(normalized.vocabularyReviews.cards['present:verbs1:7'].front, 'jump');
    assert.equal(normalized.vocabularyReviews.cards['present:verbs1:7'].reps, 4);
    assert.equal(normalized.vocabularyReviews.cards['present:verbs1:7'].difficulty, 10);
    assert.deepEqual(Object.keys(normalized.history.days), ['2025-01-02']);
});

test('merges cumulative and daily progress while keeping the better results', () => {
    const cardId = 'present:verbs1:7';
    const left = {
        numbers: { bestScores: { numbers: 20 } },
        words: { present: { bestScore: 200, bestTime: 80 } },
        topics: { food: { beginner: { first: { match: true, speak: false } } } },
        topicStats: { food: { beginner: { first: { match: { bestScore: 50, bestTime: 70 } } } } },
        vocabularyReviews: { cards: { [cardId]: { front: 'old', back: 'old', due: 10, updatedAt: 10, state: 2 } } },
        history: { days: { '2025-02-03': {
            updatedAt: 2,
            numbers: { bestScores: { numbers: 10 } },
            words: { present: { bestScore: 100, bestTime: 75 } },
            topics: { food: { beginner: { first: { match: true, speak: false } } } },
            topicStats: { food: { beginner: { first: { match: { bestScore: 50, bestTime: 70 } } } } }
        } } }
    };
    const right = {
        numbers: { bestScores: { numbers: 18 } },
        words: { present: { bestScore: 250, bestTime: 65 } },
        topics: { food: { beginner: { first: { match: false, speak: true } } } },
        topicStats: { food: { beginner: { first: { match: { bestScore: 55, bestTime: 60 } } } } },
        vocabularyReviews: { cards: { [cardId]: { front: 'new', back: 'new', due: 20, updatedAt: 20, state: 2 } } },
        history: { days: { '2025-02-03': {
            updatedAt: 3,
            numbers: { bestScores: { numbers: 12 } },
            words: { present: { bestScore: 150, bestTime: 60 } },
            topics: { food: { beginner: { first: { match: false, speak: true } } } },
            topicStats: { food: { beginner: { first: { match: { bestScore: 80, bestTime: 60 } } } } }
        } } }
    };

    const merged = progressData.mergeProgress(left, right);
    const day = merged.history.days['2025-02-03'];

    assert.equal(merged.numbers.bestScores.numbers, 20);
    assert.equal(merged.words.present.bestScore, 250);
    assert.equal(merged.words.present.bestTime, 60);
    assert.equal(merged.topics.food.beginner.first.match, true);
    assert.equal(merged.topics.food.beginner.first.speak, true);
    assert.deepEqual(merged.topicStats.food.beginner.first.match, { bestScore: 80, bestTime: 60 });
    assert.equal(merged.vocabularyReviews.cards[cardId].front, 'new');
    assert.equal(day.numbers.bestScores.numbers, 12);
    assert.equal(day.words.present.bestTime, 60);
    assert.equal(day.topics.food.beginner.first.speak, true);
});
