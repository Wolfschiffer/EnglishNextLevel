const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createHarness({ supported = true, volume = 75, rate = 0.95, voices = [{ lang: 'en-US', name: 'US voice' }] } = {}) {
    const spoken = [];
    const timers = [];
    const playingButtons = new Set();
    let cancelCount = 0;
    let resumeCount = 0;
    let currentVolume = volume;

    class FakeUtterance {
        constructor(text) { this.text = text; }
    }

    const speechSynthesis = {
        getVoices() { return voices; },
        cancel() { cancelCount += 1; },
        speak(utterance) { spoken.push(utterance); },
        resume() { resumeCount += 1; }
    };
    const window = {
        SpeechSynthesisUtterance: FakeUtterance,
        EnglishNextLevelAudio: { getVoiceRate() { return rate; } },
        setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; }
    };
    if (supported) window.speechSynthesis = speechSynthesis;

    const document = {
        querySelectorAll() {
            return [...playingButtons].map((button) => ({
                classList: { remove(name) { if (name === 'is-playing') button.playing = false; } }
            }));
        }
    };
    const state = { topic: { englishVariant: 'en-US' }, speechOutputPrimed: false, activeUtterance: null };
    const source = fs.readFileSync(path.join(ROOT, 'js/topics/speech-audio.js'), 'utf8');
    vm.runInNewContext(source, { window });
    const controller = window.TopicSpeakAudio.create({
        state,
        window,
        document,
        getVoiceVolume() { return currentVolume; },
        getVoiceRate() { return rate; }
    });

    return {
        controller,
        state,
        spoken,
        timers,
        playingButtons,
        setVoiceVolume(value) { currentVolume = value; },
        get cancelCount() { return cancelCount; },
        get resumeCount() { return resumeCount; }
    };
}

function makeButton(harness) {
    const button = {
        disabled: false,
        title: '',
        playing: false,
        classList: {
            add(name) { if (name === 'is-playing') button.playing = true; },
            remove(name) { if (name === 'is-playing') button.playing = false; }
        }
    };
    harness.playingButtons.add(button);
    return button;
}

test('Topics Speak applies the shared voice, rate, and volume and clears playback state', () => {
    const harness = createHarness();
    const button = makeButton(harness);
    let doneCount = 0;

    harness.controller.play({ english: 'spoon' }, button, () => { doneCount += 1; });

    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.spoken[0].text, 'spoon');
    assert.equal(harness.spoken[0].lang, 'en-US');
    assert.equal(harness.spoken[0].rate, 0.95);
    assert.equal(harness.spoken[0].volume, 0.75);
    assert.equal(harness.spoken[0].voice.name, 'US voice');
    assert.equal(button.playing, true);
    assert.equal(harness.resumeCount, 2);

    harness.spoken[0].onend();
    harness.spoken[0].onerror();
    assert.equal(button.playing, false);
    assert.equal(harness.state.activeUtterance, null);
    assert.equal(doneCount, 1);
});

test('Topics Speak falls back to another English voice when the requested locale is unavailable', () => {
    const harness = createHarness({ voices: [{ lang: 'en-GB', name: 'UK voice' }] });

    harness.controller.play({ english: 'spoon' }, null);

    assert.equal(harness.spoken[0].voice.name, 'UK voice');
});

test('speech output priming is silent and runs only once', () => {
    const harness = createHarness();

    harness.controller.prime();
    harness.controller.prime();

    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.spoken[0].text, ' ');
    assert.equal(harness.spoken[0].volume, 0);
    assert.equal(harness.spoken[0].lang, 'en-US');
    assert.equal(harness.state.speechOutputPrimed, true);
});

test('muted speech skips playback and completes through the fallback timer', () => {
    const harness = createHarness();
    let previousDoneCount = 0;
    let mutedDoneCount = 0;

    harness.controller.play({ english: 'spoon' }, null, () => { previousDoneCount += 1; });
    assert.equal(harness.spoken.length, 1);
    assert.ok(harness.state.activeUtterance);
    harness.setVoiceVolume(0);

    harness.controller.play({ english: 'fork' }, null, () => { mutedDoneCount += 1; });

    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.cancelCount, 2);
    assert.equal(harness.state.activeUtterance, null);
    assert.equal(harness.timers[0].delay, 650);
    assert.equal(previousDoneCount, 0);
    assert.equal(mutedDoneCount, 0);
    harness.timers[0].callback();
    assert.equal(previousDoneCount, 0);
    assert.equal(mutedDoneCount, 1);
});

test('unsupported speech disables the control and completes through the fallback timer', () => {
    const harness = createHarness({ supported: false });
    const button = makeButton(harness);
    let doneCount = 0;

    harness.controller.play({ english: 'spoon' }, button, () => { doneCount += 1; });

    assert.equal(button.disabled, true);
    assert.match(button.title, /not supported/);
    assert.equal(harness.spoken.length, 0);
    assert.equal(harness.timers[0].delay, 650);
    harness.timers[0].callback();
    assert.equal(doneCount, 1);
});
