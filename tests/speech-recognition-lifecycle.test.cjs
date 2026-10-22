const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createSpeechHarness({ userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36' } = {}) {
    const elements = new Map();
    const documentListeners = new Map();
    const windowListeners = new Map();
    const timers = new Map();
    const recognitionInstances = [];
    const focusTrapCalls = [];
    const goBackCalls = [];
    let focusTrapReleaseCount = 0;
    let now = 1000;
    let nextTimerId = 1;
    let focused = true;
    let visibilityState = 'visible';
    const spokenTexts = [];
    const mediaRequests = [];

    function createElement(id = '', tagName = 'div') {
        const attributes = new Map();
        const classes = new Set();
        const listeners = new Map();
        const styleProperties = new Map();
        return {
            id,
            tagName,
            children: [],
            options: [],
            textContent: '',
            dataset: {},
            visible: true,
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
            dispatch(event, value = {}) { return listeners.get(event)?.({ target: this, ...value }); },
            getAttribute(name) { return attributes.get(name) ?? null; },
            setAttribute(name, value) { attributes.set(name, String(value)); },
            removeAttribute(name) { attributes.delete(name); },
            focusCount: 0,
            focus(options) { this.focusCount += 1; this.lastFocusOptions = options; },
            getClientRects() { return this.visible ? [{}] : []; },
            appendChild(child) { this.children.push(child); if (this.tagName === 'select') this.options = this.children; },
            append() {},
            insertBefore() {},
            querySelector(selector) {
                if (id === 'topic-speak-start-overlay' && selector === '[role="dialog"]') {
                    return elements.get('topic-speak-start-dialog') || null;
                }
                if (id === 'topic-speak-settings-overlay' && selector === '[role="dialog"]') {
                    return elements.get('topic-speak-settings-dialog') || null;
                }
                if (id === 'topic-speak-review' && selector === '.topic-review-audio') {
                    return elements.get('topic-speak-review-first-audio') || null;
                }
                return null;
            },
            scrollIntoView(options) { this.lastScrollOptions = options; },
            hidden: false,
            disabled: false,
            checked: false,
            value: '',
            get innerHTML() { return this._innerHTML || ''; },
            set innerHTML(value) { this._innerHTML = value; }
        };
    }

    const allIds = [
        'topic-speak-start-overlay', 'topic-speak-start-dialog', 'topic-speak-start-btn', 'topic-speak-start-back-btn',
        'topic-speak-btn',
        'topic-speak-mic', 'topic-speak-mic-label', 'topic-speak-reveal', 'topic-speak-audio',
        'topic-speak-type-toggle', 'topic-speak-type-form', 'topic-speak-type-input', 'topic-speak-type-submit',
        'topic-speak-play-again', 'topic-speak-back-topic', 'back-from-topic-speak',
        'topic-speak-preview-audio', 'topic-speak-settings-btn', 'topic-speak-settings-close',
        'topic-speak-settings-overlay', 'topic-speak-settings-dialog', 'topic-speak-preaudio-toggle', 'topic-speak-voice-volume',
        'topic-speak-voice-volume-value', 'topic-speak-voice-volume-icon', 'topic-speak-sfx-volume',
        'topic-speak-sfx-volume-value', 'topic-speak-sfx-volume-icon', 'topic-speak-title',
        'topic-speak-level', 'topic-speak-current', 'topic-speak-total', 'topic-speak-portuguese',
        'topic-speak-result', 'topic-speak-result-icon', 'topic-speak-result-title',
        'topic-speak-answer', 'topic-speak-heard', 'topic-speak-heard-label', 'topic-speak-transcript', 'topic-speak-status',
        'topic-speak-unsupported', 'topic-speak-fallback-title', 'topic-speak-fallback-text',
        'topic-speak-mic-choice', 'topic-speak-mic-device-note', 'topic-speak-mic-select', 'topic-speak-mic-refresh', 'topic-speak-mic-choice-status',
        'topic-speak-review', 'topic-speak-review-list', 'topic-speak-review-first-audio',
        'topic-speak-play-area', 'topic-speak-container'
    ];
    allIds.forEach((id) => elements.set(id, createElement(id)));
    elements.get('topic-speak-mic-select').tagName = 'select';
    elements.get('topic-speak-btn').visible = false;

    class FakeRecognition {
        constructor() {
            this.startCalls = 0;
            this.abortCalls = 0;
            this.phrases = [];
            recognitionInstances.push(this);
        }
        start(track) { this.startCalls += 1; if (track) this.startTracks = [...(this.startTracks || []), track]; }
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
    const storage = new Map();
    const mediaDevices = {
        async getUserMedia(constraints) {
            mediaRequests.push(constraints);
            const track = {
                kind: 'audio',
                readyState: 'live',
                deviceId: constraints.audio?.deviceId?.exact || 'default-mic',
                stop() { this.readyState = 'ended'; }
            };
            return { getAudioTracks() { return [track]; }, getTracks() { return [track]; } };
        },
        async enumerateDevices() {
            return [
                { kind: 'audioinput', deviceId: 'built-in-mic', label: 'Built-in microphone' },
                { kind: 'audioinput', deviceId: 'headset-mic', label: 'Bluetooth headset microphone' }
            ];
        }
    };
    const speechSynthesis = {
        cancel() {},
      speak(utterance) { spokenTexts.push(utterance.text); },
        resume() {},
        getVoices() { return []; }
    };
    class FakeSpeechRecognitionPhrase {
        constructor(phrase, boost) {
            this.phrase = phrase;
            this.boost = boost;
        }
    }
    const window = {
        navigator: { userAgent, mediaDevices },
        SpeechRecognition: FakeRecognition,
        SpeechRecognitionPhrase: FakeSpeechRecognitionPhrase,
        SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
        speechSynthesis,
        EnglishNextLevelAudio: {
            getVoiceVolume() { return 100; },
            getSfxVolume() { return 100; },
            playSfx() {},
            unlockSfx() {}
        },
        sessionStorage: {
            getItem(key) { return storage.get(key) || null; },
            setItem(key, value) { storage.set(key, value); },
            removeItem(key) { storage.delete(key); }
        },
        EnlKeyboardAccessibility: {
            trapDialogFocus(dialog, options) {
                focusTrapCalls.push({ dialog, options });
                options.initialFocus?.focus();
                let released = false;
                return () => {
                    if (released) return;
                    released = true;
                    focusTrapReleaseCount += 1;
                };
            }
        },
        goBack(...args) {
            goBackCalls.push(args);
            return true;
        },
        setTimeout: setTimer,
        clearTimeout: clearTimer,
        addEventListener(event, callback) {
            if (!windowListeners.has(event)) windowListeners.set(event, new Set());
            windowListeners.get(event).add(callback);
        },
        removeEventListener(event, callback) { windowListeners.get(event)?.delete(callback); },
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
        createElement(tagName) { return createElement('', tagName); },
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
        focusTrapCalls,
        goBackCalls,
        focusTrapReleaseCount() { return focusTrapReleaseCount; },
        timers,
      spokenTexts,
        mediaRequests,
        mediaDevices,
        advanceBy,
        setFocused(value) { focused = value; },
        setVisibilityState(value) { visibilityState = value; },
        dispatchWindowEvent: window.dispatchEvent,
        dispatchDocumentEvent: document.dispatchEvent
    };
}

test('Speak focuses START and traps keyboard focus in the Ready dialog', () => {
    const harness = createSpeechHarness();

    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects', englishVariant: 'en-US' },
        level: {
            id: 'common',
            label: 'Common',
            words: [{ id: 'grater', english: 'grater', portuguese: 'ralador' }]
        }
    });

    const overlay = harness.elements.get('topic-speak-start-overlay');
    const startButton = harness.elements.get('topic-speak-start-btn');
    assert.equal(overlay.getAttribute('aria-hidden'), 'false');
    assert.equal(overlay.classList.contains('visible'), true);
    assert.equal(harness.focusTrapCalls.length, 1);
    assert.strictEqual(harness.focusTrapCalls[0].dialog, harness.elements.get('topic-speak-start-dialog'));
    assert.strictEqual(harness.focusTrapCalls[0].options.initialFocus, startButton);
    assert.equal(startButton.focusCount, 1);
});

