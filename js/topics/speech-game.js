// ============================================
// TOPICS — SPEAK
// Phase 4: Portuguese prompt -> spoken English answer
// American English (en-US) is the primary target.
// ============================================

(function () {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const speechAnswer = window.TopicSpeakAnswer;

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
  let pageLifecycle = null;
  let speechAudio = null;
  let recognitionController = null;
  let pendingPronunciationTimer = null;
  let releaseStartFocusTrap = () => {};
  let releaseSettingsFocusTrap = () => {};
  let returnFocusPopstateHandler = null;
  const speechSettings = window.TopicSpeakSettings.create({
    state,
    window,
    document,
    stopSpeech,
    updatePreviewAudioVisibility
  });

  function $(id) {
    return document.getElementById(id);
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
    recognitionController.clearAcceptRecognitionTimer();
    stopSpeech();
    const overlay = $('topic-speak-settings-overlay');
    if (!overlay || overlay.classList.contains('visible')) return;
    speechSettings.loadAudioVolumes();
    speechSettings.syncSettingsUI();
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');

    const dialog = overlay.querySelector?.('[role="dialog"]');
    const initialFocus = $('topic-speak-settings-close');
    releaseSettingsFocusTrap = dialog
      ? window.EnlKeyboardAccessibility?.trapDialogFocus?.(dialog, {
          initialFocus,
          onEscape: closeSettings
        }) || null
      : null;

    if (!releaseSettingsFocusTrap) initialFocus?.focus({ preventScroll: true });
  }

  function closeSettings({ restoreFocus = true } = {}) {
    const overlay = $('topic-speak-settings-overlay');
    if (!overlay) return;
    const wasVisible = overlay.classList.contains('visible');
    const dialog = overlay.querySelector?.('[role="dialog"]');
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    releaseSettingsFocusTrap?.();
    releaseSettingsFocusTrap = () => {};

    const returnFocus = $('topic-speak-settings-btn');
    const canRestoreFocus = restoreFocus && wasVisible && returnFocus &&
      returnFocus.isConnected !== false && !returnFocus.disabled &&
      !(typeof returnFocus.getClientRects === 'function' && returnFocus.getClientRects().length === 0);

    if (canRestoreFocus) {
      returnFocus.focus?.({ preventScroll: true });
    } else if (dialog?.contains?.(document.activeElement)) {
      document.activeElement.blur?.();
    }

    if (state.started && !state.currentWordResolved && state.listening && !state.recognitionPaused && recognitionController.pageCanUseMicrophone()) {
      recognitionController.armRecognitionForCurrentWord(250);
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

  function currentWord() {
    return state.words[state.currentIndex] || null;
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

  function stopSpeech() {
    clearPendingPronunciation();
    speechAudio?.stop();
  }

  function primeSpeechOutput() {
    speechAudio?.prime();
  }

  function clearAutoAdvance() {
    if (state.autoAdvanceTimer) {
      window.clearTimeout(state.autoAdvanceTimer);
      state.autoAdvanceTimer = null;
    }
  }

  function clearPendingPronunciation() {
    if (pendingPronunciationTimer !== null) {
      window.clearTimeout(pendingPronunciationTimer);
      pendingPronunciationTimer = null;
    }
  }

  function schedulePronunciation(word, button, onDone) {
    clearPendingPronunciation();
    pendingPronunciationTimer = window.setTimeout(() => {
      pendingPronunciationTimer = null;
      if (!state.inSpeakScreen || !state.started || !state.currentWordResolved || currentWord() !== word) return;
      playPronunciation(word, button, onDone);
    }, 180);
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
    clearPendingPronunciation();
    speechAudio?.play(word, button, onDone);
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

  function closeTypedAnswer({ clear = true } = {}) {
    const form = $('topic-speak-type-form');
    const toggle = $('topic-speak-type-toggle');
    const input = $('topic-speak-type-input');
    if (form) form.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (clear && input) input.value = '';
  }

  function syncTypedAnswerAvailability() {
    const toggle = $('topic-speak-type-toggle');
    if (!toggle) return;
    const available = Boolean(state.started && !state.currentWordResolved && currentWord());
    toggle.hidden = !available;
    toggle.disabled = !available;
    if (!available) closeTypedAnswer();
  }

  function toggleTypedAnswer() {
    const form = $('topic-speak-type-form');
    const toggle = $('topic-speak-type-toggle');
    const input = $('topic-speak-type-input');
    if (!form || !toggle || toggle.disabled) return;

    if (!form.hidden) {
      closeTypedAnswer();
      return;
    }

    if (state.recognitionSessionWanted || state.listening || state.recognitionStarting) {
      recognitionController.stopRecognition({ disableMic: false, endSession: true });
      state.recognitionPaused = true;
    }

    form.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    setStatus('Type the English word below.');
    input?.focus({ preventScroll: true });
  }

  function submitTypedAnswer(event) {
    event.preventDefault();
    const word = currentWord();
    const input = $('topic-speak-type-input');
    const answer = String(input?.value || '').trim();
    if (!word || !answer || state.currentWordResolved) {
      if (!answer) setStatus('Type the English word first.', 'error');
      input?.focus({ preventScroll: true });
      return;
    }

    const match = speechAnswer.match(answer, word);
    if (match.correct) {
      closeTypedAnswer();
      syncTypedAnswerAvailability();
      showCorrectResult(word, match.answer, match.corrected);
    } else {
      showWrongResult(answer);
      input?.focus({ preventScroll: true });
    }
  }

  function renderCurrentWord({ resumeListeningDelay = 0 } = {}) {
    clearAutoAdvance();
    clearPendingPronunciation();
    recognitionController.clearAcceptRecognitionTimer();
    state.acceptingRecognition = false;
    state.currentWordResolved = false;
    closeTypedAnswer();
    syncTypedAnswerAvailability();
    stopSpeech();

    const word = currentWord();
    if (!word) {
      showReview();
      return;
    }

    updateHeader();
    updatePreviewAudioVisibility();

    const portuguese = $('topic-speak-portuguese');
    if (portuguese) portuguese.textContent = word.portuguese;

    hideHeard();
    hideResult();


    const reveal = $('topic-speak-reveal');
    if (reveal) reveal.disabled = false;

    recognitionController.setRecognitionAvailability();
    if (SpeechRecognitionCtor) {
      if (state.started && state.recognitionSessionWanted) {
        if (state.recognitionPaused) {
          setStatus('Microphone paused. Tap Speak to continue.');
        } else if (state.listening) {
          recognitionController.armRecognitionForCurrentWord(resumeListeningDelay);
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

  function showTranscript(transcript, corrected = false) {
    const heard = $('topic-speak-heard');
    const transcriptEl = $('topic-speak-transcript');
    const label = $('topic-speak-heard-label');
    if (transcriptEl) transcriptEl.textContent = transcript || '—';
    if (label) label.textContent = corrected ? 'Correct word' : 'I heard';
    if (heard) heard.hidden = false;
  }

  function showCorrectResult(word, transcript, corrected = false) {
    state.currentWordResolved = true;
    closeTypedAnswer();
    syncTypedAnswerAvailability();
    speechSettings.playSfx('correct');
    updatePreviewAudioVisibility();
    showTranscript(transcript || word.english, corrected);
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
    schedulePronunciation(word, audio, afterPronunciation);
  }

  function showWrongResult(transcript) {
    speechSettings.playSfx('wrong');
    showTranscript(transcript);
    hideResult();

    // A wrong answer pauses the GAME listener by default. Keep the underlying
    // continuous browser session alive so retrying does not create a new
    // permission request. No recognition result is accepted until SPEAK is
    // pressed again.
    state.recognitionPaused = true;
    state.acceptingRecognition = false;
    recognitionController.clearAcceptRecognitionTimer();
    setMicState(state.listening);
    setStatus('Not quite. Tap Speak to try again.', 'wrong');

    const mic = $('topic-speak-mic');
    if (mic) mic.disabled = false;
  }

  function revealAnswer() {
    const word = currentWord();
    if (!word) return;

    state.acceptingRecognition = false;
    recognitionController.clearAcceptRecognitionTimer();
    state.currentWordResolved = true;
    closeTypedAnswer();
    syncTypedAnswerAvailability();
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
    schedulePronunciation(word, audio, () => scheduleAutoAdvance(700));
  }

  function showStartOverlay() {
    const overlay = $('topic-speak-start-overlay');
    if (!overlay) return;
    releaseStartFocusTrap();
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');

    const dialog = overlay.querySelector('[role="dialog"]');
    releaseStartFocusTrap = window.EnlKeyboardAccessibility?.trapDialogFocus?.(dialog, {
      initialFocus: $('topic-speak-start-btn'),
      onEscape: returnToPreviousMenu
    }) || (() => {});
  }

  function hideStartOverlay() {
    releaseStartFocusTrap();
    releaseStartFocusTrap = () => {};

    const overlay = $('topic-speak-start-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function clearReturnFocusPopstateHandler() {
    if (!returnFocusPopstateHandler) return;
    window.removeEventListener?.('popstate', returnFocusPopstateHandler);
    returnFocusPopstateHandler = null;
  }

  function restoreTopicSpeakMenuFocus() {
    const target = $('topic-speak-btn');
    if (!target || target.isConnected === false) return false;
    if (typeof target.getClientRects === 'function' && target.getClientRects().length === 0) return false;

    target.focus?.({ preventScroll: true });
    return true;
  }

  function armReturnFocusOnPopstate() {
    clearReturnFocusPopstateHandler();
    if (typeof window.addEventListener !== 'function') return;

    returnFocusPopstateHandler = () => {
      // A hidden destination should not leave a stale listener for a later navigation.
      clearReturnFocusPopstateHandler();
      restoreTopicSpeakMenuFocus();
    };
    window.addEventListener('popstate', returnFocusPopstateHandler);
  }

  function returnToPreviousMenu() {
    hideStartOverlay();
    if (typeof window.goBack !== 'function') {
      clearReturnFocusPopstateHandler();
      return;
    }

    const usedAsyncNavigation = window.goBack() === true;
    // The legacy fallback changes screens synchronously without a popstate event.
    if (!usedAsyncNavigation && returnFocusPopstateHandler) returnFocusPopstateHandler();
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
    clearPendingPronunciation();
    state.recognitionPaused = true;
    state.acceptingRecognition = false;
    recognitionController.clearAcceptRecognitionTimer();
    setMicState(state.listening);
    stopSpeech();
    state.started = false;
    closeTypedAnswer();
    syncTypedAnswerAvailability();
    speechSettings.playSfx('win');
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
      review.querySelector('.topic-review-audio')?.focus({ preventScroll: true });
    }

    window.EnglishNextLevelTopicStats?.finalizeRound('speak');
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
    speechSettings.unlockSfx();
    primeSpeechOutput();

    state.started = true;
    syncTypedAnswerAvailability();
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
        recognitionController.armRecognitionForCurrentWord(180);
      } else {
        recognitionController.startRecognitionSession();
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
    state.suspendedByPageLifecycle = false;
    state.recognitionSessionWanted = false;
    state.recognitionPaused = false;
    state.acceptingRecognition = false;
    state.ignoreRecognitionUntil = 0;
    recognitionController.clearRecognitionRestartTimer();
    recognitionController.clearAcceptRecognitionTimer();
    pageLifecycle?.clearBlurLifecycleTimer();
    clearAutoAdvance();
    armReturnFocusOnPopstate();

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
    clearPendingPronunciation();
    recognitionController.clearAcceptRecognitionTimer();
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
    clearPendingPronunciation();
    recognitionController.clearAcceptRecognitionTimer();
    state.inSpeakScreen = false;
    state.recognitionSessionWanted = false;
    recognitionController.stopRecognition({ endSession: true });
    state.recognitionPaused = false;
    stopSpeech();
    state.started = false;
    state.currentWordResolved = false;
    closeTypedAnswer();
    syncTypedAnswerAvailability();
    pageLifecycle?.clearBlurLifecycleTimer();
    hideStartOverlay();
    closeSettings({ restoreFocus: false });
    updatePreviewAudioVisibility();
  }

  $('topic-speak-start-btn')?.addEventListener('click', startRound);
  $('topic-speak-mic')?.addEventListener('click', () => {
    closeTypedAnswer();
    recognitionController.toggleListening();
  });
  $('topic-speak-type-toggle')?.addEventListener('click', toggleTypedAnswer);
  $('topic-speak-type-form')?.addEventListener('submit', submitTypedAnswer);
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
  speechSettings.bindControls();

  // Permission prompts can blur the page; hidden and unloading pages suspend immediately.
  speechAudio = window.TopicSpeakAudio.create({
    state,
    window,
    document,
    getVoiceVolume: speechSettings.getVoiceVolume,
    getVoiceRate: () => window.EnglishNextLevelAudio?.getVoiceRate?.() ?? 0.9
  });
  recognitionController = window.TopicSpeakRecognition.create({
    state,
    window,
    document,
    SpeechRecognitionCtor,
    getElement: $,
    currentWord,
    matchAnswer: (transcript, word) => speechAnswer.match(transcript, word),
    setStatus,
    setMicState,
    stopSpeech,
    hideHeard,
    showFallback,
    showCorrectResult,
    showWrongResult
  });
  pageLifecycle = window.TopicSpeakPageLifecycle.create({
    state,
    window,
    document,
    suspendMicrophoneForPageLifecycle: recognitionController.suspendMicrophoneForPageLifecycle,
    resumeMicrophoneControlsAfterFocus: recognitionController.resumeMicrophoneControlsAfterFocus
  });
  pageLifecycle.attach();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('topic-speak-settings-overlay')?.classList.contains('visible')) {
      closeSettings();
    }
  });

  speechSettings.loadSettings();
  speechSettings.syncSettingsUI();

  window.TopicSpeakGame = {
    prepare,
    playAgain,
    leaveGame,
    isVoiceRecognitionSupported: recognitionController.isSupported
  };
})();
