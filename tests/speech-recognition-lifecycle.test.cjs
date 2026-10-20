const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createSpeechHarness() {
    const elements = new Map();
    const documentListeners = new Map();
    const windowListeners = new Map();
    const timers = new Map();
    const recognitionInstances = [];
    let now = 1000;
    let nextTimerId = 1;
    let focused = true;
    let visibilityState = 'visible';
    const spokenTexts = [];

    function createElement(id = '') {
        const attributes = new Map();
        const classes = new Set();
        const listeners = new Map();
        const styleProperties = new Map();
        return {
            id,
            textContent: '',
            dataset: {},
            style: { setProperty(name, value) { styleProperties.set(name, value); } },
            classList: {
                add(...names) { names.forEach((name) => classes.add(name)); },
                remove(...names) { names.forEach((name) => classes.delete(name)); },
                contains(name) { return classes.has(name); },
                toggle(name, force) {
                    const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
                    if (shouldAdd) classes.add(name);
                    else classes.delete(name);
                    return shouldAdd;
                }
            },
            addEventListener(event, callback) { listeners.set(event, callback); },
            removeEventListener(event) { listeners.delete(event); },
            dispatch(event, value = {}) { listeners.get(event)?.({ target: this, ...value }); },
            getAttribute(name) { return attributes.get(name) ?? null; },
            setAttribute(name, value) { attributes.set(name, String(value)); },
            removeAttribute(name) { attributes.delete(name); },
            appendChild() {},
            append() {},
            insertBefore() {},
            querySelector() { return null; },
            focus() {},
            hidden: false,
            disabled: false,
            checked: false,
            value: '',
            get innerHTML() { return this._innerHTML || ''; },
            set innerHTML(value) { this._innerHTML = value; }
        };
    }

    const allIds = [
        'topic-speak-start-overlay', 'topic-speak-start-btn', 'topic-speak-start-back-btn',
        'topic-speak-mic', 'topic-speak-mic-label', 'topic-speak-reveal', 'topic-speak-audio',
        'topic-speak-play-again', 'topic-speak-back-topic', 'back-from-topic-speak',
        'topic-speak-preview-audio', 'topic-speak-settings-btn', 'topic-speak-settings-close',
        'topic-speak-settings-overlay', 'topic-speak-preaudio-toggle', 'topic-speak-voice-volume',
        'topic-speak-voice-volume-value', 'topic-speak-voice-volume-icon', 'topic-speak-sfx-volume',
        'topic-speak-sfx-volume-value', 'topic-speak-sfx-volume-icon', 'topic-speak-title',
        'topic-speak-level', 'topic-speak-current', 'topic-speak-total', 'topic-speak-portuguese',
        'topic-speak-result', 'topic-speak-result-icon', 'topic-speak-result-title',
        'topic-speak-answer', 'topic-speak-heard', 'topic-speak-transcript', 'topic-speak-status',
        'topic-speak-unsupported', 'topic-speak-fallback-title', 'topic-speak-fallback-text',
        'topic-speak-review', 'topic-speak-review-list', 'topic-speak-play-area', 'topic-speak-container'
    ];
    allIds.forEach((id) => elements.set(id, createElement(id)));

    class FakeRecognition {
        constructor() {
            this.startCalls = 0;
            this.abortCalls = 0;
            recognitionInstances.push(this);
        }
        start() { this.startCalls += 1; }
        abort() { this.abortCalls += 1; }
        emitStart() { this.onstart?.(); }
        emitEnd() { this.onend?.(); }
        emitError(error) { this.onerror?.({ error }); }
        emitResult(alternatives) {
            const result = alternatives.map((transcript) => ({ transcript }));
            result.isFinal = true;
            this.onresult?.({ resultIndex: 0, results: [result] });
        }
    }

    function setTimer(callback, delay = 0) {
        const id = nextTimerId++;
        timers.set(id, { callback, at: now + Math.max(0, Number(delay) || 0) });
        return id;
    }

    function clearTimer(id) { timers.delete(id); }

    function advanceBy(milliseconds) {
        const target = now + milliseconds;
        while (true) {
            const due = [...timers.entries()]
                .filter(([, timer]) => timer.at <= target)
                .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (!due) break;
            const [id, timer] = due;
            timers.delete(id);
            now = timer.at;
            timer.callback();
        }
        now = target;
    }

    const fakeDate = class extends Date {
        static now() { return now; }
    };
    const speechSynthesis = {
        cancel() {},
      speak(utterance) { spokenTexts.push(utterance.text); },
        resume() {},
        getVoices() { return []; }
    };
    const window = {
        SpeechRecognition: FakeRecognition,
        SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
        speechSynthesis,
        EnglishNextLevelAudio: {
            getVoiceVolume() { return 100; },
            getSfxVolume() { return 100; },
            playSfx() {},
            unlockSfx() {}
        },
        sessionStorage: { getItem() { return null; }, setItem() {} },
        setTimeout: setTimer,
        clearTimeout: clearTimer,
        addEventListener(event, callback) {
            if (!windowListeners.has(event)) windowListeners.set(event, new Set());
            windowListeners.get(event).add(callback);
        },
        dispatchEvent(event) {
            [...(windowListeners.get(event) || [])].forEach((callback) => callback());
        },
        matchMedia() { return { matches: false }; }
    };
    const document = {
        get visibilityState() { return visibilityState; },
        set visibilityState(value) { visibilityState = value; },
        hasFocus() { return focused; },
        getElementById(id) { return elements.get(id) || null; },
        createElement() { return createElement(); },
        querySelectorAll() { return []; },
        addEventListener(event, callback) {
            if (!documentListeners.has(event)) documentListeners.set(event, new Set());
            documentListeners.get(event).add(callback);
        },
        dispatchEvent(event, value = {}) {
            [...(documentListeners.get(event) || [])].forEach((callback) => callback(value));
        }
    };

    const context = {
        window,
        document,
        Date: fakeDate,
        Math,
        SpeechSynthesisUtterance: window.SpeechSynthesisUtterance,
        TopicSpeakAnswer: null,
        TopicSpeakAudio: null,
        TopicSpeakSettings: null,
        TopicSpeakRecognition: null,
        console: { warn() {}, error() {} }
    };
    const answerSource = fs.readFileSync(path.join(ROOT, 'js/topics/speech-answer.js'), 'utf8');
    const audioSource = fs.readFileSync(path.join(ROOT, 'js/topics/speech-audio.js'), 'utf8');
    const settingsSource = fs.readFileSync(path.join(ROOT, 'js/topics/speech-settings.js'), 'utf8');
    const recognitionSource = fs.readFileSync(path.join(ROOT, 'js/topics/speech-recognition.js'), 'utf8');
    const lifecycleSource = fs.readFileSync(path.join(ROOT, 'js/topics/speech-page-lifecycle.js'), 'utf8');
    const gameSource = fs.readFileSync(path.join(ROOT, 'js/topics/speech-game.js'), 'utf8');
    vm.runInNewContext(answerSource, context, { filename: 'js/topics/speech-answer.js' });
    vm.runInNewContext(audioSource, context, { filename: 'js/topics/speech-audio.js' });
    vm.runInNewContext(settingsSource, context, { filename: 'js/topics/speech-settings.js' });
    vm.runInNewContext(recognitionSource, context, { filename: 'js/topics/speech-recognition.js' });
    vm.runInNewContext(lifecycleSource, context, { filename: 'js/topics/speech-page-lifecycle.js' });
    vm.runInNewContext(gameSource, context, { filename: 'js/topics/speech-game.js' });

    return {
        api: window.TopicSpeakGame,
        elements,
        recognitionInstances,
        timers,
      spokenTexts,
        advanceBy,
        setFocused(value) { focused = value; },
        setVisibilityState(value) { visibilityState = value; },
        dispatchWindowEvent: window.dispatchEvent,
        dispatchDocumentEvent: document.dispatchEvent
    };
}

