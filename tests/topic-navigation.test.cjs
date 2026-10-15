const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createMatchHarness() {
    const listeners = new Map();
    const windowListeners = new Map();
    const goBackCalls = [];
    const elements = new Map();
    let trapDialog;
    let trapOptions;
    let trapReleaseCount = 0;

    function element(id = '') {
        const attributes = new Map();
        const classes = new Set();
        const value = {
            id,
            textContent: '',
            dataset: {},
            style: {},
            classList: {
                add(...names) { names.forEach((name) => classes.add(name)); },
                remove(...names) { names.forEach((name) => classes.delete(name)); },
                contains(name) { return classes.has(name); }
            },
            addEventListener(event, callback) {
                listeners.set(`${id}:${event}`, callback);
            },
            getAttribute(name) { return attributes.get(name) ?? null; },
            setAttribute(name, value) { attributes.set(name, String(value)); },
            removeAttribute(name) { attributes.delete(name); },
            appendChild() {},
            append() {},
            insertBefore() {},
            querySelector() { return null; },
            visible: true,
            focusCallCount: 0,
            focus(options) {
                this.focusCallCount += 1;
                this.lastFocusOptions = options;
            },
            getClientRects() { return this.visible ? [{}] : []; },
            set innerHTML(value) { this._innerHTML = value; },
            get innerHTML() { return this._innerHTML || ''; }
        };
        return value;
    }

    [
        'topic-match-start-btn', 'topic-match-start-back-btn', 'topic-match-pairs-btn', 'topic-match-play-again',
        'topic-match-back-topic', 'back-from-topic-match', 'topic-match-start-overlay',
        'topic-match-review', 'topic-match-grid', 'topic-match-container',
        'topic-match-feedback', 'topic-match-title', 'topic-match-level',
        'topic-match-total', 'topic-match-count'
    ].forEach((id) => elements.set(id, element(id)));
    elements.get('topic-match-pairs-btn').visible = false;

    const dialog = element('topic-match-start-modal');
    elements.get('topic-match-start-overlay').querySelector = (selector) =>
        selector === '[role="dialog"]' ? dialog : null;
    elements.get('topic-match-container').querySelector = (selector) =>
        selector === '.topic-match-content' ? element('topic-match-content') : null;

    const window = {
        goBack(...args) { goBackCalls.push(args); },
        addEventListener(event, callback) {
            if (!windowListeners.has(event)) windowListeners.set(event, new Set());
            windowListeners.get(event).add(callback);
        },
        removeEventListener(event, callback) {
            windowListeners.get(event)?.delete(callback);
        },
        speechSynthesis: { cancel() {} },
        EnlKeyboardAccessibility: {
            trapDialogFocus(receivedDialog, options) {
                trapDialog = receivedDialog;
                trapOptions = options;
                return () => { trapReleaseCount += 1; };
            }
        }
    };
    const document = {
        getElementById(id) { return elements.get(id) || null; },
        querySelectorAll() { return []; },
        createElement() { return element(); }
    };
    const source = fs.readFileSync(path.join(ROOT, 'js/topics/match-pairs.js'), 'utf8');

    vm.runInNewContext(source, {
        window,
        document,
        clearTimeout() {},
        setTimeout() { return 1; }
    });

    return {
        api: window.TopicMatchPairs,
        elements,
        goBackCalls,
        listeners,
        dispatchWindowEvent(event) {
            [...(windowListeners.get(event) || [])].forEach((callback) => callback());
        },
        get trapDialog() { return trapDialog; },
        get trapOptions() { return trapOptions; },
        get trapReleaseCount() { return trapReleaseCount; }
    };
}

function prepareMatch(harness) {
    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects' },
        level: {
            id: 'common',
            label: 'Common',
            words: [{ id: 'spoon', english: 'spoon', portuguese: 'colher' }]
        }
    });
}

test('Ready dialog provides a working back button', () => {
    const harness = createMatchHarness();
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const startOverlay = html.split('<div id="topic-match-start-overlay"')[1]
        ?.split('<!-- TOPICS: SPEAK -->')[0] || '';

    assert.match(startOverlay, /role="dialog"[^>]*aria-modal="true"/);
    assert.ok(startOverlay.indexOf('role="dialog"') < startOverlay.indexOf('id="topic-match-start-back-btn"'));
    assert.ok(startOverlay.indexOf('id="topic-match-start-back-btn"') < startOverlay.indexOf('id="topic-match-start-btn"'));

    prepareMatch(harness);
    harness.listeners.get('topic-match-start-back-btn:click')();

    assert.deepEqual(harness.goBackCalls, [[]]);
    const returnButton = harness.elements.get('topic-match-pairs-btn');
    assert.equal(returnButton.focusCallCount, 0);
    returnButton.visible = true;
    harness.dispatchWindowEvent('popstate');
    assert.equal(returnButton.focusCallCount, 1);
    assert.equal(returnButton.lastFocusOptions?.preventScroll, true);
});

test('Ready dialog traps focus on Start and Escape returns to the previous menu', () => {
    const harness = createMatchHarness();
    prepareMatch(harness);

    assert.ok(harness.trapDialog);
    assert.equal(harness.trapOptions.initialFocus, harness.elements.get('topic-match-start-btn'));
    assert.equal(typeof harness.trapOptions.onEscape, 'function');
    assert.equal(harness.elements.get('topic-match-start-overlay').getAttribute('aria-hidden'), 'false');

    harness.trapOptions.onEscape();

    assert.deepEqual(harness.goBackCalls, [[]]);
    assert.equal(harness.trapReleaseCount, 1);
    const returnButton = harness.elements.get('topic-match-pairs-btn');
    returnButton.visible = true;
    harness.dispatchWindowEvent('popstate');
    assert.equal(returnButton.focusCallCount, 1);
});

test('Match review returns to its topic with one two-screen navigation', () => {
    const harness = createMatchHarness();
    harness.listeners.get('topic-match-back-topic:click')();

    assert.deepEqual(harness.goBackCalls, [[2]]);
});
