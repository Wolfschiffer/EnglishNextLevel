const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createTopicsMenuHarness() {
    const elements = new Map();
    const gameButtons = [];
    const events = [];

    function createElement(id = '', dataset = {}) {
        const listeners = new Map();
        const classes = new Set();
        const styleProperties = new Map();
        const children = [];
        return {
            id,
            dataset,
            children,
            textContent: '',
            style: { setProperty(name, value) { styleProperties.set(name, value); } },
            classList: {
                add(...names) { names.forEach((name) => classes.add(name)); },
                remove(...names) { names.forEach((name) => classes.delete(name)); },
                contains(name) { return classes.has(name); }
            },
            addEventListener(event, callback) { listeners.set(event, callback); },
            dispatch(event) { listeners.get(event)?.({ target: this }); },
            setAttribute() {},
            appendChild(child) { children.push(child); },
            querySelector() { return null; },
            set innerHTML(value) { this._innerHTML = value; },
            get innerHTML() { return this._innerHTML || ''; }
        };
    }

    [
        'topic-phase-message', 'selected-topic-icon', 'selected-topic-title',
        'selected-topic-description', 'topic-speak-container', 'topic-match-container'
    ].forEach((id) => elements.set(id, createElement(id)));
    elements.get('topic-speak-container').style.display = 'none';
    elements.get('topic-match-container').style.display = 'none';

    for (const gameType of ['match', 'speak']) {
        const button = createElement(`topic-${gameType}-btn`, { topicGame: gameType });
        gameButtons.push(button);
    }

    const document = {
        documentElement: { clientWidth: 1280 },
        getElementById(id) { return elements.get(id) || null; },
        querySelectorAll(selector) {
            if (selector === '[data-topic-game]') return gameButtons;
            return [];
        },
        createElement() { return createElement(); }
    };
    const window = {
        innerWidth: 1280,
        TOPICS_DATA: {
            kitchen: {
                id: 'kitchen',
                title: 'Kitchen Objects',
                description: 'Kitchen vocabulary',
                icon: '🍽️',
                levels: {
                    common: {
                        id: 'common',
                        label: 'Common',
                        words: [{ id: 'spoon', english: 'spoon', portuguese: 'colher' }]
                    }
                }
            }
        },
        TopicMatchPairs: {
            prepare() { events.push(`prepare:match:${elements.get('topic-match-container').style.display}`); }
        },
        TopicSpeakGame: {
            prepare() { events.push(`prepare:speak:${elements.get('topic-speak-container').style.display}`); }
        },
        navigateTo(screen) {
            events.push(`navigate:${screen}`);
            if (screen === 'topicMatch') elements.get('topic-match-container').style.display = 'block';
            if (screen === 'topicSpeak') elements.get('topic-speak-container').style.display = 'block';
        },
        addEventListener() {},
        requestAnimationFrame() { return 1; },
        cancelAnimationFrame() {}
    };

    const source = fs.readFileSync(path.join(ROOT, 'js/topics/topics-menu.js'), 'utf8');
    vm.runInNewContext(source, { window, document, console: { error() {} }, Array });

    return { gameButtons, events };
}

test('Topics shows Match and Speak screens before preparing their Ready dialogs', () => {
    for (const [gameType, screen] of [['match', 'topicMatch'], ['speak', 'topicSpeak']]) {
        const harness = createTopicsMenuHarness();
        const button = harness.gameButtons.find((item) => item.dataset.topicGame === gameType);

        button.dispatch('click');

        assert.deepEqual(harness.events, [
            `navigate:${screen}`,
            `prepare:${gameType}:block`
        ]);
    }
});
