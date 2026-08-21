// ============================================
// TOPICS — SPEAK
// Phase 4: Portuguese prompt -> spoken English answer
// American English (en-US) is the primary target.
// ============================================

(function () {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  const state = {
    topic: null,
    level: null,
    words: [],
    currentIndex: 0,
    started: false,
    listening: false,
    recognition: null,
    currentWordResolved: false,
    recognitionBlocked: false,
    activeUtterance: null,
    showPreAnswerAudio: false,
    voiceVolume: 100,
    sfxVolume: 100,
    speechOutputPrimed: false,
    pendingPronunciation: null,
    recognitionStarting: false,
    recognitionStartedAt: 0,
    pageFocused: typeof document.hasFocus === 'function' ? document.hasFocus() : true,
    suspendedByPageLifecycle: false,
    blurLifecycleTimer: null,
    autoAdvanceTimer: null,
    inSpeakScreen: false,
    recognitionSessionWanted: false,
    recognitionRestartTimer: null,
    recognitionPaused: false,
    acceptingRecognition: false,
    acceptRecognitionTimer: null,
    ignoreRecognitionUntil: 0
  };

  function $(id) {
    return document.getElementById(id);
  }


  const SETTINGS_STORAGE_KEY = 'englishNextLevel.topicSpeak.showPreAnswerAudio';

  function clampVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 100;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function loadVoiceVolume() {
    state.voiceVolume = window.EnglishNextLevelAudio?.getVoiceVolume?.() ?? 100;
  }

  function loadSfxVolume() {
    state.sfxVolume = window.EnglishNextLevelAudio?.getSfxVolume?.() ?? 100;
  }

  function getVoiceVolume() {
    state.voiceVolume = window.EnglishNextLevelAudio?.getVoiceVolume?.() ?? state.voiceVolume;
    return state.voiceVolume;
  }

  function getSfxVolume() {
    state.sfxVolume = window.EnglishNextLevelAudio?.getSfxVolume?.() ?? state.sfxVolume;
    return state.sfxVolume;
  }

  function playSfx(type) {
    window.EnglishNextLevelAudio?.playSfx?.(type);
  }

  function unlockSfx() {
    window.EnglishNextLevelAudio?.unlockSfx?.();
  }

  function getVolumeIcon(volume) {
    const level = clampVolume(volume);
    if (level === 0) return '🔇';
    if (level <= 33) return '🔈';
    if (level <= 66) return '🔉';
    return '🔊';
  }

  function loadSettings() {
    try {
      state.showPreAnswerAudio = window.sessionStorage.getItem(SETTINGS_STORAGE_KEY) === 'true';
    } catch (error) {
      state.showPreAnswerAudio = false;
    }
    loadVoiceVolume();
    loadSfxVolume();
  }

  function saveSettings() {
    try {
      window.sessionStorage.setItem(SETTINGS_STORAGE_KEY, state.showPreAnswerAudio ? 'true' : 'false');
    } catch (error) {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }

  function syncVoiceVolumeUI() {
    state.voiceVolume = getVoiceVolume();
    const slider = $('topic-speak-voice-volume');
    const value = $('topic-speak-voice-volume-value');
    const icon = $('topic-speak-voice-volume-icon');

    if (slider) {
      slider.value = String(state.voiceVolume);
      slider.setAttribute('aria-valuenow', String(state.voiceVolume));
      slider.style.setProperty('--topic-speak-volume-percent', `${state.voiceVolume}%`);
    }
    if (value) value.textContent = `${state.voiceVolume}%`;
    if (icon) icon.textContent = getVolumeIcon(state.voiceVolume);
  }

  function syncSfxVolumeUI() {
    const slider = $('topic-speak-sfx-volume');
    const value = $('topic-speak-sfx-volume-value');
    const icon = $('topic-speak-sfx-volume-icon');

    state.sfxVolume = getSfxVolume();

    if (slider) {
      slider.value = String(state.sfxVolume);
      slider.setAttribute('aria-valuenow', String(state.sfxVolume));
      slider.style.setProperty('--topic-speak-volume-percent', `${state.sfxVolume}%`);
    }
    if (value) value.textContent = `${state.sfxVolume}%`;
    if (icon) icon.textContent = getVolumeIcon(state.sfxVolume);
  }

  function setVoiceVolume(value) {
    state.voiceVolume = clampVolume(value);
    window.EnglishNextLevelAudio?.setVoiceVolume?.(state.voiceVolume);
    stopSpeech();
    syncVoiceVolumeUI();
  }

  function setSfxVolume(value) {
    state.sfxVolume = clampVolume(value);
    window.EnglishNextLevelAudio?.setSfxVolume?.(state.sfxVolume);
    syncSfxVolumeUI();
  }

  function syncSettingsUI() {
    const toggle = $('topic-speak-preaudio-toggle');
    if (toggle) toggle.checked = state.showPreAnswerAudio;
    syncVoiceVolumeUI();
    syncSfxVolumeUI();
    updatePreviewAudioVisibility();
  }

  function updatePreviewAudioVisibility() {
    const button = $('topic-speak-preview-audio');
    const word = currentWord();
    if (!button) return;

    const shouldShow = Boolean(
      state.started &&
      !state.currentWordResolved &&
      word &&
      state.showPreAnswerAudio
    );

    button.hidden = !shouldShow;
    button.disabled = !shouldShow;
    if (word) {
      button.setAttribute('aria-label', `Listen to the English pronunciation for ${word.portuguese}`);
    }
  }

  function openSettings() {
    state.acceptingRecognition = false;
    clearAcceptRecognitionTimer();
    stopSpeech();
    const overlay = $('topic-speak-settings-overlay');
    if (!overlay) return;
    loadVoiceVolume();
    loadSfxVolume();
    syncSettingsUI();
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    $('topic-speak-preaudio-toggle')?.focus({ preventScroll: true });
  }

  function closeSettings() {
    const overlay = $('topic-speak-settings-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    $('topic-speak-settings-btn')?.focus({ preventScroll: true });
    if (state.started && !state.currentWordResolved && state.listening && !state.recognitionPaused && pageCanUseMicrophone()) {
      armRecognitionForCurrentWord(250);
    }
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function normalizeAnswer(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function removeLeadingArticle(value) {
    return value.replace(/^(a|an|the)\s+/, '').trim();
  }

  function currentWord() {
    return state.words[state.currentIndex] || null;
  }

  function acceptedAnswers(word) {
    const source = Array.isArray(word?.accepted) && word.accepted.length
      ? word.accepted
      : [word?.english];
    const recognitionAliases = Array.isArray(word?.recognitionAliases)
      ? word.recognitionAliases
      : [];

    return [...source, ...recognitionAliases]
      .filter(Boolean)
      .map(normalizeAnswer)
      .filter(Boolean);
  }

  function answerIsCorrect(transcript, word) {
    const normalized = normalizeAnswer(transcript);
    const withoutArticle = removeLeadingArticle(normalized);

    return acceptedAnswers(word).some((accepted) => {
      return normalized === accepted || withoutArticle === accepted;
    });
  }

  function setStatus(message, type = '') {
    const el = $('topic-speak-status');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('is-listening', 'is-correct', 'is-wrong', 'is-error');
    if (type) el.classList.add(`is-${type}`);
  }

  function setMicState(listening) {
    state.listening = Boolean(listening);
    const button = $('topic-speak-mic');
    const label = $('topic-speak-mic-label');
    if (!button || !label) return;

    // `state.listening` means the browser recognition session is alive.
    // `recognitionPaused` means the game is intentionally ignoring audio while
    // keeping that same browser session alive, avoiding a new permission flow.
    const activelyListening = state.listening && !state.recognitionPaused;
    button.classList.toggle('is-listening', activelyListening);
    button.setAttribute('aria-pressed', activelyListening ? 'true' : 'false');
    label.textContent = activelyListening ? 'LISTENING…' : 'SPEAK';
  }

  function pageCanUseMicrophone() {
    const visible = typeof document.visibilityState !== 'string' || document.visibilityState === 'visible';
    return visible && state.pageFocused;
  }

  function clearRecognitionRestartTimer() {
    if (state.recognitionRestartTimer) {
      window.clearTimeout(state.recognitionRestartTimer);
      state.recognitionRestartTimer = null;
    }
  }

  function clearAcceptRecognitionTimer() {
    if (state.acceptRecognitionTimer) {
      window.clearTimeout(state.acceptRecognitionTimer);
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
      state.acceptRecognitionTimer = window.setTimeout(activate, delay);
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
      // No recognition session is active; only keep the controls disabled while
      // the page is genuinely outside the foreground/focus state.
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

  function stopSpeech() {
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

  function primeSpeechOutput() {
    if (state.speechOutputPrimed || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(' ');
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

  function clearAutoAdvance() {
    if (state.autoAdvanceTimer) {
      window.clearTimeout(state.autoAdvanceTimer);
      state.autoAdvanceTimer = null;
    }
  }

  function scheduleAutoAdvance(delay = 700) {
    clearAutoAdvance();
    state.autoAdvanceTimer = window.setTimeout(() => {
      state.autoAdvanceTimer = null;
      if (!state.started || !state.currentWordResolved) return;
      nextWord();
    }, delay);
  }

  function playPronunciation(word, button, onDone = null) {
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

    stopSpeech();

    const voiceVolume = getVoiceVolume();
    if (voiceVolume <= 0) {
      window.setTimeout(finish, 650);
      return;
    }

    const locale = state.topic?.englishVariant || 'en-US';
    const utterance = new SpeechSynthesisUtterance(word.english);
    const voice = getAmericanVoice(locale);

    utterance.lang = locale;
    utterance.rate = 0.9;
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

  function updateHeader() {
    const topicTitle = $('topic-speak-title');
    const levelLabel = $('topic-speak-level');
    const current = $('topic-speak-current');
    const total = $('topic-speak-total');
    const count = state.words.length;

    if (topicTitle) topicTitle.textContent = state.topic?.title || 'Speak';
    if (levelLabel) {
      const label = state.level?.label || '';
      levelLabel.textContent = `${label.toUpperCase()} · ${count} ${count === 1 ? 'WORD' : 'WORDS'}`;
    }
    if (current) current.textContent = String(Math.min(state.currentIndex + 1, Math.max(count, 1)));
    if (total) total.textContent = String(count);
  }

  function hideResult() {
    const result = $('topic-speak-result');
    if (result) result.hidden = true;
  }

  function hideHeard() {
    const heard = $('topic-speak-heard');
    if (heard) heard.hidden = true;
    const transcript = $('topic-speak-transcript');
    if (transcript) transcript.textContent = '';
  }

  function showFallback(title, message) {
    const unsupported = $('topic-speak-unsupported');
    const mic = $('topic-speak-mic');
    const fallbackTitle = $('topic-speak-fallback-title');
    const fallbackText = $('topic-speak-fallback-text');

    if (fallbackTitle && title) fallbackTitle.textContent = title;
    if (fallbackText && message) fallbackText.textContent = message;
    if (unsupported) unsupported.hidden = false;
    if (mic) mic.hidden = true;
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
    // A new word/round must always restore the microphone button. A correct
    // answer disables it temporarily, so without this reset the next level
    // (for example Common -> Advanced) can inherit a disabled button.
    mic.disabled = false;
  }

  function renderCurrentWord({ resumeListeningDelay = 0 } = {}) {
    clearAutoAdvance();
    clearAcceptRecognitionTimer();
    state.acceptingRecognition = false;
    stopSpeech();

    const word = currentWord();
    if (!word) {
      showReview();
      return;
    }

    state.currentWordResolved = false;
    updateHeader();
    updatePreviewAudioVisibility();

    const portuguese = $('topic-speak-portuguese');
    if (portuguese) portuguese.textContent = word.portuguese;

    hideHeard();
    hideResult();


    const reveal = $('topic-speak-reveal');
    if (reveal) reveal.disabled = false;

    setRecognitionAvailability();
    if (SpeechRecognitionCtor) {
      if (state.started && state.recognitionSessionWanted) {
        if (state.recognitionPaused) {
          setStatus('Microphone paused. Tap Speak to continue.');
        } else if (state.listening) {
          armRecognitionForCurrentWord(resumeListeningDelay);
        } else {
          setStatus('Starting microphone…');
        }
      } else if (state.started) {
        setStatus('Microphone paused. Tap Speak to continue.');
      } else {
        setStatus('Press START to begin.');
      }
    }
  }

  function showTranscript(transcript) {
    const heard = $('topic-speak-heard');
    const transcriptEl = $('topic-speak-transcript');
    if (transcriptEl) transcriptEl.textContent = transcript || '—';
    if (heard) heard.hidden = false;
  }

  function showCorrectResult(word, transcript) {
    state.currentWordResolved = true;
    playSfx('correct');
    updatePreviewAudioVisibility();
    showTranscript(transcript);
    setStatus('Correct! Moving to the next word…', 'correct');

    const result = $('topic-speak-result');
    const icon = $('topic-speak-result-icon');
    const title = $('topic-speak-result-title');
    const answer = $('topic-speak-answer');

    if (result) result.hidden = false;
    if (icon) icon.textContent = '✓';
    if (title) title.textContent = 'Correct!';
    if (answer) answer.textContent = word.english;

    const mic = $('topic-speak-mic');
    if (mic && !state.recognitionBlocked) mic.disabled = false;

    const audio = $('topic-speak-audio');
    if (audio) {
      audio.disabled = false;
      audio.setAttribute('aria-label', `Listen to ${word.english} in American English`);
    }

    // Keep one recognition session alive for the whole Speak visit. While the
    // correct pronunciation is played, recognition results are ignored so the
    // browser cannot mistake TTS output for the learner's next answer.
    state.acceptingRecognition = false;
    state.ignoreRecognitionUntil = Date.now() + 4000;
    scheduleAutoAdvance(3200);
    const afterPronunciation = () => scheduleAutoAdvance(420);
    window.setTimeout(() => playPronunciation(word, audio, afterPronunciation), 180);
  }

  function showWrongResult(transcript) {
    playSfx('wrong');
    showTranscript(transcript);
    hideResult();

    // A wrong answer pauses the GAME listener by default. Keep the underlying
    // continuous browser session alive so retrying does not create a new
    // permission request. No recognition result is accepted until SPEAK is
    // pressed again.
    state.recognitionPaused = true;
    state.acceptingRecognition = false;
    clearAcceptRecognitionTimer();
    setMicState(state.listening);
    setStatus('Not quite. Tap Speak to try again.', 'wrong');

    const mic = $('topic-speak-mic');
    if (mic) mic.disabled = false;
  }

  function revealAnswer() {
    const word = currentWord();
    if (!word) return;

    state.acceptingRecognition = false;
    clearAcceptRecognitionTimer();
    state.currentWordResolved = true;
    updatePreviewAudioVisibility();
    hideHeard();
    setStatus('Answer shown. Moving to the next word…');

    const result = $('topic-speak-result');
    const icon = $('topic-speak-result-icon');
    const title = $('topic-speak-result-title');
    const answer = $('topic-speak-answer');

    if (result) result.hidden = false;
    if (icon) icon.textContent = '•';
    if (title) title.textContent = 'Answer';
    if (answer) answer.textContent = word.english;

    const audio = $('topic-speak-audio');
    if (audio) {
      audio.disabled = false;
      audio.setAttribute('aria-label', `Listen to ${word.english} in American English`);
    }

    const reveal = $('topic-speak-reveal');
    if (reveal) reveal.disabled = true;

    state.ignoreRecognitionUntil = Date.now() + 4200;
    scheduleAutoAdvance(3200);
    window.setTimeout(() => {
      playPronunciation(word, audio, () => scheduleAutoAdvance(700));
    }, 180);
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

      // A hidden page must never keep the microphone. For a visible page,
      // allow the browser a moment to return focus after closing its native
      // permission prompt before deciding that focus was genuinely lost.
      if (document.visibilityState === 'hidden' || !state.inSpeakScreen || !state.recognitionSessionWanted) {
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

      // Validate only the transcript we actually show to the learner.
      // Previously, a lower-ranked hidden alternative could mark the answer
      // as correct while "I heard" displayed a different word, which was
      // confusing (for example: showing "gratitude" but accepting because
      // another hidden alternative was "grater").
      if (answerIsCorrect(bestTranscript, word)) {
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
        state.recognitionRestartTimer = window.setTimeout(() => {
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

    // SPEAK while soft-paused: resume the SAME continuous recognition session.
    // If the browser session is still alive, this does not call start() again.
    if (state.recognitionPaused) {
      state.recognitionPaused = false;
      state.recognitionSessionWanted = true;
      setMicState(state.listening);

      if (state.listening) {
        armRecognitionForCurrentWord(120);
      } else if (!state.recognitionStarting) {
        // The session may have ended for a browser/lifecycle reason while paused.
        // Only in that case is a new browser session required.
        startRecognitionSession();
      }
      return;
    }

    // LISTENING -> SPEAK: soft-pause only. Do NOT abort/stop the underlying
    // continuous browser recognition session, otherwise Chromium may treat the
    // next start as a new microphone permission session (especially file://).
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

    // No browser session exists yet. Start the first one.
    state.recognitionPaused = false;
    state.recognitionSessionWanted = true;
    startRecognitionSession();
  }


  function showStartOverlay() {
    const overlay = $('topic-speak-start-overlay');
    if (!overlay) return;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function hideStartOverlay() {
    const overlay = $('topic-speak-start-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function hideReview() {
    stopSpeech();
    const review = $('topic-speak-review');
    const playArea = $('topic-speak-play-area');

    if (review) {
      review.classList.remove('visible');
      review.setAttribute('aria-hidden', 'true');
    }
    if (playArea) playArea.hidden = false;
  }

  function renderReview() {
    const list = $('topic-speak-review-list');
    if (!list) return;

    list.innerHTML = '';

    state.words.forEach((word) => {
      const row = document.createElement('div');
      row.className = 'topic-review-row';

      const english = document.createElement('div');
      english.className = 'topic-review-english';

      const englishText = document.createElement('strong');
      englishText.className = 'topic-review-word';
      englishText.textContent = word.english;

      const audioButton = document.createElement('button');
      audioButton.type = 'button';
      audioButton.className = 'topic-review-audio';
      audioButton.textContent = '🔊';
      audioButton.setAttribute('aria-label', `Listen to ${word.english} in American English`);
      audioButton.addEventListener('click', () => playPronunciation(word, audioButton));

      english.append(englishText, audioButton);

      const portuguese = document.createElement('div');
      portuguese.className = 'topic-review-portuguese';
      portuguese.textContent = word.portuguese;

      row.append(english, portuguese);
      list.appendChild(row);
    });
  }

  function showReview() {
    state.recognitionPaused = true;
    state.acceptingRecognition = false;
    clearAcceptRecognitionTimer();
    setMicState(state.listening);
    stopSpeech();
    state.started = false;
    playSfx('win');
    updatePreviewAudioVisibility();

    renderReview();

    const playArea = $('topic-speak-play-area');
    const review = $('topic-speak-review');
    if (playArea) playArea.hidden = true;
    if (review) {
      review.classList.add('visible');
      review.setAttribute('aria-hidden', 'false');
      review.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    }
  }

  function nextWord() {
    if (!state.currentWordResolved) return;

    clearAutoAdvance();
    state.currentIndex += 1;
    if (state.currentIndex >= state.words.length) {
      showReview();
      return;
    }

    const mic = $('topic-speak-mic');
    if (mic) mic.disabled = false;
    renderCurrentWord({ resumeListeningDelay: 650 });
  }

  function startRound() {
    // START libera tanto a voz quanto os SFX no gesto explícito do usuário.
    unlockSfx();
    primeSpeechOutput();

    state.started = true;
    state.recognitionPaused = false;
    state.recognitionSessionWanted = Boolean(SpeechRecognitionCtor);
    hideStartOverlay();
    renderCurrentWord();
    updatePreviewAudioVisibility();

    const mic = $('topic-speak-mic');
    const reveal = $('topic-speak-reveal');
    if (SpeechRecognitionCtor) {
      // START opens the session only when one does not already exist. If Play
      // Again is used while the continuous session is still alive, simply arm
      // it for the new round instead of requesting a new browser session.
      if (state.listening) {
        setMicState(true);
        armRecognitionForCurrentWord(180);
      } else {
        startRecognitionSession();
      }
      mic?.focus({ preventScroll: true });
    } else {
      reveal?.focus({ preventScroll: true });
    }
  }

  function prepare({ topic, level }) {
    if (!topic || !level || !Array.isArray(level.words)) {
      console.error('TOPICS Speak: invalid topic or level data.');
      return;
    }

    leaveGame();

    state.inSpeakScreen = true;
    state.topic = topic;
    state.level = level;
    state.words = shuffle(level.words);
    state.currentIndex = 0;
    state.started = false;
    state.currentWordResolved = false;
    state.recognitionBlocked = false;
    state.recognition = null;
    state.recognitionStarting = false;
    state.recognitionStartedAt = 0;
    state.pendingPronunciation = null;
    state.suspendedByPageLifecycle = false;
    state.recognitionSessionWanted = false;
    state.recognitionPaused = false;
    state.acceptingRecognition = false;
    state.ignoreRecognitionUntil = 0;
    clearRecognitionRestartTimer();
    clearAcceptRecognitionTimer();
    clearBlurLifecycleTimer();
    clearAutoAdvance();

    const mic = $('topic-speak-mic');
    if (mic) {
      mic.disabled = false;
      mic.hidden = false;
      mic.classList.remove('is-listening');
      mic.setAttribute('aria-pressed', 'false');
    }

    updateHeader();
    hideReview();
    renderCurrentWord();
    showStartOverlay();
  }

  function playAgain() {
    if (!state.topic || !state.level) return;

    clearAutoAdvance();
    clearAcceptRecognitionTimer();
    stopSpeech();
    state.words = shuffle(state.level.words);
    state.currentIndex = 0;
    state.started = false;
    state.currentWordResolved = false;
    state.recognitionPaused = true;
    state.acceptingRecognition = false;
    setMicState(state.listening);
    state.recognitionBlocked = false;

    updateHeader();
    hideReview();
    renderCurrentWord();
    showStartOverlay();
  }

  function backToTopic() {
    leaveGame();
    // Current flow: Topic -> Level -> Game -> Speak.
    // Two back operations return to the selected topic's Common/Advanced screen.
    if (typeof window.goBack === 'function') {
      window.goBack(2);
    }
  }

  function leaveGame() {
    clearAutoAdvance();
    clearAcceptRecognitionTimer();
    state.inSpeakScreen = false;
    state.recognitionSessionWanted = false;
    stopRecognition({ endSession: true });
    state.recognitionPaused = false;
    stopSpeech();
    state.started = false;
    state.currentWordResolved = false;
    state.pendingPronunciation = null;
    clearBlurLifecycleTimer();
    hideStartOverlay();
    updatePreviewAudioVisibility();
    const settingsOverlay = $('topic-speak-settings-overlay');
    if (settingsOverlay) {
      settingsOverlay.classList.remove('visible');
      settingsOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  $('topic-speak-start-btn')?.addEventListener('click', startRound);
  $('topic-speak-mic')?.addEventListener('click', toggleListening);
  $('topic-speak-reveal')?.addEventListener('click', revealAnswer);
  $('topic-speak-audio')?.addEventListener('click', () => {
    const word = currentWord();
    if (word) playPronunciation(word, $('topic-speak-audio'));
  });
  $('topic-speak-play-again')?.addEventListener('click', playAgain);
  $('topic-speak-back-topic')?.addEventListener('click', backToTopic);
  $('back-from-topic-speak')?.addEventListener('click', () => {
    if (typeof window.goBack === 'function') window.goBack();
  });

  $('topic-speak-preview-audio')?.addEventListener('click', () => {
    const word = currentWord();
    if (word && state.showPreAnswerAudio && !state.currentWordResolved) {
      playPronunciation(word, $('topic-speak-preview-audio'));
    }
  });

  $('topic-speak-settings-btn')?.addEventListener('click', openSettings);
  $('topic-speak-settings-close')?.addEventListener('click', closeSettings);
  $('topic-speak-settings-overlay')?.addEventListener('click', (event) => {
    if (event.target === $('topic-speak-settings-overlay')) closeSettings();
  });
  $('topic-speak-preaudio-toggle')?.addEventListener('change', (event) => {
    state.showPreAnswerAudio = Boolean(event.target.checked);
    saveSettings();
    updatePreviewAudioVisibility();
  });
  $('topic-speak-voice-volume')?.addEventListener('input', (event) => {
    setVoiceVolume(event.target.value);
  });
  $('topic-speak-sfx-volume')?.addEventListener('input', (event) => {
    setSfxVolume(event.target.value);
  });

  window.addEventListener('english-next-level-audio-volume-change', () => {
    loadVoiceVolume();
    loadSfxVolume();
    syncVoiceVolumeUI();
    syncSfxVolumeUI();
  });

  // Privacy/lifecycle guard. The SpeechRecognition permission UI itself can
  // temporarily blur the page, so blur is handled with a deferred check.
  // Hidden/pagehide/freeze events remain immediate and always stop recognition.
  function clearBlurLifecycleTimer() {
    if (state.blurLifecycleTimer) {
      window.clearTimeout(state.blurLifecycleTimer);
      state.blurLifecycleTimer = null;
    }
  }

  function scheduleBlurLifecycleCheck(delay = 350) {
    clearBlurLifecycleTimer();
    state.blurLifecycleTimer = window.setTimeout(() => {
      state.blurLifecycleTimer = null;

      if (document.visibilityState === 'hidden') {
        state.pageFocused = false;
        suspendMicrophoneForPageLifecycle();
        return;
      }

      if (typeof document.hasFocus === 'function' && document.hasFocus()) {
        state.pageFocused = true;
        return;
      }

      // While Chromium is still resolving the native microphone permission
      // prompt, recognition.start() is pending and the page may legitimately
      // have no focus. Wait for that browser-owned flow to finish instead of
      // aborting it and forcing another permission request.
      if (state.recognitionStarting && !state.listening) {
        scheduleBlurLifecycleCheck(350);
        return;
      }

      // Give focus a brief moment to return after onstart fires and the native
      // permission UI closes. A genuine desktop/app focus loss remains unfocused
      // and will be stopped on the next check.
      if (state.listening && state.recognitionStartedAt && Date.now() - state.recognitionStartedAt < 900) {
        scheduleBlurLifecycleCheck(350);
        return;
      }

      state.pageFocused = false;
      suspendMicrophoneForPageLifecycle();
    }, delay);
  }

  window.addEventListener('blur', () => {
    scheduleBlurLifecycleCheck();
  });

  window.addEventListener('focus', () => {
    clearBlurLifecycleTimer();
    state.pageFocused = true;
    resumeMicrophoneControlsAfterFocus();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clearBlurLifecycleTimer();
      state.pageFocused = false;
      suspendMicrophoneForPageLifecycle();
    } else {
      state.pageFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
      if (state.pageFocused) resumeMicrophoneControlsAfterFocus();
    }
  });

  window.addEventListener('pagehide', () => {
    clearBlurLifecycleTimer();
    state.pageFocused = false;
    suspendMicrophoneForPageLifecycle();
  });

  window.addEventListener('beforeunload', () => {
    clearBlurLifecycleTimer();
    state.pageFocused = false;
    suspendMicrophoneForPageLifecycle();
  });

  document.addEventListener('freeze', () => {
    clearBlurLifecycleTimer();
    state.pageFocused = false;
    suspendMicrophoneForPageLifecycle();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('topic-speak-settings-overlay')?.classList.contains('visible')) {
      closeSettings();
    }
  });

  loadSettings();
  syncSettingsUI();

  window.TopicSpeakGame = {
    prepare,
    playAgain,
    leaveGame,
    isVoiceRecognitionSupported: Boolean(SpeechRecognitionCtor)
  };
})();