function startOneWordRound(harness, english = 'grater') {
    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects', englishVariant: 'en-US' },
        level: {
            id: 'common',
            label: 'Common',
            words: [{ id: english, english, portuguese: 'ralador' }]
        }
    });
    harness.elements.get('topic-speak-start-btn').dispatch('click');
    const recognition = harness.recognitionInstances[0];
    recognition.emitStart();
    harness.advanceBy(400);
    return recognition;
}

test('Speak ignores lower-ranked transcript alternatives and displays the checked answer', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);

    recognition.emitResult(['gratitude', 'grater']);

    assert.equal(harness.elements.get('topic-speak-transcript').textContent, 'gratitude');
    assert.equal(harness.elements.get('topic-speak-result').hidden, true);
    assert.match(harness.elements.get('topic-speak-status').textContent, /Not quite/);
});

test('Speak shows a correct recognized word through the game result flow', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);

    recognition.emitResult(['grater']);

    assert.equal(harness.elements.get('topic-speak-transcript').textContent, 'grater');
    assert.equal(harness.elements.get('topic-speak-result').hidden, false);
    assert.match(harness.elements.get('topic-speak-status').textContent, /Correct/);
});

test('Speak does not start a delayed correct-answer pronunciation after leaving', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);
    const spokenBeforeAnswer = harness.spokenTexts.length;

    recognition.emitResult(['grater']);
    harness.advanceBy(179);
    harness.api.leaveGame();
    harness.advanceBy(1);

    assert.equal(harness.spokenTexts.length, spokenBeforeAnswer);
});

