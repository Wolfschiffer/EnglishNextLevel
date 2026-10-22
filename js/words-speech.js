// Speech synthesis used by the Words activities.

const WORDS_TTS_OVERRIDES = {
    past: {
        // Keep "read" on screen while pronouncing the past tense as "red".
        'read': 'red',
        'was / were': 'was, were'
    }
};

let activeWordsUtterance = null;
const pendingWordsSpeechTexts = new Map();

function getVerbSpeechText(text, context) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return '';
    return WORDS_TTS_OVERRIDES[context]?.[cleanText] || cleanText;
}

function getWordsAmericanVoice(locale = 'en-US') {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const target = String(locale || 'en-US').toLowerCase();

    return voices.find((voice) => voice.lang?.toLowerCase() === target) ||
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-us')) ||
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
        null;
}

function stopWordsPronunciation() {
    if ('speechSynthesis' in window) {
        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            console.warn('WORDS TTS: could not stop speech.', error);
        }
    }
    pendingWordsSpeechTexts.clear();
    activeWordsUtterance = null;
}

function playVerbAudio(text, context) {
    const speechText = getVerbSpeechText(text, context);
    if (!speechText || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
        return;
    }

    const voiceVolume = getWordsVoiceVolume();
    if (voiceVolume <= 0) {
        stopWordsPronunciation();
        return;
    }
    if (pendingWordsSpeechTexts.has(speechText)) return;

    try {
        // Match TOPICS/SPEAK, whose direct speech synthesis works on mobile.
        const utterance = new SpeechSynthesisUtterance(speechText);
        const voice = getWordsAmericanVoice('en-US');
        utterance.lang = 'en-US';
        utterance.rate = getWordsVoiceRate();
        utterance.volume = voiceVolume / 100;
        if (voice) utterance.voice = voice;

        pendingWordsSpeechTexts.set(speechText, utterance);
        activeWordsUtterance = utterance;
        const cleanup = () => {
            if (pendingWordsSpeechTexts.get(speechText) === utterance) {
                pendingWordsSpeechTexts.delete(speechText);
            }
            if (activeWordsUtterance === utterance) activeWordsUtterance = null;
        };
        utterance.onstart = () => {
            activeWordsUtterance = utterance;
        };
        utterance.onend = cleanup;
        utterance.onerror = cleanup;

        // Preserve the browser's speech queue so a new word does not cut off
        // the pronunciation already playing. Resume around speak() because
        // some browsers leave the synthesis queue paused after interruptions.
        window.speechSynthesis.resume?.();
        window.speechSynthesis.speak(utterance);
        window.speechSynthesis.resume?.();
    } catch (error) {
        if (pendingWordsSpeechTexts.get(speechText)) {
            pendingWordsSpeechTexts.delete(speechText);
        }
        activeWordsUtterance = null;
        console.warn('WORDS TTS: pronunciation failed.', error);
    }
}

function preloadCurrentGameAudios() {
    // Read available voices without starting silent speech, which can behave
    // poorly on some mobile browsers.
    getWordsAmericanVoice('en-US');
}
