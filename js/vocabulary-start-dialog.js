(function (root, factory) {
  const api = factory(root);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.EnglishNextLevelVocabularyStartDialog = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, (root) => {
  function create({
    body,
    overlay,
    startButton,
    focusTrap = root.EnlKeyboardAccessibility,
    activeWindow = root,
    getBackFocusTarget = () => null,
    getIsOtherModalActive = () => false,
    scheduleFrame = (callback) => requestAnimationFrame(callback),
    onBack
  }) {
    let releaseFocusTrap = null;
    let popstateFocusHandler = null;

    function clearPopstateFocusHandler() {
      if (!popstateFocusHandler) return;
      activeWindow.removeEventListener?.('popstate', popstateFocusHandler);
      popstateFocusHandler = null;
    }

    function restoreBackFocus() {
      const target = getBackFocusTarget();
      if (!target || target.isConnected === false) return false;
      if (typeof target.getClientRects === 'function' && target.getClientRects().length === 0) return false;

      target.focus?.({ preventScroll: true });
      return true;
    }

    function handleBackFocus() {
      clearPopstateFocusHandler();
      restoreBackFocus();
    }

    function returnToWordsMenu() {
      hide();
      if (typeof onBack !== 'function') {
        clearPopstateFocusHandler();
        return;
      }

      const expectsPopState = onBack() === true;
      if (!expectsPopState && popstateFocusHandler) handleBackFocus();
    }

    function show() {
      if (!overlay) return false;

      clearPopstateFocusHandler();
      releaseFocusTrap?.();
      releaseFocusTrap = null;

      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      body?.classList.add('vocab-modal-open');

      const dialog = overlay.querySelector?.('[role="dialog"]');
      if (dialog && typeof focusTrap?.trapDialogFocus === 'function') {
        releaseFocusTrap = focusTrap.trapDialogFocus(dialog, {
          initialFocus: startButton,
          onEscape: returnToWordsMenu
        }) || null;
      }
      if (!releaseFocusTrap) scheduleFrame(() => startButton?.focus?.({ preventScroll: true }));

      if (typeof activeWindow.addEventListener === 'function') {
        popstateFocusHandler = handleBackFocus;
        activeWindow.addEventListener('popstate', popstateFocusHandler);
      }
      return true;
    }

    function hide({ preserveReturnFocus = true } = {}) {
      if (!overlay) return false;

      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      releaseFocusTrap?.();
      releaseFocusTrap = null;
      if (!getIsOtherModalActive()) body?.classList.remove('vocab-modal-open');
      if (!preserveReturnFocus) clearPopstateFocusHandler();
      return true;
    }

    return Object.freeze({ show, hide });
  }

  return Object.freeze({ create });
});
