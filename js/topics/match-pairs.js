// ============================================
// TOPICS — MATCH PAIRS
// Phase 3: fixed-slot grid + end-of-round review
// ============================================

(function () {
  const state = {
    topic: null,
    level: null,
    cards: [],
    firstCard: null,
    secondCard: null,
    inputLocked: true,
    started: false,
    matchedPairs: 0,
    pendingTimeouts: [],
    activeUtterance: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function clearPendingTimeouts() {
    state.pendingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    state.pendingTimeouts = [];
  }

  function schedule(callback, delay) {
    const timeoutId = setTimeout(() => {
      state.pendingTimeouts = state.pendingTimeouts.filter((id) => id !== timeoutId);
      callback();
    }, delay);
    state.pendingTimeouts.push(timeoutId);
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function createDeck(words) {
    const deck = [];

    words.forEach((word) => {
      deck.push({
        cardId: `${word.id}-en`,
        pairId: word.id,
        language: 'en',
        text: word.english
      });

      deck.push({
        cardId: `${word.id}-pt`,
        pairId: word.id,
        language: 'pt',
        text: word.portuguese
      });
    });

    return shuffle(deck);
  }

  function updateHeader() {
    const topicTitle = $('topic-match-title');
    const levelLabel = $('topic-match-level');
    const total = $('topic-match-total');
    const matched = $('topic-match-count');

    if (topicTitle) topicTitle.textContent = state.topic?.title || 'Match Pairs';
    if (levelLabel) {
      const label = state.level?.label || '';
      const count = state.level?.words?.length || 0;
      levelLabel.textContent = `${label.toUpperCase()} · ${count} ${count === 1 ? 'WORD' : 'WORDS'}`;
    }
    if (total) total.textContent = String(state.level?.words?.length || 0);
    if (matched) matched.textContent = String(state.matchedPairs);
  }

  function resetSelection() {
    state.firstCard = null;
    state.secondCard = null;
  }

  function renderGrid() {
    const grid = $('topic-match-grid');
    if (!grid) return;

    grid.innerHTML = '';
    grid.dataset.cardCount = String(state.cards.length);
    grid.classList.remove('is-reviewing');
    grid.removeAttribute('aria-hidden');

    state.cards.forEach((card) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'topic-match-card';
      button.dataset.cardId = card.cardId;
      button.dataset.pairId = card.pairId;
      button.dataset.language = card.language;
      button.textContent = card.text;
      button.setAttribute('aria-label', card.text);
      button.addEventListener('click', () => handleCardClick(button));
      grid.appendChild(button);
    });
  }

  function showStartOverlay() {
    const overlay = $('topic-match-start-overlay');
    if (!overlay) return;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function hideStartOverlay() {
    const overlay = $('topic-match-start-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function stopSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    state.activeUtterance = null;
    document.querySelectorAll('.topic-review-audio.is-playing').forEach((button) => {
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

    const locale = state.topic?.englishVariant || 'en-US';
    const utterance = new SpeechSynthesisUtterance(word.english);
    const voice = getAmericanVoice(locale);

    utterance.lang = locale;
    utterance.rate = 0.9;
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

  function renderReview() {
    const list = $('topic-review-list');
    if (!list) return;

    list.innerHTML = '';

    (state.level?.words || []).forEach((word) => {
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
      audioButton.title = `Listen to ${word.english}`;
      audioButton.addEventListener('click', () => playPronunciation(word, audioButton));

      english.append(englishText, audioButton);

      const portuguese = document.createElement('div');
      portuguese.className = 'topic-review-portuguese';
      portuguese.textContent = word.portuguese;

      row.append(english, portuguese);
      list.appendChild(row);
    });
  }

  function hideReview() {
    stopSpeech();

    const review = $('topic-match-review');
    if (review) {
      review.classList.remove('visible');
      review.setAttribute('aria-hidden', 'true');
    }

    const grid = $('topic-match-grid');
    if (grid) {
      grid.classList.remove('is-reviewing');
      grid.removeAttribute('aria-hidden');
    }
  }

  function showReview() {
    renderReview();

    const grid = $('topic-match-grid');
    if (grid) {
      grid.classList.add('is-reviewing');
      grid.setAttribute('aria-hidden', 'true');
    }

    const review = $('topic-match-review');
    if (review) {
      review.classList.add('visible');
      review.setAttribute('aria-hidden', 'false');

      schedule(() => {
        review.scrollIntoView({
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
        review.querySelector('.topic-review-audio')?.focus({ preventScroll: true });
      }, 60);
    }
  }

  function startRound() {
    state.started = true;
    state.inputLocked = false;
    hideStartOverlay();

    const grid = $('topic-match-grid');
    if (grid) {
      const firstVisibleCard = grid.querySelector('.topic-match-card:not(.is-matched)');
      firstVisibleCard?.focus({ preventScroll: true });
    }
  }

  function cardIsUnavailable(cardElement) {
    return !cardElement ||
      cardElement.disabled ||
      cardElement.classList.contains('is-matched');
  }

  function handleCardClick(cardElement) {
    if (!state.started || state.inputLocked || cardIsUnavailable(cardElement)) return;

    if (state.firstCard === cardElement) {
      cardElement.classList.remove('is-selected');
      resetSelection();
      return;
    }

    if (!state.firstCard) {
      state.firstCard = cardElement;
      cardElement.classList.add('is-selected');
      return;
    }

    state.secondCard = cardElement;
    cardElement.classList.add('is-selected');
    state.inputLocked = true;

    const isMatch =
      state.firstCard.dataset.pairId === state.secondCard.dataset.pairId &&
      state.firstCard.dataset.language !== state.secondCard.dataset.language;

    if (isMatch) {
      resolveCorrectPair();
    } else {
      resolveWrongPair();
    }
  }

  function resolveWrongPair() {
    const first = state.firstCard;
    const second = state.secondCard;

    first?.classList.add('is-wrong');
    second?.classList.add('is-wrong');

    schedule(() => {
      [first, second].forEach((card) => {
        card?.classList.remove('is-selected', 'is-wrong');
      });
      resetSelection();
      state.inputLocked = false;
    }, 520);
  }

  function resolveCorrectPair() {
    const first = state.firstCard;
    const second = state.secondCard;

    first?.classList.add('is-correct');
    second?.classList.add('is-correct');

    schedule(() => {
      [first, second].forEach((card) => {
        if (!card) return;
        card.classList.remove('is-selected', 'is-correct');
        card.classList.add('is-matched');
        card.disabled = true;
        card.setAttribute('aria-hidden', 'true');
        card.tabIndex = -1;
      });

      state.matchedPairs += 1;
      const matched = $('topic-match-count');
      if (matched) matched.textContent = String(state.matchedPairs);

      resetSelection();

      const totalPairs = state.level?.words?.length || 0;
      if (state.matchedPairs >= totalPairs) {
        state.inputLocked = true;
        state.started = false;
        schedule(showReview, 220);
      } else {
        state.inputLocked = false;
      }
    }, 360);
  }

  function prepare({ topic, level }) {
    if (!topic || !level || !Array.isArray(level.words)) {
      console.error('TOPICS Match Pairs: invalid topic or level data.');
      return;
    }

    clearPendingTimeouts();
    stopSpeech();
    state.topic = topic;
    state.level = level;
    state.cards = createDeck(level.words);
    state.firstCard = null;
    state.secondCard = null;
    state.inputLocked = true;
    state.started = false;
    state.matchedPairs = 0;

    updateHeader();
    hideReview();
    renderGrid();
    showStartOverlay();
  }

  function playAgain() {
    if (!state.topic || !state.level) return;
    prepare({ topic: state.topic, level: state.level });
  }

  function backToTopic() {
    stopSpeech();
    clearPendingTimeouts();

    // Current flow is Topic -> Level -> Game -> Match.
    // Two back operations return to the selected topic's Common/Advanced screen.
    if (typeof window.goBack === 'function') {
      window.goBack(2);
    }
  }

  function leaveGame() {
    clearPendingTimeouts();
    stopSpeech();
    state.inputLocked = true;
    state.started = false;
    hideStartOverlay();
    hideReview();
    resetSelection();
  }

  $('topic-match-start-btn')?.addEventListener('click', startRound);
  $('topic-match-play-again')?.addEventListener('click', playAgain);
  $('topic-match-back-topic')?.addEventListener('click', backToTopic);
  $('back-from-topic-match')?.addEventListener('click', () => {
    if (typeof window.goBack === 'function') window.goBack();
  });

  window.TopicMatchPairs = {
    prepare,
    playAgain,
    leaveGame
  };
})();
