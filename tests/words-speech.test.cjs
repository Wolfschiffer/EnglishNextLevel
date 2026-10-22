const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/words-speech.js'), 'utf8');

function createHarness({ supported = true, voices = [{ lang: 'en-US', name: 'US voice' }], volume = 72, rate = 1.1 } = {}) {
    const spoken = [];
    let cancelCount = 0;
    let resumeCount = 0;
    let voiceReadCount = 0;

    class FakeUtterance {
        constructor(text) {
            this.text = text;
        }
    }

    const speechSynthesis = {
        getVoices() {
            voiceReadCount += 1;
            return voices;
        },
        cancel() { cancelCount += 1; },
        speak(utterance) { spoken.push(utterance); },
        resume() { resumeCount += 1; }
    };
    const window = {
        SpeechSynthesisUtterance: FakeUtterance,
        speechSynthesis
    };
    if (!supported) delete window.speechSynthesis;

    const context = {
        window,
        SpeechSynthesisUtterance: FakeUtterance,
        getWordsVoiceVolume: () => volume,
        getWordsVoiceRate: () => rate,
        console: { warn() {} }
    };
    vm.runInNewContext(source, context, { filename: 'words-speech.js' });

    return {
        context,
        spoken,
        get cancelCount() { return cancelCount; },
        get resumeCount() { return resumeCount; },
        get voiceReadCount() { return voiceReadCount; }
    };
}

test('Words pronunciation applies past-tense text, voice, rate, and shared volume', () => {
    const harness = createHarness();

    harness.context.playVerbAudio(' read ', 'past');

    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.spoken[0].text, 'red');
    assert.equal(harness.spoken[0].lang, 'en-US');
    assert.equal(harness.spoken[0].rate, 1.1);
    assert.equal(harness.spoken[0].volume, 0.72);
    assert.equal(harness.spoken[0].voice.name, 'US voice');
    assert.equal(harness.cancelCount, 0);
    assert.equal(harness.resumeCount, 2);
});

test('Words pronunciation falls back to another English voice when US is unavailable', () => {
    const harness = createHarness({ voices: [{ lang: 'en-GB', name: 'UK voice' }] });

    harness.context.playVerbAudio('walked', 'past');

    assert.equal(harness.spoken[0].voice.name, 'UK voice');
});

test('Words pronunciation stops current speech and does not speak when muted', () => {
    let volume = 60;
    const harness = createHarness({ volume });
    harness.context.getWordsVoiceVolume = () => volume;

    harness.context.playVerbAudio('walk', 'present');
    volume = 0;
    harness.context.playVerbAudio('run', 'present');

    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.cancelCount, 1);
});

test('Words speech preload reads available voices without speaking', () => {
    const harness = createHarness();

    harness.context.preloadCurrentGameAudios();

    assert.equal(harness.voiceReadCount, 1);
    assert.equal(harness.spoken.length, 0);
});

test('Words pronunciation safely does nothing when speech synthesis is unavailable', () => {
    const harness = createHarness({ supported: false });

    assert.doesNotThrow(() => harness.context.playVerbAudio('hello', 'present'));
    assert.equal(harness.spoken.length, 0);
});

test('Words keeps rapid pronunciations in the browser queue instead of cutting them off', () => {
    const harness = createHarness();

    harness.context.playVerbAudio('walked', 'past');
    harness.context.playVerbAudio('went', 'past');

    assert.deepEqual(harness.spoken.map((utterance) => utterance.text), ['walked', 'went']);
    assert.equal(harness.cancelCount, 0);
    assert.equal(harness.resumeCount, 4);
});

test('Words ignores a duplicate queued pronunciation but allows replay after it ends', () => {
    const harness = createHarness();

    harness.context.playVerbAudio('went', 'past');
    harness.context.playVerbAudio('went', 'past');
    assert.equal(harness.spoken.length, 1);

    harness.spoken[0].onend();
    harness.context.playVerbAudio('went', 'past');
    assert.equal(harness.spoken.length, 2);
});
