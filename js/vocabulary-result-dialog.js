(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.EnglishNextLevelVocabularyResultDialog = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, () => {
  function create({
    body,
    overlay,
    subtitle,
    matches,
    score,
    time,
    replayButton,
    backButton,
    getIsWordsGameScreen,
    getIsStartOverlayActive,
    getMatchesCount,
    getWordCount,
    getScore,
    getElapsedSeconds,
    getGameType,
    formatTime,
    scheduleFrame,
    setTimeoutFn,
    clearTimeoutFn,
    onReplay,
    onBack
  }) {
    let resultTimeout = null;

    function show() {
      if (!overlay || !getIsWordsGameScreen()) return false;

      if (matches) matches.textContent = `${getMatchesCount()}/${getWordCount()}`;
      if (score) score.textContent = Number(getScore() || 0).toLocaleString('en-US');
      if (time) time.textContent = formatTime(getElapsedSeconds());
      if (subtitle) {
        subtitle.textContent = getGameType() === 'past'
          ? 'You matched every present verb with its simple past form.'
          : 'You matched every English verb with its Portuguese meaning.';
      }

      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      body.classList.add('vocab-modal-open');
      scheduleFrame(() => replayButton?.focus());
      return true;
    }

    function hide() {
      if (!overlay) return false;
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      if (!getIsStartOverlayActive()) body.classList.remove('vocab-modal-open');
      return true;
    }

    function cancel() {
      if (resultTimeout === null) return false;
      clearTimeoutFn(resultTimeout);
      resultTimeout = null;
      return true;
    }

    function queue() {
      cancel();
      resultTimeout = setTimeoutFn(() => {
        resultTimeout = null;
        show();
      }, 650);
    }

    replayButton?.addEventListener('click', () => {
      hide();
      onReplay();
    });

    backButton?.addEventListener('click', () => {
      hide();
      onBack();
    });

    return Object.freeze({ show, hide, queue, cancel });
  }

  return Object.freeze({ create });
});