test('Speak does not start a delayed revealed-answer pronunciation after leaving', () => {
    const harness = createSpeechHarness();
    startOneWordRound(harness);
    const spokenBeforeReveal = harness.spokenTexts.length;

    harness.elements.get('topic-speak-reveal').dispatch('click');
    harness.advanceBy(179);
    harness.api.leaveGame();
    harness.advanceBy(1);

    assert.equal(harness.spokenTexts.length, spokenBeforeReveal);
});

test('Speak cancels a delayed pronunciation when the page becomes hidden', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);
    const spokenBeforeAnswer = harness.spokenTexts.length;

    recognition.emitResult(['grater']);
    harness.advanceBy(179);
    harness.setVisibilityState('hidden');
    harness.dispatchDocumentEvent('visibilitychange');
    harness.advanceBy(1);

    assert.equal(harness.spokenTexts.length, spokenBeforeAnswer);
});

test('Speak cancels a delayed revealed-answer pronunciation when Settings opens', () => {
    const harness = createSpeechHarness();
    startOneWordRound(harness);
    const spokenBeforeReveal = harness.spokenTexts.length;

    harness.elements.get('topic-speak-reveal').dispatch('click');
    harness.advanceBy(179);
    harness.elements.get('topic-speak-settings-btn').dispatch('click');
    harness.advanceBy(1);

    assert.equal(harness.spokenTexts.length, spokenBeforeReveal);
});

test('Speak resumes accepting answers after Settings closes during an active round', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);

    harness.elements.get('topic-speak-settings-btn').dispatch('click');
    harness.elements.get('topic-speak-settings-close').dispatch('click');
    harness.advanceBy(250);
    harness.advanceBy(221);
    recognition.emitResult(['grater']);

    assert.equal(harness.elements.get('topic-speak-result').hidden, false);
    assert.match(harness.elements.get('topic-speak-status').textContent, /Correct/);
});

test('index loads Speak dependencies before the Speak game', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const answerScript = html.indexOf('<script src="js/topics/speech-answer.js"></script>');
    const audioScript = html.indexOf('<script src="js/topics/speech-audio.js"></script>');
    const settingsScript = html.indexOf('<script src="js/topics/speech-settings.js"></script>');
    const recognitionScript = html.indexOf('<script src="js/topics/speech-recognition.js"></script>');
    const lifecycleScript = html.indexOf('<script src="js/topics/speech-page-lifecycle.js"></script>');
    const speechGameScript = html.indexOf('<script src="js/topics/speech-game.js"></script>');

    assert.notEqual(answerScript, -1);
    assert.notEqual(audioScript, -1);
    assert.notEqual(settingsScript, -1);
    assert.notEqual(recognitionScript, -1);
    assert.notEqual(lifecycleScript, -1);
    assert.notEqual(speechGameScript, -1);
    assert.ok(answerScript < speechGameScript);
    assert.ok(audioScript < speechGameScript);
    assert.ok(settingsScript < speechGameScript);
    assert.ok(recognitionScript < speechGameScript);
    assert.ok(lifecycleScript < speechGameScript);
});

