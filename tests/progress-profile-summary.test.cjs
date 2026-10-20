const test = require('node:test');
const assert = require('node:assert/strict');
const progressData = require('../functions/shared/progress-profile-data.js');

globalThis.EnglishNextLevelProgressData = progressData;
const summary = require('../js/progress-profile-summary.js');

test('progress summary counts Match and Speak across current and legacy topic formats', () => {
    const topics = {
        kitchen: {
            levels: {
                common: {
                    volumes: [{ id: 'volume-1' }, { id: 'volume-2' }]
                }
            }
        },
        garden: {
            levels: {
                basics: { words: ['flower', 'tree'] }
            }
        }
    };
    const progress = {
        numbers: { bestScores: { numbers: 100, tens: 0 } },
        words: { present: { completed: true }, past: { completed: false } },
        topics: {
            kitchen: {
                common: {
                    'volume-1': { match: true, speak: true },
                    'volume-2': { match: true, speak: false }
                }
            },
            garden: { basics: { 'volume-1': { match: false, speak: true } } }
        }
    };

    assert.equal(summary.countTopicActivities(progress), 4);
    assert.equal(summary.totalAvailableTopicActivities(topics), 6);
    assert.deepEqual(
        { ...summary.summarizeOverall(progress, topics, [['numbers'], ['tens']], progressData.WORD_MODES) },
        {
            numberCompleted: 1,
            wordCompleted: 1,
            topicCompleted: 4,
            topicTotal: 6,
            completed: 6,
            total: 10,
            percent: 60
        }
    );
});

test('progress summary handles missing topics and rounds the overall percentage', () => {
    const progress = {
        numbers: { bestScores: { numbers: 1 } },
        words: { present: { completed: false } },
        topics: {}
    };
    const result = summary.summarizeOverall(progress, null, [['numbers'], ['tens']], { present: 'Present' });

    assert.equal(summary.countTopicActivities(null), 0);
    assert.equal(summary.totalAvailableTopicActivities(null), 0);
    assert.equal(result.total, 3);
    assert.equal(result.completed, 1);
    assert.equal(result.percent, 33);
    assert.equal(summary.summarizeOverall({}, null, [], {}).percent, 0);
});

test('progress summary keeps score and time formatting behavior', () => {
    assert.equal(summary.formatScore(1234.9), '1,234');
    assert.equal(summary.formatScore(-5), '0');
    assert.equal(summary.formatScore('invalid'), '0');
    assert.equal(summary.formatTime(0), '—');
    assert.equal(summary.formatTime(61), '01:01');
    assert.equal(summary.formatTime(-1), '00:00');
    assert.equal(summary.formatTime('invalid'), '00:00');
});