test('Speak releases the Ready dialog focus trap when START begins the round', () => {
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

    assert.equal(harness.elements.get('topic-speak-start-overlay').getAttribute('aria-hidden'), 'true');
    assert.equal(harness.focusTrapReleaseCount(), 1);
});

test('Escape from the Speak Ready dialog returns to the previous menu', () => {
    const harness = createSpeechHarness();

    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects', englishVariant: 'en-US' },
        level: {
            id: 'common',
            label: 'Common',
            words: [{ id: 'grater', english: 'grater', portuguese: 'ralador' }]
        }
    });
    harness.focusTrapCalls[0].options.onEscape();

    assert.equal(harness.elements.get('topic-speak-start-overlay').getAttribute('aria-hidden'), 'true');
    assert.equal(harness.focusTrapReleaseCount(), 1);
    assert.deepEqual(harness.goBackCalls, [[]]);
    const returnButton = harness.elements.get('topic-speak-btn');
    assert.equal(returnButton.focusCount, 0);
    returnButton.visible = true;
    harness.dispatchWindowEvent('popstate');
    assert.equal(returnButton.focusCount, 1);
});

test('Speak restores menu focus after browser or device Back leaves the Ready screen', () => {
    const harness = createSpeechHarness();

    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects', englishVariant: 'en-US' },
        level: {
            id: 'common',
            label: 'Common',
            words: [{ id: 'grater', english: 'grater', portuguese: 'ralador' }]
        }
    });
    harness.api.leaveGame();
    harness.elements.get('topic-speak-btn').visible = true;
    harness.dispatchWindowEvent('popstate');

    assert.equal(harness.elements.get('topic-speak-start-overlay').getAttribute('aria-hidden'), 'true');
    assert.equal(harness.focusTrapReleaseCount(), 1);
    assert.equal(harness.elements.get('topic-speak-btn').focusCount, 1);
});

