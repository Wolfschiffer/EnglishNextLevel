(function () {
  function create({
    state,
    window: browserWindow,
    document: browserDocument,
    SpeechRecognitionCtor,
    getElement,
    currentWord,
    isCorrectAnswer,
    setStatus,
    setMicState,
    stopSpeech,
    hideHeard,
    showFallback,
    showCorrectResult,
    showWrongResult
  }) {
    const $ = getElement;

    function pageCanUseMicrophone() {
      const visible = typeof browserDocument.visibilityState !== 'string' || browserDocument.visibilityState === 'visible';
      return visible && state.pageFocused;
    }

    function clearRecognitionRestartTimer() {
      if (state.recognitionRestartTimer) {
        browserWindow.clearTimeout(state.recognitionRestartTimer);
        state.recognitionRestartTimer = null;
      }
    }

    function clearAcceptRecognitionTimer() {
      if (state.acceptRecognitionTimer) {
        browserWindow.clearTimeout(state.acceptRecognitionTimer);
        state.acceptRecognitionTimer = null;
      }
    }

    function armRecognitionForCurrentWord(delay = 0) {
      clearAcceptRecognitionTimer();
      state.acceptingRecognition = false;

      const activate = () => {
        state.acceptRecognitionTimer = null;
        if (!state.inSpeakScreen || !state.started || state.currentWordResolved || state.recognitionPaused || !pageCanUseMicrophone()) return;
        state.ignoreRecognitionUntil = Date.now() + 220;
        state.acceptingRecognition = true;
        if (state.listening) setStatus('Listening… say the English word now.', 'listening');
      };

      if (delay > 0) {
        state.acceptRecognitionTimer = browserWindow.setTimeout(activate, delay);
      } else {
        activate();
      }
    }

    function stopRecognition({ cancelPendingPronunciation = false, disableMic = false, endSession = true } = {}) {
      state.recognitionStarting = false;
      state.recognitionStartedAt = 0;
      state.acceptingRecognition = false;
      clearAcceptRecognitionTimer();
      clearRecognitionRestartTimer();

      if (endSession) {
        state.recognitionSessionWanted = false;
      }

      if (cancelPendingPronunciation) {
        state.pendingPronunciation = null;
      }

      if (state.recognition) {
        try {
          state.recognition.abort();
        } catch (error) {
          if (error?.name !== 'InvalidStateError') {
            console.warn('TOPICS Speak: could not abort recognition.', error);
          }
        }
      }

      setMicState(false);

      const mic = $('topic-speak-mic');
      if (mic && disableMic) mic.disabled = true;
    }

    function suspendMicrophoneForPageLifecycle() {
      const wasUsingMicrophone = state.listening || state.recognitionStarting;
      if (wasUsingMicrophone) {
        state.suspendedByPageLifecycle = true;
        stopRecognition({
          cancelPendingPronunciation: true,
          disableMic: true,
          endSession: false
        });
      } else {
        state.pendingPronunciation = null;
        const mic = $('topic-speak-mic');
        if (mic && !pageCanUseMicrophone()) mic.disabled = true;
      }
      stopSpeech();
    }

    function resumeMicrophoneControlsAfterFocus() {
      if (!pageCanUseMicrophone()) return;

      const mic = $('topic-speak-mic');
      if (mic && state.started && !state.currentWordResolved && !state.recognitionBlocked) {
        mic.disabled = false;
      }

      if (state.suspendedByPageLifecycle) {
        state.suspendedByPageLifecycle = false;
      }

      if (state.inSpeakScreen && state.recognitionSessionWanted && !state.recognitionPaused && !state.recognitionBlocked) {
        startRecognitionSession();
      }
    }

    function setRecognitionAvailability() {
      const unsupported = $('topic-speak-unsupported');
      const mic = $('topic-speak-mic');
      if (!unsupported || !mic) return;

      if (!SpeechRecognitionCtor) {
        showFallback(
          'Voice recognition is not available in this browser.',
          'You can still study the word and listen to the American English pronunciation.'
        );
        setStatus('Voice recognition is unavailable here. Use Show Answer to keep studying.', 'error');
        return;
      }

      if (state.recognitionBlocked) {
        unsupported.hidden = false;
        mic.hidden = true;
        mic.disabled = true;
        return;
      }

      unsupported.hidden = true;
      mic.hidden = false;
      mic.disabled = false;
    }

    function createRecognition() {
      if (!SpeechRecognitionCtor) return null;

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = state.topic?.englishVariant || 'en-US';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 5;

      recognition.onstart = () => {
        state.recognitionStarting = false;
        state.recognitionStartedAt = Date.now();
        state.recognitionBlocked = false;

        if (browserDocument.visibilityState === 'hidden' || !state.inSpeakScreen || !state.recognitionSessionWanted) {
          try { recognition.abort(); } catch (error) {}
          setMicState(false);
          return;
        }

        setMicState(true);
        const mic = $('topic-speak-mic');
        if (mic && state.started && !state.recognitionBlocked) mic.disabled = false;
        hideHeard();
        if (state.started && !state.currentWordResolved && !state.recognitionPaused) {
          armRecognitionForCurrentWord(180);
        } else {
          state.acceptingRecognition = false;
          setStatus(state.recognitionPaused ? 'Microphone paused. Tap Speak to continue.' : 'Microphone ready.');
        }
      };

      recognition.onresult = (event) => {
        if (state.recognitionPaused || !state.acceptingRecognition || Date.now() < state.ignoreRecognitionUntil) return;

        const word = currentWord();
        if (!word || state.currentWordResolved || !state.started) return;

        const results = event.results?.[event.resultIndex || 0];
        if (!results) return;

        const alternatives = [];
        for (let i = 0; i < results.length; i += 1) {
          const transcript = String(results[i]?.transcript || '').trim();
          if (transcript) alternatives.push(transcript);
        }

        const bestTranscript = alternatives[0] || '';
        if (isCorrectAnswer(bestTranscript, word)) {
          showCorrectResult(word, bestTranscript);
        } else {
          showWrongResult(bestTranscript);
        }
      };

      recognition.onerror = (event) => {
        const code = event?.error || 'unknown';
        const messages = {
          'not-allowed': 'Microphone permission was denied. Allow microphone access and try again.',
          'service-not-allowed': 'Voice recognition is blocked in this browser.',
          'audio-capture': 'No microphone was detected.',
          'no-speech': 'I did not hear a word. Try again.',
          'network': 'Voice recognition could not connect. Check your connection and try again.'
        };

        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(code)) {
          state.recognitionBlocked = true;
          const fallbackTitle = code === 'audio-capture'
            ? 'No microphone is available.'
            : 'Microphone access is blocked.';
          showFallback(
            fallbackTitle,
            'You can continue with Show Answer, then listen to the American English pronunciation.'
          );
        }

        setStatus(messages[code] || 'Voice recognition stopped. Try again.', 'error');
      };

      recognition.onend = () => {
        state.recognitionStarting = false;
        state.recognitionStartedAt = 0;
        state.acceptingRecognition = false;
        setMicState(false);

        if (state.recognitionSessionWanted && !state.recognitionPaused && state.inSpeakScreen && !state.recognitionBlocked && pageCanUseMicrophone()) {
          clearRecognitionRestartTimer();
          state.recognitionRestartTimer = browserWindow.setTimeout(() => {
            state.recognitionRestartTimer = null;
            startRecognitionSession();
          }, 260);
        }
      };

      return recognition;
    }

    function startRecognitionSession() {
      if (!state.inSpeakScreen || !state.recognitionSessionWanted || state.recognitionPaused || state.listening || state.recognitionStarting || !SpeechRecognitionCtor) return;
      if (!pageCanUseMicrophone()) return;

      if (!state.recognition) {
        state.recognition = createRecognition();
      }
      if (!state.recognition) return;

      state.recognition.lang = state.topic?.englishVariant || 'en-US';

      const mic = $('topic-speak-mic');
      if (mic) mic.disabled = true;

      state.recognitionStarting = true;
      state.recognitionStartedAt = 0;
      setStatus('Starting microphone…');

      try {
        state.recognition.start();
      } catch (error) {
        state.recognitionStarting = false;
        if (mic && pageCanUseMicrophone()) mic.disabled = false;
        setMicState(false);
        setStatus('Could not start the microphone yet. Tap Speak to retry.', 'error');
        console.warn('TOPICS Speak: recognition start failed.', error);
      }
    }

    function toggleListening() {
      if (!state.inSpeakScreen || !state.started || state.recognitionBlocked) return;

      if (state.recognitionPaused) {
        state.recognitionPaused = false;
        state.recognitionSessionWanted = true;
        setMicState(state.listening);

        if (state.listening) {
          armRecognitionForCurrentWord(120);
        } else if (!state.recognitionStarting) {
          startRecognitionSession();
        }
        return;
      }

      if (state.listening || state.recognitionStarting || state.recognitionSessionWanted) {
        state.recognitionPaused = true;
        state.acceptingRecognition = false;
        clearAcceptRecognitionTimer();
        setMicState(state.listening);

        const mic = $('topic-speak-mic');
        if (mic && pageCanUseMicrophone()) mic.disabled = false;
        setStatus('Microphone paused. Tap Speak to continue.');
        return;
      }

      state.recognitionPaused = false;
      state.recognitionSessionWanted = true;
      startRecognitionSession();
    }

    return {
      isSupported: Boolean(SpeechRecognitionCtor),
      pageCanUseMicrophone,
      clearRecognitionRestartTimer,
      clearAcceptRecognitionTimer,
      armRecognitionForCurrentWord,
      stopRecognition,
      suspendMicrophoneForPageLifecycle,
      resumeMicrophoneControlsAfterFocus,
      setRecognitionAvailability,
      startRecognitionSession,
      toggleListening
    };
  }

  window.TopicSpeakRecognition = { create };
})();
