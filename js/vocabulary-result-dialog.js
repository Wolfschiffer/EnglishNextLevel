(function (root, factory) {
  const api = factory(root);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.EnglishNextLevelVocabularyResultDialog = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, (root) => {
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
    focusTrap = root.EnlKeyboardAccessibility,
    activeWindow = root,
    getBackFocusTarget = () => null,
    scheduleFrame,
    setTimeoutFn,
    clearTimeoutFn,
    onReplay,
    onBack
  }) {
    let resultTimeout = null;
    let releaseFocusTrap = null;

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
      releaseFocusTrap?.();
      releaseFocusTrap = null;

      const dialog = overlay.querySelector?.('[role="dialog"]');
      if (dialog && typeof focusTrap?.trapDialogFocus === 'function') {
        releaseFocusTrap = focusTrap.trapDialogFocus(dialog, {
          initialFocus: replayButton,
          onEscape: returnToWordsMenu
        }) || null;
      }

      if (!releaseFocusTrap) scheduleFrame(() => replayButton?.focus());
      return true;
    }

    function hide() {
      if (!overlay) return false;
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      releaseFocusTrap?.();
      releaseFocusTrap = null;
      if (!getIsStartOverlayActive()) body.classList.remove('vocab-modal-open');
      return true;
    }

    function returnToWordsMenu() {
      const returnFocusTarget = getBackFocusTarget();
      let focusRestored = false;
      const restoreFocus = () => {
        if (focusRestored || !returnFocusTarget || returnFocusTarget.isConnected === false) return;
        if (typeof returnFocusTarget.getClientRects === 'function' && returnFocusTarget.getClientRects().length === 0) return;

        focusRestored = true;
        activeWindow.removeEventListener?.('popstate', handlePopState);
        returnFocusTarget.focus?.({ preventScroll: true });
      };
      const handlePopState = () => {
        activeWindow.removeEventListener?.('popstate', handlePopState);
        restoreFocus();
      };

      if (returnFocusTarget && typeof activeWindow.addEventListener === 'function') {
        activeWindow.addEventListener('popstate', handlePopState);
      }

      hide();
      const expectsPopState = onBack() === true;
      if (!expectsPopState) activeWindow.removeEventListener?.('popstate', handlePopState);
      restoreFocus();
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
      returnToWordsMenu();
    });

    return Object.freeze({ show, hide, queue, cancel });
  }

  return Object.freeze({ create });
});
