const test = require('node:test');
const assert = require('node:assert/strict');
const progressData = require('../functions/shared/progress-profile-data.js');

globalThis.EnglishNextLevelProgressData = progressData;
const summary = require('../js/progress-profile-summary.js');
const { create } = require('../js/progress-profile-renderer.js');

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName;
        this.children = [];
        this.style = {};
        this.dataset = {};
        this.className = '';
        this._textContent = '';
        this._innerHTML = '';
        this.iconHost = null;
    }

    set textContent(value) {
        this._textContent = String(value);
        this._innerHTML = '';
        this.children = [];
    }

    get textContent() { return this._textContent; }

    set innerHTML(value) {
        this._innerHTML = String(value);
        this._textContent = '';
        this.children = [];
    }

    get innerHTML() { return this._innerHTML; }

    appendChild(element) {
        this.children.push(element);
        return element;
    }

    querySelector(selector) {
        if (selector !== '.progress-topic-icon') return null;
        this.iconHost ||= new MockElement('span');
        return this.iconHost;
    }
}

function createRendererHarness({ user = null, guest = true, currentUserName = '', topicCatalog = {} } = {}) {
    const ids = [
        'profile-container', 'progress-profile-name', 'progress-profile-email', 'progress-avatar',
        'progress-numbers-grid', 'progress-numbers-primary', 'progress-numbers-best',
        'progress-words-grid', 'progress-words-primary', 'progress-topics-list', 'progress-topics-primary',
        'progress-overall-percent', 'progress-overall-fill'
    ];
    const elements = new Map(ids.map((id) => [id, new MockElement()]));
    const document = {
        getElementById(id) { return elements.get(id) || null; },
        createElement(tagName) { return new MockElement(tagName); }
    };
    const window = { currentUser: user, isGuest: guest, currentUserName, TOPICS_DATA: topicCatalog };
    const syncStates = [];
    const renderer = create({
        document,
        window,
        numberModes: progressData.NUMBER_MODES,
        wordModes: progressData.WORD_MODES,
        formatScore: summary.formatScore,
        formatTime: summary.formatTime,
        summarizeOverall: summary.summarizeOverall,
        setSyncState(state) { syncStates.push(state); },
        getSyncState() { return 'local'; }
    });

    return { document, elements, renderer, syncStates, window };
}

test('profile renderer displays guest identity, progress counts, and every activity card', () => {
    const topicCatalog = {
        kitchen: {
            id: 'kitchen', title: 'Kitchen Objects', icon: 'images/topics/kitchen.png',
            levels: {
                common: { id: 'common', label: 'Common', volumes: [
                    { id: 'volume-1', label: 'Volume 1' },
                    { id: 'volume-2', label: 'Volume 2' }
                ] }
            }
        },
        garden: {
            id: 'garden', title: 'Garden', icon: '🌱',
            levels: { basics: { id: 'basics', label: 'Basics', words: ['flower', 'tree'] } }
        }
    };
    const harness = createRendererHarness({ topicCatalog });
    const progress = {
        numbers: { bestScores: { numbers: 50, tens: 12 } },
        words: {
            present: { completed: true, bestScore: 25, bestTime: 61 },
            past: { completed: false, bestScore: 0, bestTime: null }
        },
        topics: {
            kitchen: { common: { 'volume-1': { match: true, speak: true } } },
            garden: { basics: { 'volume-1': { speak: true } } }
        },
        topicStats: {
            kitchen: {
                common: { 'volume-1': {
                    match: { bestScore: 100, bestTime: 61 },
                    speak: { bestScore: 200, bestTime: 90 }
                } }
            }
        }
    };

    const result = harness.renderer.render(progress, topicCatalog);

    assert.equal(harness.elements.get('progress-profile-name').textContent, 'Guest');
    assert.equal(harness.elements.get('progress-profile-email').textContent, 'Guest progress is stored on this device.');
    assert.equal(harness.elements.get('progress-avatar').textContent, 'G');
    assert.deepEqual(harness.syncStates, ['local']);
    assert.equal(harness.elements.get('progress-overall-percent').textContent, '35%');
    assert.equal(harness.elements.get('progress-overall-fill').style.width, '35%');
    assert.equal(harness.elements.get('progress-numbers-primary').textContent, '2/9');
    assert.equal(harness.elements.get('progress-numbers-best').textContent, 'Highest: 50');
    assert.equal(harness.elements.get('progress-numbers-grid').children.length, 9);
    assert.equal(harness.elements.get('progress-numbers-grid').children[0].className, 'progress-number-item is-complete');
    assert.equal(harness.elements.get('progress-words-primary').textContent, '1/2');
    assert.equal(harness.elements.get('progress-words-grid').children.length, 2);
    assert.match(harness.elements.get('progress-words-grid').children[0].innerHTML, /01:01/);
    assert.equal(harness.elements.get('progress-topics-primary').textContent, '3/6');
    assert.equal(harness.elements.get('progress-topics-list').children.length, 2);
    assert.match(harness.elements.get('progress-topics-list').children[0].innerHTML, /100 pts · 01:01/);
    assert.match(harness.elements.get('progress-topics-list').children[0].innerHTML, /200 pts · 01:30/);
    assert.equal(harness.elements.get('progress-topics-list').children[0].iconHost.children[0].src, 'images/topics/kitchen.png');
    assert.equal(harness.elements.get('progress-topics-list').children[1].iconHost.textContent, '🌱');
    assert.equal(result.percent, 35);
});

test('profile renderer displays signed-in identity and handles an empty topic catalog', () => {
    const harness = createRendererHarness({
        user: { displayName: 'Morgan', email: 'morgan@example.test' },
        guest: false
    });

    harness.renderer.render({ numbers: { bestScores: {} }, words: {}, topics: {} }, {});

    assert.equal(harness.elements.get('progress-profile-name').textContent, 'Morgan');
    assert.equal(harness.elements.get('progress-profile-email').textContent, 'morgan@example.test');
    assert.equal(harness.elements.get('progress-avatar').textContent, 'M');
    assert.equal(harness.elements.get('progress-topics-primary').textContent, '0/0');
    assert.match(harness.elements.get('progress-topics-list').innerHTML, /No topic progress yet/);
    assert.equal(harness.elements.get('progress-overall-percent').textContent, '0%');
});