test('Speak removes the return-focus listener when the first back destination stays hidden', () => {
    const harness = createSpeechHarness();

    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects', englishVariant: 'en-US' },
        level: {
            id: 'common',
            label: 'Common',
            words: [{ id: 'grater', english: 'grater', portuguese: 'ralador' }]
        }
    });
    harness.api.leaveGame();
    harness.dispatchWindowEvent('popstate');
    harness.elements.get('topic-speak-btn').visible = true;
    harness.dispatchWindowEvent('popstate');

    assert.equal(harness.elements.get('topic-speak-btn').focusCount, 0);
});

function startOneWordRound(harness, english = 'grater') {
    const word = typeof english === 'string'
        ? { id: english, english, portuguese: 'ralador' }
        : english;
    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects', englishVariant: 'en-US' },
        level: {
            id: 'common',
            label: 'Common',
            words: [word]
        }
    });
    harness.elements.get('topic-speak-start-btn').dispatch('click');
    const recognition = harness.recognitionInstances[0];
    recognition.emitStart();
    harness.advanceBy(400);
    return recognition;
}

test('Speak keeps Type Answer available after advancing to the second word', () => {
    const harness = createSpeechHarness();
    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects', englishVariant: 'en-US' },
        level: {
            id: 'common',
            label: 'Common',
            words: [
                { id: 'grater', english: 'grater', portuguese: 'ralador' },
                { id: 'ladle', english: 'ladle', portuguese: 'concha' }
            ]
        }
    });
    harness.elements.get('topic-speak-start-btn').dispatch('click');

    const typeAnswer = harness.elements.get('topic-speak-type-toggle');
    assert.equal(typeAnswer.hidden, false);

    harness.elements.get('topic-speak-reveal').dispatch('click');
    harness.advanceBy(3200);

    assert.equal(harness.elements.get('topic-speak-portuguese').textContent, 'concha');
    assert.equal(typeAnswer.hidden, false);
    assert.equal(typeAnswer.disabled, false);
});

test('Speak checks lower-ranked alternatives and displays the canonical answer', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness, {
        id: 'grater',
        english: 'grater',
        portuguese: 'ralador',
        recognitionAliases: ['greater']
    });

    recognition.emitResult(['gratitude', 'greater']);

    assert.equal(harness.elements.get('topic-speak-transcript').textContent, 'grater');
    assert.equal(harness.elements.get('topic-speak-heard-label').textContent, 'Correct word');
    assert.equal(harness.elements.get('topic-speak-result').hidden, false);
    assert.match(harness.elements.get('topic-speak-status').textContent, /Correct/);
});

