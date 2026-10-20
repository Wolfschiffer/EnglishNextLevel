const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createHarness(initialValues = {}) {
    const values = new Map(Object.entries(initialValues));
    const events = [];
    let speechStopCount = 0;
    let wordsStopCount = 0;

    const window = {
        sessionStorage: {
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, String(value)); }
        },
        dispatchEvent(event) { events.push(event); }
    };
    const document = {
        body: { classList: { add() {}, remove() {} } },
        getElementById() { return null; },
        addEventListener() {}
    };
    class FakeCustomEvent {
        constructor(type, options) {
            this.type = type;
            this.detail = options.detail;
        }
    }

    const context = {
        window,
        document,
        CustomEvent: FakeCustomEvent,
        requestAnimationFrame(callback) { callback(); },
        ProgrammaticSfxEngine: { primeFromUserGesture() {} },
        EnglishSpeechEngine: { stop() { speechStopCount += 1; } },
        stopWordsPronunciation() { wordsStopCount += 1; },
        playSound() {},
        currentScreen: 'numbersGame',
        SCREENS: {
            NUMBERS_GAME: 'numbersGame',
            NUMBERS_MENU: 'numbersMenu',
            WORDS_GAME: 'wordsGame',
            WORDS_MENU: 'wordsMenu',
            WORDS_SUBMENU: 'wordsSubmenu',
            WORDS_SUBMENU_PAST: 'wordsSubmenuPast',
            TOPIC_MATCH: 'topicMatch',
            TOPICS_MENU: 'topicsMenu',
            TOPIC_LEVEL: 'topicLevel',
            TOPIC_GAME_MENU: 'topicGameMenu'
        }
    };

    const source = fs.readFileSync(path.join(__dirname, '../js/audio-settings.js'), 'utf8');
    vm.runInNewContext(source, context);

    return {
        context,
        values,
        events,
        get speechStopCount() { return speechStopCount; },
        get wordsStopCount() { return wordsStopCount; }
    };
}

function createFocusSettingsHarness() {
    const values = new Map();
    const elements = new Map();
    const bodyClasses = new Set();
    const documentListeners = new Map();
    const document = {
        activeElement: null,
        body: {
            classList: {
                add(name) { bodyClasses.add(name); },
                remove(name) { bodyClasses.delete(name); },
                contains(name) { return bodyClasses.has(name); }
            }
        },
        getElementById(id) { return elements.get(id) || null; },
        querySelectorAll() { return []; },
        addEventListener(type, listener) { documentListeners.set(type, listener); }
    };
    const window = {
        sessionStorage: {
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, String(value)); }
        },
        dispatchEvent() {}
    };

    function createElement(id, options = {}) {
        const attributes = new Map();
        const listeners = new Map();
        const classes = new Set(options.classes || []);
        const element = {
            id,
            disabled: false,
            hidden: false,
            isConnected: true,
            visible: options.visible !== false,
            value: '100',
            textContent: '',
            style: { setProperty() {} },
            classList: {
                add(name) { classes.add(name); },
                remove(name) { classes.delete(name); },
                contains(name) { return classes.has(name); }
            },
            setAttribute(name, value) { attributes.set(name, String(value)); },
            getAttribute(name) { return attributes.get(name) ?? null; },
            hasAttribute(name) { return attributes.has(name); },
            addEventListener(type, listener) { listeners.set(type, listener); },
            removeEventListener(type) { listeners.delete(type); },
            blur() {
                if (document.activeElement === element) document.activeElement = document.body;
            },
            getClientRects() {
                const shown = id === 'words-settings-overlay'
                    ? true
                    : id === 'words-settings-modal'
                        ? overlay.classList.contains('visible')
                        : id === 'category-settings-btn'
                            ? element.visible
                            : overlay.classList.contains('visible');
                return shown ? [element] : [];
            },
            focus() {
                if (this.getClientRects().length > 0) document.activeElement = element;
            },
            listeners
        };
        if (id) elements.set(id, element);
        return element;
    }

    let overlay = createElement('words-settings-overlay');
    const modal = createElement('words-settings-modal');
    const closeButton = createElement('words-settings-close');
    const sfxSlider = createElement('words-sfx-volume');
    const voiceSlider = createElement('words-voice-volume');
    const voiceRateSlider = createElement('words-voice-rate');
    modal.querySelectorAll = () => [closeButton, sfxSlider, voiceSlider, voiceRateSlider];
    modal.contains = (element) => element === modal || modal.querySelectorAll().includes(element);
    overlay.querySelector = (selector) => selector === '[role="dialog"]' ? modal : null;

    const trigger = createElement('category-settings-btn');
    document.activeElement = trigger;

    const context = {
        window,
        document,
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        requestAnimationFrame(callback) { callback(); },
        ProgrammaticSfxEngine: { primeFromUserGesture() {} },
        EnglishSpeechEngine: { stop() {} },
        stopWordsPronunciation() {},
        playSound() {},
        currentScreen: 'categories',
        SCREENS: {
            NUMBERS_GAME: 'numbersGame', NUMBERS_MENU: 'numbersMenu', WORDS_GAME: 'wordsGame',
            WORDS_MENU: 'wordsMenu', WORDS_SUBMENU: 'wordsSubmenu', WORDS_SUBMENU_PAST: 'wordsSubmenuPast',
            TOPIC_MATCH: 'topicMatch', TOPICS_MENU: 'topicsMenu', TOPIC_LEVEL: 'topicLevel',
            TOPIC_GAME_MENU: 'topicGameMenu'
        }
    };
    const keyboardSource = fs.readFileSync(path.join(__dirname, '../js/keyboard-accessibility.js'), 'utf8');
    const settingsSource = fs.readFileSync(path.join(__dirname, '../js/audio-settings.js'), 'utf8');
    vm.runInNewContext(keyboardSource, context);
    vm.runInNewContext(settingsSource, context);
    context.initWordsSettings();

    return { context, document, documentListeners, bodyClasses, overlay, modal, closeButton, sfxSlider, voiceSlider, voiceRateSlider, trigger };
}

