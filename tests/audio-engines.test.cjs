const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');

function createHarness({ speechSupported = true } = {}) {
    const spoken = [];
    let cancelCount = 0;
    let oscillatorCount = 0;

    class FakeUtterance {
        constructor(text) {
            this.text = text;
        }
    }

    class FakeAudioContext {
        constructor() {
            this.state = 'suspended';
            this.currentTime = 0;
            this.destination = {};
        }

        createOscillator() {
            oscillatorCount += 1;
            return {
                frequency: { setValueAtTime() {} },
                connect() {},
                start() {},
                stop() {}
            };
        }

        createGain() {
            return {
                gain: {
                    setValueAtTime() {},
                    exponentialRampToValueAtTime() {}
                },
                connect() {}
            };
        }

        resume() {
            this.state = 'running';
            return Promise.resolve();
        }
    }

    const window = {
        AudioContext: FakeAudioContext,
        SpeechSynthesisUtterance: FakeUtterance,
        speechSynthesis: speechSupported ? {
            getVoices: () => [{ lang: 'en-US', name: 'Test US voice' }],
            cancel() { cancelCount += 1; },
            speak(utterance) { spoken.push(utterance); },
            resume() {}
        } : undefined
    };
    window.EnglishNextLevelAudio = { getVoiceRate: () => 1.3 };
    if (!speechSupported) delete window.speechSynthesis;

    const source = fs.readFileSync(path.join(projectRoot, 'js/audio-engines.js'), 'utf8');
    const context = { window, SpeechSynthesisUtterance: FakeUtterance, console: { warn() {} } };
    vm.runInNewContext(`${source}\nglobalThis.engines = { speech: EnglishSpeechEngine, sfx: ProgrammaticSfxEngine };`, context);

    return {
        engines: context.engines,
        window,
        spoken,
        get cancelCount() { return cancelCount; },
        get oscillatorCount() { return oscillatorCount; }
    };
}

test('speech engine trims input, applies voice settings, and exposes the shared API', () => {
    const harness = createHarness();
    let ended = false;

    assert.equal(harness.engines.speech.speak('  hello  ', {
        lang: 'en-US',
        rate: 1.2,
        volume: 0.7,
        onEnd() { ended = true; }
    }), true);
    assert.equal(harness.window.EnglishNextLevelSpeech, harness.engines.speech);
    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.spoken[0].text, 'hello');
    assert.equal(harness.spoken[0].rate, 1.2);
    assert.equal(harness.spoken[0].volume, 0.7);
    assert.equal(harness.spoken[0].voice.name, 'Test US voice');

    harness.spoken[0].onend();
    assert.equal(ended, true);
    harness.engines.speech.stop();
    assert.ok(harness.cancelCount > 0);
});

test('speech engine safely reports unsupported browsers', () => {
    const harness = createHarness({ speechSupported: false });

    assert.equal(harness.engines.speech.supported(), false);
    assert.equal(harness.engines.speech.speak('hello'), false);
    assert.equal(harness.spoken.length, 0);
});

test('speech engine uses the shared rate when an activity does not override it', () => {
    const harness = createHarness();

    harness.engines.speech.speak('hello');

    assert.equal(harness.spoken[0].rate, 1.3);
});

test('sound effect engine unlocks and schedules a supported effect', async () => {
    const harness = createHarness();

    assert.equal(harness.engines.sfx.supported(), true);
    assert.equal(harness.engines.sfx.primeFromUserGesture(), true);
    assert.equal(await harness.engines.sfx.play('correct', 0.5), true);
    assert.equal(harness.engines.sfx.getState(), 'running');
    assert.equal(harness.oscillatorCount, 3, 'priming and the two-tone effect use three oscillators total');
});

test('index loads audio and game scripts in dependency order', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    const audioScript = html.indexOf('<script src="js/audio-engines.js"></script>');
    const settingsScript = html.indexOf('<script src="js/audio-settings.js"></script>');
    const wordsSpeechScript = html.indexOf('<script src="js/words-speech.js"></script>');
    const vocabularyTouchScript = html.indexOf('<script src="js/vocabulary-touch-input.js"></script>');
    const vocabularyScript = html.indexOf('<script src="js/vocabulary-game.js"></script>');
    const gameScript = html.indexOf('<script src="js/game.js"></script>');
    const numbersScript = html.indexOf('<script src="js/numbers-game.js"></script>');

    assert.notEqual(audioScript, -1, 'index should load audio-engines.js');
    assert.notEqual(settingsScript, -1, 'index should load audio-settings.js');
    assert.notEqual(wordsSpeechScript, -1, 'index should load words-speech.js');
    assert.notEqual(vocabularyTouchScript, -1, 'index should load vocabulary-touch-input.js');
    assert.notEqual(vocabularyScript, -1, 'index should load vocabulary-game.js');
    assert.notEqual(gameScript, -1, 'index should load game.js');
    assert.notEqual(numbersScript, -1, 'index should load numbers-game.js');
    assert.ok(audioScript < settingsScript, 'audio-engines.js must load before audio-settings.js');
    assert.ok(settingsScript < wordsSpeechScript, 'audio-settings.js must load before words-speech.js');
    assert.ok(wordsSpeechScript < vocabularyScript, 'words-speech.js must load before vocabulary-game.js');
    assert.ok(vocabularyTouchScript < vocabularyScript, 'vocabulary-touch-input.js must load before vocabulary-game.js');
    assert.ok(vocabularyScript < gameScript, 'vocabulary-game.js must load before game.js');
    assert.ok(gameScript < numbersScript, 'game.js navigation must load before numbers-game.js');
});