test('Speak shows the corrected word for a curated speech-recognition alias', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness, {
        id: 'ladle',
        english: 'ladle',
        portuguese: 'concha',
        recognitionAliases: ['ledo']
    });

    recognition.emitResult(['Ledo']);

    assert.equal(harness.elements.get('topic-speak-transcript').textContent, 'ladle');
    assert.equal(harness.elements.get('topic-speak-heard-label').textContent, 'Correct word');
    assert.equal(harness.elements.get('topic-speak-result').hidden, false);
});

test('Speak shows a correct recognized word through the game result flow', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);

    recognition.emitResult(['grater']);

    assert.equal(harness.elements.get('topic-speak-transcript').textContent, 'grater');
    assert.equal(harness.elements.get('topic-speak-heard-label').textContent, 'I heard');
    assert.equal(harness.elements.get('topic-speak-result').hidden, false);
    assert.match(harness.elements.get('topic-speak-status').textContent, /Correct/);
});

test('Speak can retry when a call or another app temporarily holds the microphone', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);

    recognition.emitError('audio-capture');
    recognition.emitEnd();

    assert.equal(harness.elements.get('topic-speak-mic').hidden, false);
    assert.equal(harness.elements.get('topic-speak-mic').disabled, false);
    assert.match(harness.elements.get('topic-speak-status').textContent, /Microphone is busy or unavailable/);

    harness.elements.get('topic-speak-mic').dispatch('click');
    assert.equal(recognition.startCalls, 2);
});

test('Speak lists and uses a selected microphone in compatible desktop browsers', async () => {
    const harness = createSpeechHarness();
    const micChoice = harness.elements.get('topic-speak-mic-choice');
    const select = harness.elements.get('topic-speak-mic-select');
    const refresh = harness.elements.get('topic-speak-mic-refresh');

    assert.equal(micChoice.hidden, false);
    await refresh.dispatch('click');

    assert.equal(select.disabled, false);
    assert.deepEqual(select.options.map(({ value, textContent }) => ({ value, textContent })), [
        { value: '', textContent: 'Use device default' },
        { value: 'built-in-mic', textContent: 'Built-in microphone' },
        { value: 'headset-mic', textContent: 'Bluetooth headset microphone' }
    ]);

    select.value = 'headset-mic';
    select.dispatch('change');
    harness.api.prepare({
        topic: { id: 'kitchen', title: 'Kitchen Objects', englishVariant: 'en-US' },
        level: { id: 'common', label: 'Common', words: [{ id: 'grater', english: 'grater', portuguese: 'ralador' }] }
    });
    harness.elements.get('topic-speak-start-btn').dispatch('click');
    await new Promise((resolve) => setImmediate(resolve));

    const recognition = harness.recognitionInstances[0];
    assert.equal(recognition.startCalls, 1);
    assert.equal(recognition.startTracks[0].deviceId, 'headset-mic');
    assert.deepEqual(JSON.parse(JSON.stringify(harness.mediaRequests.at(-1).audio.deviceId)), { exact: 'headset-mic' });
});

test('Speak explains that mobile browsers use the device microphone route', () => {
    const harness = createSpeechHarness({
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'
    });

    assert.equal(harness.elements.get('topic-speak-mic-choice').hidden, true);
    assert.equal(harness.elements.get('topic-speak-mic-device-note').hidden, false);
});

test('Speak lets a student type an answer when the call holds the microphone', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness);
    const toggle = harness.elements.get('topic-speak-type-toggle');
    const form = harness.elements.get('topic-speak-type-form');
    const input = harness.elements.get('topic-speak-type-input');

    recognition.emitError('audio-capture');
    recognition.emitEnd();
    assert.match(harness.elements.get('topic-speak-status').textContent, /Type your answer/);

    toggle.dispatch('click');
    assert.equal(form.hidden, false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(input.focusCount, 1);

    input.value = 'grater';
    form.dispatch('submit', { preventDefault() {} });

    assert.equal(harness.elements.get('topic-speak-result').hidden, false);
    assert.equal(harness.elements.get('topic-speak-transcript').textContent, 'grater');
    assert.equal(form.hidden, true);
    assert.equal(toggle.hidden, true);
});

