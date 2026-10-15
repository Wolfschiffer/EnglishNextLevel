// Owns speech synthesis used by the Topics Speak activity.
(function () {
  function create({ state, window, document, getVoiceVolume, getVoiceRate }) {
    function stop() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      state.activeUtterance = null;
      document.querySelectorAll('#topic-speak-container .topic-review-audio.is-playing').forEach((button) => {
        button.classList.remove('is-playing');
      });
    }

    function getAmericanVoice(locale) {
      if (!('speechSynthesis' in window)) return null;
      const voices = window.speechSynthesis.getVoices();
      const target = (locale || 'en-US').toLowerCase();

      return voices.find((voice) => voice.lang?.toLowerCase() === target) ||
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-us')) ||
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
        null;
    }

    function prime() {
      if (state.speechOutputPrimed || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
        return;
      }

      try {
        const utterance = new window.SpeechSynthesisUtterance(' ');
        utterance.lang = state.topic?.englishVariant || 'en-US';
        utterance.volume = 0;
        utterance.rate = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        window.speechSynthesis.resume?.();
        state.speechOutputPrimed = true;
      } catch (error) {
        console.warn('TOPICS Speak: could not prime speech output.', error);
      }
    }

    function play(word, button, onDone = null) {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (typeof onDone === 'function') onDone();
      };

      if (!word || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
        if (button) {
          button.disabled = true;
          button.title = 'Audio is not supported in this browser.';
        }
        window.setTimeout(finish, 650);
        return;
      }

      stop();

      const voiceVolume = getVoiceVolume();
      if (voiceVolume <= 0) {
        window.setTimeout(finish, 650);
        return;
      }

      const locale = state.topic?.englishVariant || 'en-US';
      const utterance = new window.SpeechSynthesisUtterance(word.english);
      const voice = getAmericanVoice(locale);

      utterance.lang = locale;
      utterance.rate = getVoiceRate();
      utterance.volume = voiceVolume / 100;
      if (voice) utterance.voice = voice;

      state.activeUtterance = utterance;
      button?.classList.add('is-playing');

      const cleanup = () => {
        button?.classList.remove('is-playing');
        if (state.activeUtterance === utterance) state.activeUtterance = null;
        finish();
      };

      utterance.onend = cleanup;
      utterance.onerror = cleanup;

      // Some mobile browsers leave speech synthesis paused after microphone use.
      window.speechSynthesis.resume?.();
      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume?.();
    }

    return { getAmericanVoice, play, prime, stop };
  }

  window.TopicSpeakAudio = { create };
})();
