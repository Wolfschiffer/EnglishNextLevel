(function () {
  const MIC_DEVICE_STORAGE_KEY = 'englishNextLevel.topicSpeak.microphoneDeviceId';

  function supportsAudioTrackInput(browserWindow) {
    const navigator = browserWindow.navigator || {};
    const userAgent = String(navigator.userAgent || '');
    if (navigator.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod/i.test(userAgent)) return false;

    // SpeechRecognition.start(audioTrack) is currently implemented in desktop
    // Chromium 135+ and Edge mirrors that support. It is not available in the
    // mobile Chromium or Safari implementations, so don't show a selector that
    // would appear to work while recognition silently uses the default mic.
    const chromiumVersion = userAgent.match(/(?:Edg|Chrome|Chromium)\/(\d+)/);
    return Boolean(chromiumVersion && Number(chromiumVersion[1]) >= 135);
  }

  function create({
    state,
    window: browserWindow,
    document: browserDocument,
    SpeechRecognitionCtor,
    getElement,
    currentWord,
    matchAnswer,
    setStatus,
    setMicState,
    stopSpeech,
    hideHeard,
    showFallback,
    showCorrectResult,
    showWrongResult
  }) {
    const $ = getElement;
    const browserNavigator = browserWindow.navigator || {};
    const mediaDevices = browserNavigator.mediaDevices;
    const canSelectMicrophone = Boolean(
      SpeechRecognitionCtor &&
      supportsAudioTrackInput(browserWindow) &&
      mediaDevices?.getUserMedia &&
      mediaDevices?.enumerateDevices
    );
    let selectedMicrophoneDeviceId = '';
    let selectedMicrophoneStream = null;
    let activeMicrophoneDeviceId = '';
    let recognitionStartToken = 0;

    try {
      selectedMicrophoneDeviceId = browserWindow.sessionStorage.getItem(MIC_DEVICE_STORAGE_KEY) || '';
    } catch (error) {
      selectedMicrophoneDeviceId = '';
    }

    function saveSelectedMicrophone() {
      try {
        if (selectedMicrophoneDeviceId) {
          browserWindow.sessionStorage.setItem(MIC_DEVICE_STORAGE_KEY, selectedMicrophoneDeviceId);
        } else {
          browserWindow.sessionStorage.removeItem(MIC_DEVICE_STORAGE_KEY);
        }
      } catch (error) {
        // Restricted storage must not prevent microphone use.
      }
    }

    function stopStream(stream) {
      for (const track of stream?.getTracks?.() || []) {
        try { track.stop(); } catch (error) {}
      }
    }

    function releaseSelectedMicrophone() {
      stopStream(selectedMicrophoneStream);
      selectedMicrophoneStream = null;
      activeMicrophoneDeviceId = '';
    }

    function setMicrophoneChoiceStatus(message) {
      const status = $('topic-speak-mic-choice-status');
      if (status) status.textContent = message;
    }

    function createMicrophoneOption(label, value) {
      const option = browserDocument.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }

    async function refreshMicrophoneChoices() {
      const refreshButton = $('topic-speak-mic-refresh');
      const select = $('topic-speak-mic-select');
      if (!canSelectMicrophone || !refreshButton || !select) return;

      refreshButton.disabled = true;
      select.disabled = true;
      setMicrophoneChoiceStatus('Allow microphone access to list connected microphones.');
      let permissionStream = null;

      try {
        permissionStream = await mediaDevices.getUserMedia({ audio: true });
        const devices = await mediaDevices.enumerateDevices();
        const microphones = devices.filter((device) => device.kind === 'audioinput');

        select.innerHTML = '';
        select.appendChild(createMicrophoneOption('Use device default', ''));
        let selectedDeviceStillExists = !selectedMicrophoneDeviceId;

        microphones.forEach((device, index) => {
          const label = String(device.label || `Microphone ${index + 1}`).trim();
          select.appendChild(createMicrophoneOption(label, device.deviceId));
          if (device.deviceId === selectedMicrophoneDeviceId) selectedDeviceStillExists = true;
        });

        if (!selectedDeviceStillExists) {
          selectedMicrophoneDeviceId = '';
          saveSelectedMicrophone();
        }
        select.value = selectedMicrophoneDeviceId;
        select.disabled = microphones.length === 0;
        setMicrophoneChoiceStatus(microphones.length
          ? 'Choose a connected microphone. The choice applies when you next tap Speak.'
          : 'No microphones were listed. The browser default will be used.');
      } catch (error) {
        setMicrophoneChoiceStatus(error?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow it in browser settings, then try again.'
          : 'Could not list microphones. The browser default will be used.');
      } finally {
        stopStream(permissionStream);
        refreshButton.disabled = false;
      }
    }

    function initializeMicrophoneChoices() {
      const choicePanel = $('topic-speak-mic-choice');
      const deviceNote = $('topic-speak-mic-device-note');
      const select = $('topic-speak-mic-select');
      const refreshButton = $('topic-speak-mic-refresh');
      if (choicePanel) choicePanel.hidden = !canSelectMicrophone;
      if (deviceNote) deviceNote.hidden = canSelectMicrophone;
      if (!canSelectMicrophone) return;

      if (select) {
        select.addEventListener('change', () => {
          selectedMicrophoneDeviceId = String(select.value || '');
          saveSelectedMicrophone();
          setMicrophoneChoiceStatus(selectedMicrophoneDeviceId
            ? 'Microphone saved. It will be used the next time you tap Speak.'
            : 'The browser default microphone will be used.');

          if (state.listening || state.recognitionStarting || state.recognitionSessionWanted) {
            stopRecognition({ disableMic: false, endSession: true });
            state.recognitionPaused = true;
            setStatus('Microphone changed. Tap Speak to reconnect.');
          }
        });
      }
      refreshButton?.addEventListener('click', refreshMicrophoneChoices);
    }

    initializeMicrophoneChoices();

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
        setRecognitionPhrases(state.recognition, currentWord());
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

    function setRecognitionPhrases(recognition, word) {
      const PhraseCtor = browserWindow.SpeechRecognitionPhrase || browserWindow.webkitSpeechRecognitionPhrase;
      if (!recognition || !('phrases' in recognition) || typeof PhraseCtor !== 'function') return;

      const phrases = [...new Set([
        word?.english,
        ...(Array.isArray(word?.accepted) ? word.accepted : []),
        ...(Array.isArray(word?.recognitionAliases) ? word.recognitionAliases : [])
      ].map((phrase) => String(phrase || '').trim()).filter(Boolean))];

      try {
        // Contextual biasing is experimental, so browsers without it keep the
        // normal recognition path and the answer matcher handles alternatives.
        recognition.phrases = phrases.map((phrase) => new PhraseCtor(phrase, 5));
      } catch (error) {
        // Unsupported implementations should not interrupt the Speak round.
      }
    }

    function stopRecognition({ disableMic = false, endSession = true } = {}) {
      recognitionStartToken += 1;
      state.recognitionStarting = false;
      state.recognitionStartedAt = 0;
      state.acceptingRecognition = false;
      clearAcceptRecognitionTimer();
      clearRecognitionRestartTimer();

      if (endSession) {
        state.recognitionSessionWanted = false;
      }

      releaseSelectedMicrophone();

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
          disableMic: true,
          endSession: false
        });
      } else {
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
          'Type your answer below, or show the answer and listen to its American English pronunciation.'
        );
        setStatus('Voice recognition is unavailable here. Type your answer to keep playing.', 'error');
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
        const correctAlternative = alternatives
          .map((transcript) => ({ transcript, match: matchAnswer(transcript, word) }))
          .find((candidate) => candidate.match?.correct);
        if (correctAlternative) {
          showCorrectResult(word, correctAlternative.match.answer, correctAlternative.match.corrected);
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

        if (code === 'audio-capture') {
          releaseSelectedMicrophone();
          state.recognitionPaused = true;
          state.recognitionSessionWanted = false;
          state.acceptingRecognition = false;
          clearAcceptRecognitionTimer();
          clearRecognitionRestartTimer();
          setMicState(false);
          const mic = $('topic-speak-mic');
          if (mic) {
            mic.hidden = false;
            mic.disabled = false;
          }
          setStatus('Microphone is busy or unavailable. Type your answer, or free it and tap Speak to retry.', 'error');
          return;
        }

        if (['not-allowed', 'service-not-allowed'].includes(code)) {
          state.recognitionBlocked = true;
          showFallback(
            'Microphone access is blocked.',
            'Type your answer below, or show the answer and listen to its American English pronunciation.'
          );
        }

        setStatus(messages[code] || 'Voice recognition stopped. Try again.', 'error');
      };

      recognition.onend = () => {
        state.recognitionStarting = false;
        state.recognitionStartedAt = 0;
        state.acceptingRecognition = false;
        setMicState(false);

        if (!state.recognitionSessionWanted) releaseSelectedMicrophone();

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

      const recognition = state.recognition;
      const startToken = ++recognitionStartToken;

      function startWithTrack(track = null) {
        if (
          startToken !== recognitionStartToken ||
          !state.inSpeakScreen ||
          !state.recognitionSessionWanted ||
          state.recognitionPaused ||
          !pageCanUseMicrophone()
        ) return;

        try {
          if (track) recognition.start(track);
          else recognition.start();
        } catch (error) {
          if (track) releaseSelectedMicrophone();
          state.recognitionStarting = false;
          if (track) {
            state.recognitionSessionWanted = false;
            state.recognitionPaused = true;
          }
          if (mic && pageCanUseMicrophone()) mic.disabled = false;
          setMicState(false);
          setStatus(track
            ? 'Could not use that microphone. Choose another one in Settings, use the default, or type your answer.'
            : 'Could not start the microphone yet. Tap Speak to retry.', 'error');
          console.warn('TOPICS Speak: recognition start failed.', error);
        }
      }

      if (!selectedMicrophoneDeviceId || !canSelectMicrophone) {
        startWithTrack();
        return;
      }

      const existingTrack = selectedMicrophoneStream?.getAudioTracks?.()[0];
      if (activeMicrophoneDeviceId === selectedMicrophoneDeviceId && existingTrack?.readyState === 'live') {
        startWithTrack(existingTrack);
        return;
      }

      releaseSelectedMicrophone();
      Promise.resolve().then(() => mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: selectedMicrophoneDeviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })).then((stream) => {
        const track = stream?.getAudioTracks?.()[0];
        if (!track) {
          stopStream(stream);
          throw new Error('The selected microphone returned no audio track.');
        }

        if (startToken !== recognitionStartToken || !state.recognitionSessionWanted || !state.inSpeakScreen) {
          stopStream(stream);
          return;
        }

        selectedMicrophoneStream = stream;
        activeMicrophoneDeviceId = selectedMicrophoneDeviceId;
        startWithTrack(track);
      }).catch((error) => {
        if (startToken !== recognitionStartToken) return;
        releaseSelectedMicrophone();
        state.recognitionStarting = false;
        state.recognitionSessionWanted = false;
        state.recognitionPaused = true;
        if (mic && pageCanUseMicrophone()) mic.disabled = false;
        setMicState(false);
        setStatus(error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError'
          ? 'That microphone is no longer available. Choose another microphone in Settings.'
          : 'Could not open that microphone. Choose the device default in Settings or answer by typing.', 'error');
      });
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
      canSelectMicrophone,
      refreshMicrophoneChoices,
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

  window.TopicSpeakRecognition = { create, supportsAudioTrackInput };
})();