test('audio settings migrate the legacy Words SFX volume into the shared setting', () => {
    const harness = createHarness({ 'englishNextLevel.wordsSfxVolume': '42' });

    harness.context.loadGlobalAudioVolumes();

    assert.equal(harness.values.get('englishNextLevel.sfxVolume'), '42');
    assert.equal(harness.context.getGlobalSfxVolume(), 42);
    harness.context.setWordsSfxVolume(36);
    assert.equal(harness.context.getGlobalSfxVolume(), 36);
});

test('audio settings clamp values, publish changes, and stop speech when muted', () => {
    const harness = createHarness();

    harness.context.setGlobalVoiceVolume(0);
    harness.context.setGlobalSfxVolume(150);

    assert.equal(harness.values.get('englishNextLevel.voiceVolume'), '0');
    assert.equal(harness.values.get('englishNextLevel.sfxVolume'), '100');
    assert.equal(harness.speechStopCount, 1);
    assert.equal(harness.wordsStopCount, 1);
    assert.equal(harness.events.at(-1).detail.voiceVolume, 0);
    assert.equal(harness.events.at(-1).detail.voiceRate, 0.9);
    assert.equal(harness.events.at(-1).detail.sfxVolume, 100);
});

test('speech rate is shared, clamped, and stored for the current session', () => {
    const harness = createHarness();

    assert.equal(harness.context.getGlobalVoiceRate(), 0.9);
    harness.context.setGlobalVoiceRate(128);

    assert.equal(harness.values.get('englishNextLevel.voiceRate'), '130');
    assert.equal(harness.context.getWordsVoiceRate(), 1.3);
    assert.equal(harness.events.at(-1).detail.voiceRate, 1.3);

    harness.context.setGlobalVoiceRate(20);
    assert.equal(harness.context.getGlobalVoiceRate(), 0.5);
    harness.context.setGlobalVoiceRate(180);
    assert.equal(harness.context.getGlobalVoiceRate(), 1.5);
});

test('audio settings label follows the current game screen', () => {
    const harness = createHarness();

    assert.equal(harness.context.getAudioSettingsLabel(), 'NUMBERS');
    harness.context.currentScreen = 'topicMatch';
    assert.equal(harness.context.getAudioSettingsLabel(), 'MATCH PAIRS');
    harness.context.currentScreen = 'wordsSubmenuPast';
    assert.equal(harness.context.getAudioSettingsLabel(), 'WORDS');
});

test('audio settings trap keyboard focus and wrap Tab in both directions', () => {
    const harness = createFocusSettingsHarness();

    harness.trigger.listeners.get('click')();

    assert.equal(harness.document.activeElement, harness.sfxSlider);
    assert.equal(harness.overlay.getAttribute('aria-hidden'), 'false');

    harness.document.activeElement = harness.closeButton;
    let shiftTabPrevented = false;
    harness.modal.listeners.get('keydown')({
        key: 'Tab',
        shiftKey: true,
        preventDefault() { shiftTabPrevented = true; }
    });
    assert.equal(shiftTabPrevented, true);
    assert.equal(harness.document.activeElement, harness.voiceRateSlider);

    let tabPrevented = false;
    harness.modal.listeners.get('keydown')({
        key: 'Tab',
        shiftKey: false,
        preventDefault() { tabPrevented = true; }
    });
    assert.equal(tabPrevented, true);
    assert.equal(harness.document.activeElement, harness.closeButton);
});

test('closing audio settings with Escape releases the trap and restores its opener', () => {
    const harness = createFocusSettingsHarness();

    harness.trigger.listeners.get('click')();
    let escapePrevented = false;
    harness.modal.listeners.get('keydown')({
        key: 'Escape',
        preventDefault() { escapePrevented = true; }
    });

    assert.equal(escapePrevented, true);
    assert.equal(harness.overlay.classList.contains('visible'), false);
    assert.equal(harness.overlay.getAttribute('aria-hidden'), 'true');
    assert.equal(harness.bodyClasses.has('words-settings-open'), false);
    assert.equal(harness.document.activeElement, harness.trigger);
    assert.equal(harness.modal.listeners.has('keydown'), false);
});

test('screen navigation closes audio settings without focusing a hidden opener', () => {
    const harness = createFocusSettingsHarness();

    harness.trigger.listeners.get('click')();
    harness.trigger.visible = false;
    harness.context.closeWordsSettings({ restoreFocus: false });

    assert.equal(harness.overlay.classList.contains('visible'), false);
    assert.notEqual(harness.document.activeElement, harness.trigger);
    assert.equal(harness.modal.contains(harness.document.activeElement), false);
});
