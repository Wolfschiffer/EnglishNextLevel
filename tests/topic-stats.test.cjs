const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createHarness() {
    const elements = new Map();
    const results = [];
    let now = 0;

    function element(id, textContent = '') {
        const value = {
            textContent,
            style: {},
            classList: { contains() { return false; } },
            getAttribute() { return null; },
            addEventListener() {}
        };
        elements.set(id, value);
        return value;
    }

    [
        'topic-match-total', 'topic-match-count', 'topic-match-score', 'topic-match-time',
        'topic-match-final-score', 'topic-match-final-time', 'topic-speak-total',
        'topic-speak-current', 'topic-speak-score', 'topic-speak-time',
        'topic-speak-final-score', 'topic-speak-final-time', 'topic-match-start-btn',
        'topic-speak-start-btn', 'topic-match-play-again', 'topic-speak-play-again',
        'back-from-topic-match', 'topic-match-back-topic', 'back-from-topic-speak',
        'topic-speak-back-topic'
    ].forEach((id) => element(id));

    elements.get('topic-match-total').textContent = '4';
    elements.get('topic-speak-total').textContent = '3';
    elements.get('topic-match-count').textContent = '0';
    elements.get('topic-speak-current').textContent = '1';

    const window = {
        TopicApp: {
            getSelection() {
                return {
                    topic: { id: 'kitchen' },
                    level: { id: 'common' },
                    volume: { id: 'volume-1' }
                };
            }
        },
        EnglishNextLevelProgress: {
            recordTopicResult(result) { results.push(result); }
        },
        setInterval() { return 1; },
        clearInterval() {}
    };
    window.window = window;
    const document = {
        readyState: 'complete',
        getElementById(id) { return elements.get(id) || null; },
        addEventListener() {}
    };
    const source = fs.readFileSync(path.join(ROOT, 'js/topics/topic-stats.js'), 'utf8');

    vm.runInNewContext(source, {
        window,
        document,
        performance: { now() { return now; } },
        setInterval: window.setInterval,
        clearInterval: window.clearInterval
    });

    return {
        api: window.EnglishNextLevelTopicStats,
        elements,
        results,
        setNow(value) { now = value; }
    };
}

test('Topic rounds save their result once when explicitly finalized', () => {
    const harness = createHarness();
    harness.setNow(1000);
    harness.api.beginRound('match');
    harness.setNow(4000);

    harness.api.finalizeRound('match');
    harness.api.finalizeRound('match');

    assert.equal(harness.results.length, 1);
    assert.deepEqual({ ...harness.results[0] }, {
        topicId: 'kitchen',
        levelId: 'common',
        volumeId: 'volume-1',
        gameType: 'match',
        score: 994,
        timeSeconds: 3
    });
    assert.equal(harness.api.getRound('match').completed, true);
});

test('match and speak games explicitly finalize when they show a review', () => {
    const matchSource = fs.readFileSync(path.join(ROOT, 'js/topics/match-pairs.js'), 'utf8');
    const speakSource = fs.readFileSync(path.join(ROOT, 'js/topics/speech-game.js'), 'utf8');

    assert.match(matchSource, /EnglishNextLevelTopicStats\?\.finalizeRound\('match'\)/);
    assert.match(speakSource, /EnglishNextLevelTopicStats\?\.finalizeRound\('speak'\)/);
});
