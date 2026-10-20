const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const STORAGE_KEY = 'englishNextLevel.topicSpeak.showPreAnswerAudio';

function createHarness({
    savedPreference = null,
    failStorageRead = false,
    failStorageWrite = false,
    voiceVolume = 75,
    sfxVolume = 50
} = {}) {
    const elements = new Map();
    const windowListeners = new Map();
    const storedValues = new Map();
    const audioCalls = [];
    let currentVoiceVolume = voiceVolume;
    let currentSfxVolume = sfxVolume;
    let stopSpeechCalls = 0;
    let previewVisibilityUpdates = 0;

    function createElement(id) {
        const attributes = new Map();
        const listeners = new Map();
        const styleProperties = new Map();
        return {
            id,
            checked: false,
            value: '',
            textContent: '',
            attributes,
            styleProperties,
            style: { setProperty(name, value) { styleProperties.set(name, value); } },
            addEventListener(event, callback) { listeners.set(event, callback); },
            dispatch(event) { listeners.get(event)?.({ target: this }); },
            setAttribute(name, value) { attributes.set(name, String(value)); },
            getAttribute(name) { return attributes.get(name) ?? null; }
        };
    }

    [
        'topic-speak-preaudio-toggle',
        'topic-speak-voice-volume',
        'topic-speak-voice-volume-value',
        'topic-speak-voice-volume-icon',
        'topic-speak-sfx-volume',
        'topic-speak-sfx-volume-value',
        'topic-speak-sfx-volume-icon'
    ].forEach((id) => elements.set(id, createElement(id)));

    if (savedPreference !== null) storedValues.set(STORAGE_KEY, savedPreference);

    const window = {
        EnglishNextLevelAudio: {
            getVoiceVolume() { return currentVoiceVolume; },
            getSfxVolume() { return currentSfxVolume; },
            setVoiceVolume(value) { currentVoiceVolume = value; audioCalls.push(['setVoiceVolume', value]); },
            setSfxVolume(value) { currentSfxVolume = value; audioCalls.push(['setSfxVolume', value]); },
            playSfx(type) { audioCalls.push(['playSfx', type]); },
            unlockSfx() { audioCalls.push(['unlockSfx']); }
        },
        sessionStorage: {
            getItem(key) {
                if (failStorageRead) throw new Error('storage read denied');
                return storedValues.get(key) ?? null;
            },
            setItem(key, value) {
                if (failStorageWrite) throw new Error('storage write denied');
                storedValues.set(String(key), String(value));
            }
        },
        addEventListener(event, callback) {
            if (!windowListeners.has(event)) windowListeners.set(event, new Set());
            windowListeners.get(event).add(callback);
        },
        dispatch(event) {
            [...(windowListeners.get(event) || [])].forEach((callback) => callback());
        }
    };
    const document = { getElementById(id) { return elements.get(id) ?? null; } };
    const state = { showPreAnswerAudio: false, voiceVolume: 100, sfxVolume: 100 };
    const context = { window };
    const source = fs.readFileSync(path.join(ROOT, 'js/topics/speech-settings.js'), 'utf8');
    vm.runInNewContext(source, context, { filename: 'js/topics/speech-settings.js' });
    const controller = window.TopicSpeakSettings.create({
        state,
        window,
        document,
        stopSpeech() { stopSpeechCalls += 1; },
        updatePreviewAudioVisibility() { previewVisibilityUpdates += 1; }
    });

    return {
        controller,
        state,
        elements,
        storedValues,
        audioCalls,
        stopSpeechCalls: () => stopSpeechCalls,
        previewVisibilityUpdates: () => previewVisibilityUpdates,
        setExternalAudioVolumes(voice, sfx) {
            currentVoiceVolume = voice;
            currentSfxVolume = sfx;
        },
        dispatchWindowEvent(event) { window.dispatch(event); }
    };
}

