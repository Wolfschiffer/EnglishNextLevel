// TOPICS — SPEAK visual layer (Phase 5D)
// Intentionally isolated from speech-game.js so visual polish cannot alter
// SpeechRecognition permission/lifecycle behavior.
(function () {
  function $(id) { return document.getElementById(id); }

  function syncStatusVisual() {
    const status = $('topic-speak-status');
    const playArea = $('topic-speak-play-area');
    if (!status || !playArea) return;
    playArea.classList.remove('is-listening', 'is-correct', 'is-wrong', 'is-error');
    ['listening', 'correct', 'wrong', 'error'].forEach((type) => {
      if (status.classList.contains(`is-${type}`)) playArea.classList.add(`is-${type}`);
    });
  }

  function syncProgress() {
    const current = Number($('topic-speak-current')?.textContent || 0);
    const total = Number($('topic-speak-total')?.textContent || 0);
    const fill = $('topic-speak-progress-fill');
    if (!fill) return;
    const percent = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
    fill.style.width = `${percent}%`;
  }

  function decorateReviewAudio(root = document) {
    root.querySelectorAll?.('#topic-speak-review .topic-review-audio').forEach((button) => {
      if (button.dataset.phase5dIcon === 'true') return;
      button.dataset.phase5dIcon = 'true';
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a3.5 3.5 0 0 0-2-3.16v6.32a3.5 3.5 0 0 0 2-3.16zm0-7.1v2.06a6 6 0 0 1 0 10.08v2.06a8 8 0 0 0 0-14.2z"/></svg>';
    });
  }

  function observe() {
    const status = $('topic-speak-status');
    if (status) new MutationObserver(syncStatusVisual).observe(status, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });

    ['topic-speak-current', 'topic-speak-total'].forEach((id) => {
      const el = $(id);
      if (el) new MutationObserver(syncProgress).observe(el, { childList: true, characterData: true, subtree: true });
    });

    const reviewList = $('topic-speak-review-list');
    if (reviewList) new MutationObserver(() => decorateReviewAudio(reviewList)).observe(reviewList, { childList: true, subtree: true });

    syncStatusVisual();
    syncProgress();
    decorateReviewAudio();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
  else observe();
})();