test('pause and resume keep the same browser recognition session', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);
    const mic = harness.elements.get('topic-speak-mic');

    mic.dispatch('click');
    assert.equal(recognition.startCalls, 1);
    assert.equal(recognition.abortCalls, 0);
    assert.equal(harness.recognitionInstances.length, 1);
    assert.equal(harness.recognitionInstances.reduce((total, instance) => total + instance.startCalls, 0), 1);

    mic.dispatch('click');
    assert.equal(recognition.startCalls, 1);
    assert.equal(recognition.abortCalls, 0);
    assert.equal(harness.recognitionInstances.length, 1);
    assert.equal(harness.recognitionInstances.reduce((total, instance) => total + instance.startCalls, 0), 1);
});

test('hidden page suspends recognition and visible focus resumes it once', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);

    harness.setVisibilityState('hidden');
    harness.dispatchDocumentEvent('visibilitychange');
    assert.equal(recognition.abortCalls, 1);

    recognition.emitEnd();
    assert.equal(harness.timers.size, 0);

    harness.setVisibilityState('visible');
    harness.setFocused(true);
    harness.dispatchDocumentEvent('visibilitychange');
    assert.equal(recognition.startCalls, 2);
});

test('temporary blur while the browser permission prompt is pending does not abort recognition', () => {
    const harness = createSpeechHarness();
    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects', englishVariant: 'en-US' },
        level: {
            id: 'common',
            label: 'Common',
            words: [{ id: 'grater', english: 'grater', portuguese: 'ralador' }]
        }
    });
    harness.elements.get('topic-speak-start-btn').dispatch('click');
    const recognition = harness.recognitionInstances[0];

    harness.setFocused(false);
    harness.dispatchWindowEvent('blur');
    harness.advanceBy(350);
    assert.equal(recognition.abortCalls, 0);
    assert.equal(harness.timers.size, 1);

    recognition.emitStart();
    harness.setFocused(true);
    harness.dispatchWindowEvent('focus');
    assert.equal(recognition.abortCalls, 0);
    assert.equal(recognition.startCalls, 1);
});

test('persistent blur suspends recognition after the permission prompt grace period', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);

    harness.setFocused(false);
    harness.dispatchWindowEvent('blur');
    harness.advanceBy(350);
    assert.equal(recognition.abortCalls, 0);

    harness.advanceBy(350);
    assert.equal(recognition.abortCalls, 1);
});

test('pagehide, beforeunload, and freeze each suspend recognition immediately', () => {
    const lifecycleEvents = [
        ['window', 'pagehide'],
        ['window', 'beforeunload'],
        ['document', 'freeze']
    ];

    for (const [target, event] of lifecycleEvents) {
        const harness = createSpeechHarness();
        const recognition = startOneWordRound(harness);
        harness.setFocused(false);
        harness.dispatchWindowEvent('blur');
        assert.ok(harness.timers.size > 0, 'blur must schedule a pending lifecycle check');

        if (target === 'window') harness.dispatchWindowEvent(event);
        else harness.dispatchDocumentEvent(event);

        assert.equal(recognition.abortCalls, 1, `${event} must abort active recognition`);
        assert.equal(harness.timers.size, 0, `${event} must clear lifecycle timers`);
    }
});

test('permission errors block automatic restart while temporary errors retry', () => {
    const blocked = createSpeechHarness();
    const blockedRecognition = startOneWordRound(blocked);
    blockedRecognition.emitError('not-allowed');
    blockedRecognition.emitEnd();
    blocked.advanceBy(1000);
    assert.equal(blockedRecognition.startCalls, 1);
    assert.equal(blocked.elements.get('topic-speak-mic').hidden, true);

    const retry = createSpeechHarness();
    const retryRecognition = startOneWordRound(retry);
    retryRecognition.emitError('no-speech');
    retryRecognition.emitEnd();
    retry.advanceBy(260);
    assert.equal(retryRecognition.startCalls, 2);
});
