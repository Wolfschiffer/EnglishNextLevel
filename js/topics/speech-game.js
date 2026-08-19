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
    voiceVolume: 100
  };

  function $(id) {
    return document.getElementById(id);
  }


  const SETTINGS_STORAGE_KEY = 'englishNextLevel.topicSpeak.showPreAnswerAudio';
  const VOICE_VOLUME_STORAGE_KEY = 'englishNextLevel.voiceVolume';

  function clampVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 100;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function loadVoiceVolume() {
    try {
      const saved = window.sessionStorage.getItem(VOICE_VOLUME_STORAGE_KEY);
      state.voiceVolume = saved === null ? 100 : clampVolume(saved);
    } catch (error) {
      state.voiceVolume = 100;
    }
  }

  function saveVoiceVolume() {
    try {
      window.sessionStorage.setItem(VOICE_VOLUME_STORAGE_KEY, String(state.voiceVolume));
    } catch (error) {
      // Keeps the current value in memory when storage is unavailable.
    }
  }

  function getVoiceVolume() {
    try {
      const saved = window.sessionStorage.getItem(VOICE_VOLUME_STORAGE_KEY);
      if (saved !== null) state.voiceVolume = clampVolume(saved);
    } catch (error) {
      // Uses the in-memory value.
    }
    return state.voiceVolume;
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
  }

  function saveSettings() {
    try {
      window.sessionStorage.setItem(SETTINGS_STORAGE_KEY, state.showPreAnswerAudio ? 'true' : 'false');
    } catch (error) {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }

  function syncVoiceVolumeUI() {
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

  function setVoiceVolume(value) {
    state.voiceVolume = clampVolume(value);
    saveVoiceVolume();
    stopSpeech();
    syncVoiceVolumeUI();
  }

  function syncSettingsUI() {
    const toggle = $('topic-speak-preaudio-toggle');
    if (toggle) toggle.checked = state.showPreAnswerAudio;
    syncVoiceVolumeUI();
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
    stopRecognition();
    stopSpeech();
    const overlay = $('topic-speak-settings-overlay');
    if (!overlay) return;
    loadVoiceVolume();
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

    return source
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

    button.classList.toggle('is-listening', state.listening);
    button.setAttribute('aria-pressed', state.listening ? 'true' : 'false');
    label.textContent = state.listening ? 'LISTENING…' : 'SPEAK';
  }

  function stopRecognition() {
    if (state.recognition && state.listening) {
      try {
        state.recognition.abort();
      } catch (error) {
        console.warn('TOPICS Speak: could not abort recognition.', error);
      }
    }
    setMicState(false);
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

  function playPronunciation(word, button) {
    if (!word || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      if (button) {
        button.disabled = true;
        button.title = 'Audio is not supported in this browser.';
      }
      return;
    }

    stopSpeech();

    const voiceVolume = getVoiceVolume();
    if (voiceVolume <= 0) return;

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
    };

    utterance.onend = cleanup;
    utterance.onerror = cleanup;
    window.speechSynthesis.speak(utterance);
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
      return;
    }

    unsupported.hidden = true;
    mic.hidden = false;
  }

  function renderCurrentWord() {
    stopRecognition();
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

    const next = $('topic-speak-next');
    if (next) next.hidden = true;

    const reveal = $('topic-speak-reveal');
    if (reveal) reveal.disabled = false;

    setRecognitionAvailability();
    if (SpeechRecognitionCtor) {
      setStatus('Tap the microphone and say the word in English.');
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
    updatePreviewAudioVisibility();
    showTranscript(transcript);
    setStatus('Correct!', 'correct');

    const result = $('topic-speak-result');
    const icon = $('topic-speak-result-icon');
    const title = $('topic-speak-result-title');
    const answer = $('topic-speak-answer');
    const next = $('topic-speak-next');

    if (result) result.hidden = false;
    if (icon) icon.textContent = '✓';
    if (title) title.textContent = 'Correct!';
    if (answer) answer.textContent = word.english;
    if (next) next.hidden = false;

    const mic = $('topic-speak-mic');
    if (mic) mic.disabled = true;

    const audio = $('topic-speak-audio');
    if (audio) {
      audio.disabled = false;
      audio.setAttribute('aria-label', `Listen to ${word.english} in American English`);
    }

    playPronunciation(word, audio);
  }

  function showWrongResult(transcript) {
    showTranscript(transcript);
    hideResult();
    setStatus('Not quite. Try again.', 'wrong');

    const mic = $('topic-speak-mic');
    if (mic) mic.disabled = false;
  }

  function revealAnswer() {
    const word = currentWord();
    if (!word) return;

    state.currentWordResolved = true;
    updatePreviewAudioVisibility();
    hideHeard();
    setStatus('Study the answer and listen to the pronunciation.');

    const result = $('topic-speak-result');
    const icon = $('topic-speak-result-icon');
    const title = $('topic-speak-result-title');
    const answer = $('topic-speak-answer');
    const next = $('topic-speak-next');

    if (result) result.hidden = false;
    if (icon) icon.textContent = '•';
    if (title) title.textContent = 'Answer';
    if (answer) answer.textContent = word.english;
    if (next) next.hidden = false;

    const audio = $('topic-speak-audio');
    if (audio) {
      audio.disabled = false;
      audio.setAttribute('aria-label', `Listen to ${word.english} in American English`);
    }

    const reveal = $('topic-speak-reveal');
    if (reveal) reveal.disabled = true;

    playPronunciation(word, audio);
  }

  function createRecognition() {
    if (!SpeechRecognitionCtor) return null;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = state.topic?.englishVariant || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      setMicState(true);
      setStatus('Listening… say the English word now.', 'listening');
      hideHeard();
    };

    recognition.onresult = (event) => {
      const word = currentWord();
      if (!word) return;

      const results = event.results?.[event.resultIndex || 0];
      if (!results) return;

      const alternatives = [];
      for (let i = 0; i < results.length; i += 1) {
        const transcript = String(results[i]?.transcript || '').trim();
        if (transcript) alternatives.push(transcript);
      }

      const bestTranscript = alternatives[0] || '';
      const correctTranscript = alternatives.find((candidate) => answerIsCorrect(candidate, word));

      if (correctTranscript) {
        showCorrectResult(word, bestTranscript || correctTranscript);
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
        'no-speech': 'I did not hear a word. Tap the microphone and try again.',
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
      setMicState(false);
      if (!state.currentWordResolved) {
        const mic = $('topic-speak-mic');
        if (mic) mic.disabled = false;
      }
    };

    return recognition;
  }

  function startListening() {
    if (!state.started || state.currentWordResolved || state.listening || !SpeechRecognitionCtor) return;

    stopSpeech();

    if (!state.recognition) {
      state.recognition = createRecognition();
    }
    if (!state.recognition) return;

    state.recognition.lang = state.topic?.englishVariant || 'en-US';

    const mic = $('topic-speak-mic');
    if (mic) mic.disabled = true;

    try {
      state.recognition.start();
    } catch (error) {
      // Some engines throw if start() is called again too quickly.
      if (mic) mic.disabled = false;
      setMicState(false);
      setStatus('Could not start the microphone yet. Tap Speak again.', 'error');
      console.warn('TOPICS Speak: recognition start failed.', error);
    }
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
    stopRecognition();
    stopSpeech();
    state.started = false;
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

    state.currentIndex += 1;
    if (state.currentIndex >= state.words.length) {
      showReview();
      return;
    }

    const mic = $('topic-speak-mic');
    if (mic) mic.disabled = false;
    renderCurrentWord();
  }

  function startRound() {
    state.started = true;
    hideStartOverlay();
    renderCurrentWord();
    updatePreviewAudioVisibility();

    const mic = $('topic-speak-mic');
    const reveal = $('topic-speak-reveal');
    if (SpeechRecognitionCtor) {
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

    state.topic = topic;
    state.level = level;
    state.words = shuffle(level.words);
    state.currentIndex = 0;
    state.started = false;
    state.currentWordResolved = false;
    state.recognitionBlocked = false;
    state.recognition = null;

    updateHeader();
    hideReview();
    renderCurrentWord();
    showStartOverlay();
  }

  function playAgain() {
    if (!state.topic || !state.level) return;
    prepare({ topic: state.topic, level: state.level });
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
    stopRecognition();
    stopSpeech();
    state.started = false;
    state.currentWordResolved = false;
    hideStartOverlay();
    updatePreviewAudioVisibility();
    const settingsOverlay = $('topic-speak-settings-overlay');
    if (settingsOverlay) {
      settingsOverlay.classList.remove('visible');
      settingsOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  $('topic-speak-start-btn')?.addEventListener('click', startRound);
  $('topic-speak-mic')?.addEventListener('click', startListening);
  $('topic-speak-next')?.addEventListener('click', nextWord);
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
