// ============================================
// TOPICS — ROUND STATS (MATCH + SPEAK)
// Timer + 0–1000 points system shared by both Topic games.
// Scoring: up to 700 progress points + up to 300 speed bonus.
// ============================================

(function () {
  const MAX_PROGRESS_POINTS = 700;
  const MAX_SPEED_BONUS = 300;
  const SPEED_BONUS_LOSS_PER_SECOND = 2;

  const rounds = {
    match: createRoundState('match'),
    speak: createRoundState('speak')
  };

  function createRoundState(type) {
    return {
      type,
      started: false,
      completed: false,
      startedAt: 0,
      elapsedMs: 0,
      total: 0,
      completedItems: 0,
      score: 0,
      timerId: null,
      speakCorrectLatched: false
    };
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function numberFrom(id, fallback = 0) {
    const value = Number.parseInt(byId(id)?.textContent || '', 10);
    return Number.isFinite(value) ? value : fallback;
  }

  function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function elapsedSeconds(round) {
    const liveMs = round.started && !round.completed
      ? Math.max(0, performance.now() - round.startedAt)
      : round.elapsedMs;
    return Math.max(0, Math.floor(liveMs / 1000));
  }

  function progressScore(round) {
    if (!round.total) return 0;
    const ratio = Math.min(1, Math.max(0, round.completedItems / round.total));
    return Math.round(ratio * MAX_PROGRESS_POINTS);
  }

  function finalScore(round) {
    const seconds = elapsedSeconds(round);
    const speedBonus = Math.max(
      0,
      MAX_SPEED_BONUS - (seconds * SPEED_BONUS_LOSS_PER_SECOND)
    );
    return Math.min(1000, progressScore(round) + speedBonus);
  }

  function elementsFor(type) {
    return {
      score: byId(`topic-${type}-score`),
      time: byId(`topic-${type}-time`),
      finalScore: byId(`topic-${type}-final-score`),
      finalTime: byId(`topic-${type}-final-time`)
    };
  }

  function render(round, isFinal = false) {
    const els = elementsFor(round.type);
    const seconds = elapsedSeconds(round);
    const score = isFinal ? finalScore(round) : progressScore(round);

    round.score = score;
    if (els.score) els.score.textContent = String(score);
    if (els.time) els.time.textContent = formatTime(seconds);

    if (isFinal) {
      if (els.finalScore) els.finalScore.textContent = String(score);
      if (els.finalTime) els.finalTime.textContent = formatTime(seconds);
    } else {
      if (els.finalScore) els.finalScore.textContent = '0';
      if (els.finalTime) els.finalTime.textContent = '00:00';
    }
  }

  function stopTicker(round) {
    if (round.timerId) {
      window.clearInterval(round.timerId);
      round.timerId = null;
    }
  }

  function resetRound(type) {
    const round = rounds[type];
    stopTicker(round);
    round.started = false;
    round.completed = false;
    round.startedAt = 0;
    round.elapsedMs = 0;
    round.completedItems = 0;
    round.score = 0;
    round.speakCorrectLatched = false;
    round.total = type === 'match'
      ? numberFrom('topic-match-total', 0)
      : numberFrom('topic-speak-total', 0);
    render(round, false);
  }

  function beginRound(type) {
    const round = rounds[type];
    resetRound(type);
    round.total = type === 'match'
      ? numberFrom('topic-match-total', round.total)
      : numberFrom('topic-speak-total', round.total);
    round.started = true;
    round.startedAt = performance.now();

    // Match may already expose 0; Speak begins on word 1 but has completed 0.
    if (type === 'match') {
      round.completedItems = Math.min(round.total, numberFrom('topic-match-count', 0));
    }

    render(round, false);
    round.timerId = window.setInterval(() => render(round, false), 250);
  }

  function abortRound(type) {
    const round = rounds[type];
    if (round.started && !round.completed) {
      round.elapsedMs = Math.max(0, performance.now() - round.startedAt);
    }
    round.started = false;
    stopTicker(round);
  }

  function getSelectionIds() {
    const selection = window.TopicApp?.getSelection?.();
    const topic = selection?.topic;
    const level = selection?.level;
    const volume = selection?.volume;

    if (!topic || !level || !volume) return null;
    return {
      topicId: topic.id,
      levelId: level.levelId || level.id,
      volumeId: volume.id || level.volumeId || 'volume-1'
    };
  }

  function saveResult(round) {
    const selection = getSelectionIds();
    if (!selection) return;

    const api = window.EnglishNextLevelProgress;
    if (!api?.recordTopicResult) return;

    api.recordTopicResult({
      ...selection,
      gameType: round.type,
      score: round.score,
      timeSeconds: elapsedSeconds(round)
    });
  }

  function finalizeRound(type) {
    const round = rounds[type];
    if (round.completed) return;

    if (!round.started) {
      // Defensive fallback if another game script opens Review immediately.
      round.started = true;
      round.startedAt = performance.now();
    }

    round.elapsedMs = Math.max(0, performance.now() - round.startedAt);
    round.started = false;
    round.completed = true;
    stopTicker(round);

    round.total = type === 'match'
      ? numberFrom('topic-match-total', round.total)
      : numberFrom('topic-speak-total', round.total);
    round.completedItems = round.total;
    render(round, true);
    saveResult(round);
  }

  function isReviewVisible(id) {
    const review = byId(id);
    if (!review) return false;
    return review.classList.contains('visible') && review.getAttribute('aria-hidden') !== 'true';
  }

  function observeReview(type, id) {
    const review = byId(id);
    if (!review || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => {
      if (isReviewVisible(id)) finalizeRound(type);
    });
    observer.observe(review, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
  }

  function observeMatchProgress() {
    const count = byId('topic-match-count');
    if (!count || typeof MutationObserver === 'undefined') return;

    const update = () => {
      const round = rounds.match;
      round.total = numberFrom('topic-match-total', round.total);
      round.completedItems = Math.min(round.total, numberFrom('topic-match-count', 0));
      if (round.started && !round.completed) render(round, false);
    };

    new MutationObserver(update).observe(count, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function observeSpeakResults() {
    const current = byId('topic-speak-current');
    if (!current || typeof MutationObserver === 'undefined') return;

    const update = () => {
      const round = rounds.speak;
      if (!round.started || round.completed) return;

      round.total = numberFrom('topic-speak-total', round.total);
      const currentWord = Math.max(1, numberFrom('topic-speak-current', 1));
      // The current label is 1-based, so reaching word 4 means 3 answers
      // have already been accepted. The final answer is completed by Review.
      round.completedItems = Math.min(round.total, Math.max(0, currentWord - 1));
      render(round, false);
    };

    new MutationObserver(update).observe(current, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function observeGameContainer(type, id) {
    const container = byId(id);
    if (!container || typeof MutationObserver === 'undefined') return;

    let wasVisible = container.style.display !== 'none';
    new MutationObserver(() => {
      const visible = container.style.display !== 'none';
      if (visible && !wasVisible) resetRound(type);
      if (!visible && wasVisible) abortRound(type);
      wasVisible = visible;
    }).observe(container, { attributes: true, attributeFilter: ['style'] });
  }

  function bindButtons() {
    byId('topic-match-start-btn')?.addEventListener('click', () => beginRound('match'));
    byId('topic-speak-start-btn')?.addEventListener('click', () => beginRound('speak'));

    byId('topic-match-play-again')?.addEventListener('click', () => resetRound('match'));
    byId('topic-speak-play-again')?.addEventListener('click', () => resetRound('speak'));

    byId('back-from-topic-match')?.addEventListener('click', () => abortRound('match'));
    byId('topic-match-back-topic')?.addEventListener('click', () => abortRound('match'));
    byId('back-from-topic-speak')?.addEventListener('click', () => abortRound('speak'));
    byId('topic-speak-back-topic')?.addEventListener('click', () => abortRound('speak'));
  }

  function init() {
    resetRound('match');
    resetRound('speak');
    bindButtons();
    observeMatchProgress();
    observeSpeakResults();
    observeReview('match', 'topic-match-review');
    observeReview('speak', 'topic-speak-review');
    observeGameContainer('match', 'topic-match-container');
    observeGameContainer('speak', 'topic-speak-container');
  }

  window.EnglishNextLevelTopicStats = {
    resetRound,
    beginRound,
    getRound(type) {
      const round = rounds[type];
      return round ? { ...round, timerId: null } : null;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