test('Speak keeps a typed wrong answer open for correction', () => {
    const harness = createSpeechHarness();
    startOneWordRound(harness);
    const toggle = harness.elements.get('topic-speak-type-toggle');
    const form = harness.elements.get('topic-speak-type-form');
    const input = harness.elements.get('topic-speak-type-input');

    toggle.dispatch('click');
    input.value = 'greater';
    form.dispatch('submit', { preventDefault() {} });
    assert.equal(form.hidden, false);
    assert.equal(harness.elements.get('topic-speak-result').hidden, true);
    assert.equal(harness.elements.get('topic-speak-transcript').textContent, 'greater');

    input.value = 'grater';
    form.dispatch('submit', { preventDefault() {} });
    assert.equal(harness.elements.get('topic-speak-result').hidden, false);
});

test('Speak biases supported recognition browsers toward the current answer', () => {
    const harness = createSpeechHarness();
    const recognition = startOneWordRound(harness, {
        id: 'ladle',
        english: 'ladle',
        portuguese: 'concha',
        accepted: ['ladle'],
        recognitionAliases: ['ledo']
    });

    assert.deepEqual(JSON.parse(JSON.stringify(recognition.phrases.map(({ phrase, boost }) => ({ phrase, boost })))), [
        { phrase: 'ladle', boost: 5 },
        { phrase: 'ledo', boost: 5 }
    ]);
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
    const settingsButton = harness.elements.get('topic-speak-settings-btn');

    settingsButton.dispatch('click');
    harness.elements.get('topic-speak-settings-close').dispatch('click');

    assert.equal(settingsButton.focusCount, 1);
    assert.equal(harness.focusTrapReleaseCount(), 2);

    harness.advanceBy(250);
    harness.advanceBy(221);
    recognition.emitResult(['grater']);

    assert.equal(harness.elements.get('topic-speak-result').hidden, false);
    assert.match(harness.elements.get('topic-speak-status').textContent, /Correct/);
});

test('Speak Settings traps focus and Escape closes it back to the opener', () => {
    const harness = createSpeechHarness();
    startOneWordRound(harness);
    const settingsButton = harness.elements.get('topic-speak-settings-btn');
    const settingsOverlay = harness.elements.get('topic-speak-settings-overlay');
    const settingsClose = harness.elements.get('topic-speak-settings-close');

    settingsButton.dispatch('click');

    assert.equal(settingsOverlay.getAttribute('aria-hidden'), 'false');
    assert.equal(settingsOverlay.classList.contains('visible'), true);
    assert.equal(harness.focusTrapCalls.length, 2);
    assert.strictEqual(harness.focusTrapCalls[1].dialog, harness.elements.get('topic-speak-settings-dialog'));
    assert.strictEqual(harness.focusTrapCalls[1].options.initialFocus, settingsClose);
    assert.equal(settingsClose.focusCount, 1);

    harness.focusTrapCalls[1].options.onEscape();

    assert.equal(settingsOverlay.getAttribute('aria-hidden'), 'true');
    assert.equal(settingsOverlay.classList.contains('visible'), false);
    assert.equal(harness.focusTrapReleaseCount(), 2);
    assert.equal(settingsButton.focusCount, 1);
});

test('Speak releases the Settings focus trap without returning focus when leaving the screen', () => {
    const harness = createSpeechHarness();
    startOneWordRound(harness);
    const settingsButton = harness.elements.get('topic-speak-settings-btn');
    const settingsOverlay = harness.elements.get('topic-speak-settings-overlay');
    settingsButton.dispatch('click');

    harness.api.leaveGame();

    assert.equal(settingsOverlay.getAttribute('aria-hidden'), 'true');
    assert.equal(settingsOverlay.classList.contains('visible'), false);
    assert.equal(harness.focusTrapReleaseCount(), 2);
    assert.equal(settingsButton.focusCount, 0);
});

test('Speak moves focus to the first pronunciation button when the round review appears', () => {
    const harness = createSpeechHarness();
    startOneWordRound(harness);
    harness.elements.get('topic-speak-reveal').dispatch('click');
    harness.advanceBy(3200);

    const review = harness.elements.get('topic-speak-review');
    const firstAudioButton = harness.elements.get('topic-speak-review-first-audio');
    assert.equal(review.classList.contains('visible'), true);
    assert.equal(review.getAttribute('aria-hidden'), 'false');
    assert.equal(firstAudioButton.focusCount, 1);
    assert.equal(firstAudioButton.lastFocusOptions?.preventScroll, true);
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