test('loads the saved preview-audio preference and synchronizes volume controls', () => {
    const harness = createHarness({ savedPreference: 'true', voiceVolume: 33, sfxVolume: 66 });
    harness.controller.loadSettings();
    harness.controller.syncSettingsUI();

    assert.equal(harness.state.showPreAnswerAudio, true);
    assert.equal(harness.elements.get('topic-speak-preaudio-toggle').checked, true);
    assert.equal(harness.elements.get('topic-speak-voice-volume').value, '33');
    assert.equal(harness.elements.get('topic-speak-voice-volume-value').textContent, '33%');
    assert.equal(harness.elements.get('topic-speak-voice-volume-icon').textContent, '🔈');
    assert.equal(harness.elements.get('topic-speak-sfx-volume').value, '66');
    assert.equal(harness.elements.get('topic-speak-sfx-volume-value').textContent, '66%');
    assert.equal(harness.elements.get('topic-speak-sfx-volume-icon').textContent, '🔉');
    assert.equal(harness.elements.get('topic-speak-voice-volume').getAttribute('aria-valuenow'), '33');
    assert.equal(harness.elements.get('topic-speak-voice-volume').styleProperties.get('--topic-speak-volume-percent'), '33%');
    assert.equal(harness.previewVisibilityUpdates(), 1);
});

test('unavailable session storage keeps the activity usable', () => {
    const readFailure = createHarness({ failStorageRead: true });
    readFailure.controller.loadSettings();
    assert.equal(readFailure.state.showPreAnswerAudio, false);

    const writeFailure = createHarness({ failStorageWrite: true });
    writeFailure.controller.bindControls();
    const toggle = writeFailure.elements.get('topic-speak-preaudio-toggle');
    toggle.checked = true;
    assert.doesNotThrow(() => toggle.dispatch('change'));
    assert.equal(writeFailure.state.showPreAnswerAudio, true);
    assert.equal(writeFailure.previewVisibilityUpdates(), 1);
});

test('pre-answer audio preference is saved when its control changes', () => {
    const harness = createHarness();
    harness.controller.bindControls();
    const toggle = harness.elements.get('topic-speak-preaudio-toggle');

    toggle.checked = true;
    toggle.dispatch('change');
    assert.equal(harness.state.showPreAnswerAudio, true);
    assert.equal(harness.storedValues.get(STORAGE_KEY), 'true');

    toggle.checked = false;
    toggle.dispatch('change');
    assert.equal(harness.state.showPreAnswerAudio, false);
    assert.equal(harness.storedValues.get(STORAGE_KEY), 'false');
    assert.equal(harness.previewVisibilityUpdates(), 2);
});

test('volume sliders clamp values and changing voice volume stops current speech', () => {
    const harness = createHarness();
    harness.controller.bindControls();
    const voiceSlider = harness.elements.get('topic-speak-voice-volume');
    const sfxSlider = harness.elements.get('topic-speak-sfx-volume');

    voiceSlider.value = '33.7';
    voiceSlider.dispatch('input');
    assert.equal(harness.state.voiceVolume, 34);
    assert.equal(harness.audioCalls[0][0], 'setVoiceVolume');
    assert.equal(harness.audioCalls[0][1], 34);
    assert.equal(harness.stopSpeechCalls(), 1);

    voiceSlider.value = '-5';
    voiceSlider.dispatch('input');
    assert.equal(harness.state.voiceVolume, 0);
    assert.equal(harness.elements.get('topic-speak-voice-volume-icon').textContent, '🔇');
    assert.equal(harness.stopSpeechCalls(), 2);

    sfxSlider.value = '101';
    sfxSlider.dispatch('input');
    assert.equal(harness.state.sfxVolume, 100);
    assert.equal(harness.audioCalls[2][0], 'setSfxVolume');
    assert.equal(harness.audioCalls[2][1], 100);
    assert.equal(harness.stopSpeechCalls(), 2);
});

test('shared audio volume changes refresh both controls and state', () => {
    const harness = createHarness();
    harness.controller.bindControls();
    harness.setExternalAudioVolumes(25, 100);
    harness.dispatchWindowEvent('english-next-level-audio-volume-change');

    assert.equal(harness.state.voiceVolume, 25);
    assert.equal(harness.state.sfxVolume, 100);
    assert.equal(harness.elements.get('topic-speak-voice-volume').value, '25');
    assert.equal(harness.elements.get('topic-speak-voice-volume-icon').textContent, '🔈');
    assert.equal(harness.elements.get('topic-speak-sfx-volume').value, '100');
    assert.equal(harness.elements.get('topic-speak-sfx-volume-icon').textContent, '🔊');
});

test('game sound helpers use the shared audio engine', () => {
    const harness = createHarness();
    harness.controller.playSfx('correct');
    harness.controller.unlockSfx();

    assert.deepEqual(harness.audioCalls, [['playSfx', 'correct'], ['unlockSfx']]);
});
