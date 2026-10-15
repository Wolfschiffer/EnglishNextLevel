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
