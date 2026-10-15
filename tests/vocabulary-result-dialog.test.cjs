const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/vocabulary-result-dialog.js');

function createHarness({ gameType = 'present', inWordsGame = true, startOverlayActive = false } = {}) {
    let wordsGameActive = inWordsGame;
    const classes = new Set();
    const bodyClasses = new Set();
    const listeners = new Map();
    const timers = new Map();
    const clearedTimers = [];
    let nextTimerId = 0;
    let focusCount = 0;
    const values = { matches: '', score: '', time: '', subtitle: '' };
    const overlay = {
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); }
        },
        setAttribute(name, value) { this[name] = String(value); }
    };
    const body = {
        classList: {
            add(name) { bodyClasses.add(name); },
            remove(name) { bodyClasses.delete(name); },
            contains(name) { return bodyClasses.has(name); }
        }
    };
    const button = (id) => ({
        addEventListener(type, handler) { listeners.set(`${id}:${type}`, handler); },
        focus() { focusCount += 1; }
    });
    const replayButton = button('replay');
    const backButton = button('back');
    const harness = {
        body,
        classes,
        bodyClasses,
        clearedTimers,
        focusCount: () => focusCount,
        listeners,
        overlay,
        replayButton,
        backButton,
        timers,
        values
    };
    const dialog = create({
        body,
        overlay,
        subtitle: { set textContent(value) { values.subtitle = value; } },
        matches: { set textContent(value) { values.matches = value; } },
        score: { set textContent(value) { values.score = value; } },
        time: { set textContent(value) { values.time = value; } },
        replayButton,
        backButton,
        getIsWordsGameScreen: () => wordsGameActive,
        getIsStartOverlayActive: () => startOverlayActive,
        getMatchesCount: () => 10,
        getWordCount: () => 10,
        getScore: () => 1234,
        getElapsedSeconds: () => 61,
        getGameType: () => gameType,
        formatTime: (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`,
        scheduleFrame(callback) { callback(); },
        setTimeoutFn(callback, delay) {
            const id = nextTimerId++;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeoutFn(id) {
            clearedTimers.push(id);
            timers.delete(id);
        },
        onReplay() { harness.replayed = true; },
        onBack() { harness.wentBack = true; }
    });
    harness.dialog = dialog;
    harness.setWordsGameActive = (active) => { wordsGameActive = active; };
    return harness;
}

test('result dialog shows the present mode result, opens focus, and hides cleanly', () => {
    const harness = createHarness();

    assert.equal(harness.dialog.show(), true);
    assert.equal(harness.values.matches, '10/10');
    assert.equal(harness.values.score, '1,234');
    assert.equal(harness.values.time, '01:01');
    assert.equal(harness.values.subtitle, 'You matched every English verb with its Portuguese meaning.');
    assert.equal(harness.classes.has('active'), true);
    assert.equal(harness.overlay['aria-hidden'], 'false');
    assert.equal(harness.bodyClasses.has('vocab-modal-open'), true);
    assert.equal(harness.focusCount(), 1);

    assert.equal(harness.dialog.hide(), true);
    assert.equal(harness.classes.has('active'), false);
    assert.equal(harness.overlay['aria-hidden'], 'true');
    assert.equal(harness.bodyClasses.has('vocab-modal-open'), false);
});

test('result dialog uses the simple-past message and leaves the start overlay body lock alone', () => {
    const harness = createHarness({ gameType: 'past', startOverlayActive: true });
    harness.dialog.show();
    harness.dialog.hide();

    assert.equal(harness.values.subtitle, 'You matched every present verb with its simple past form.');
    assert.equal(harness.bodyClasses.has('vocab-modal-open'), true);
});

test('result dialog refuses to open outside Words and cancels an older queued result', () => {
    const harness = createHarness({ inWordsGame: false });
    assert.equal(harness.dialog.show(), false);
    assert.equal(harness.classes.has('active'), false);

    harness.dialog.queue();
    assert.equal(harness.timers.get(0).delay, 650);
    harness.dialog.queue();
    assert.deepEqual(harness.clearedTimers, [0]);
    assert.equal(harness.timers.has(1), true);
    assert.equal(harness.dialog.cancel(), true);
    assert.deepEqual(harness.clearedTimers, [0, 1]);
    assert.equal(harness.dialog.cancel(), false);
});

test('result dialog replay and back buttons hide the result and call their owners', () => {
    const harness = createHarness();
    harness.dialog.show();
    harness.listeners.get('replay:click')();
    assert.equal(harness.replayed, true);
    assert.equal(harness.classes.has('active'), false);

    harness.dialog.show();
    harness.listeners.get('back:click')();
    assert.equal(harness.wentBack, true);
    assert.equal(harness.classes.has('active'), false);
});

test('queued result opens after the delay while Words remains active', () => {
    const harness = createHarness();
    harness.dialog.queue();
    harness.timers.get(0).callback();

    assert.equal(harness.classes.has('active'), true);
    assert.equal(harness.values.matches, '10/10');
});

test('queued result does not open if navigation leaves Words before the delay ends', () => {
    const harness = createHarness();
    harness.dialog.queue();
    harness.setWordsGameActive(false);
    harness.timers.get(0).callback();

    assert.equal(harness.classes.has('active'), false);
    assert.equal(harness.focusCount(), 0);
});
