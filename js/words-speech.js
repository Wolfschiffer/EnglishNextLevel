// Speech synthesis used by the Words activities.

const WORDS_TTS_OVERRIDES = {
    past: {
        // Keep "read" on screen while pronouncing the past tense as "red".
        'read': 'red',
        'was / were': 'was, were'
    }
};

let activeWordsUtterance = null;

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
    activeWordsUtterance = null;
}

function playVerbAudio(text, context) {
    const speechText = getVerbSpeechText(text, context);
    if (!speechText || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
        return;
    }

    const voiceVolume = getWordsVoiceVolume();
    stopWordsPronunciation();
    if (voiceVolume <= 0) return;

    try {
        // Match TOPICS/SPEAK, whose direct speech synthesis works on mobile.
        const utterance = new SpeechSynthesisUtterance(speechText);
        const voice = getWordsAmericanVoice('en-US');
        utterance.lang = 'en-US';
        utterance.rate = getWordsVoiceRate();
        utterance.volume = voiceVolume / 100;
        if (voice) utterance.voice = voice;

        activeWordsUtterance = utterance;
        const cleanup = () => {
            if (activeWordsUtterance === utterance) activeWordsUtterance = null;
        };
        utterance.onend = cleanup;
        utterance.onerror = cleanup;

        window.speechSynthesis.speak(utterance);
    } catch (error) {
        activeWordsUtterance = null;
        console.warn('WORDS TTS: pronunciation failed.', error);
    }
}

function preloadCurrentGameAudios() {
    // Read available voices without starting silent speech, which can behave
    // poorly on some mobile browsers.
    getWordsAmericanVoice('en-US');
}
