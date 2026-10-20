(function (root, factory) {
  const api = factory(root?.EnglishNextLevelProgressData);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.EnglishNextLevelProgressMutations = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, (progressData) => {
  if (typeof progressData?.normalizeProgress !== 'function') {
    throw new Error('EnglishNextLevelProgressData must load before progress mutations.');
  }

  const {
    NUMBER_MODES,
    WORD_MODES,
    VOCABULARY_REVIEW_CARD_ID,
    bestTime,
    normalizeDayProgress,
    normalizeProgress,
    normalizeVocabularyReviews,
    safeNumber
  } = progressData;
  const numberModeIds = new Set(NUMBER_MODES.map(([modeId]) => modeId));

  function copyProgress(input) {
    return normalizeProgress(input);
  }

  function getDay(progress, dateKey) {
    progress.history ||= { days: {} };
    progress.history.days ||= {};
    progress.history.days[dateKey] = normalizeDayProgress(progress.history.days[dateKey]);
    return progress.history.days[dateKey];
  }

  function touchDay(day, now) {
    day.updatedAt = now;
  }

  function recordNumbersBest(input, modeId, score, { dateKey, now }) {
    if (!numberModeIds.has(modeId)) return null;

    const progress = copyProgress(input);
    const today = getDay(progress, dateKey);
    const next = Math.max(0, Math.floor(safeNumber(score)));
    progress.numbers.bestScores[modeId] = Math.max(progress.numbers.bestScores[modeId] || 0, next);
    today.numbers.bestScores[modeId] = Math.max(today.numbers.bestScores[modeId] || 0, next);
    touchDay(today, now);
    return progress;
  }

  function recordWordsResult(input, { mode, score, timeSeconds }, { dateKey, now }) {
    if (!WORD_MODES[mode]) return null;

    const progress = copyProgress(input);
    const today = getDay(progress, dateKey);
    const entry = progress.words[mode];
    const dailyEntry = today.words[mode];
    const nextScore = Math.max(0, Math.floor(safeNumber(score)));
    const nextTime = Math.max(0, Math.floor(safeNumber(timeSeconds)));

    entry.completed = true;
    entry.bestScore = Math.max(entry.bestScore || 0, nextScore);
    if (nextTime > 0) entry.bestTime = bestTime(entry.bestTime, nextTime);
    dailyEntry.completed = true;
    dailyEntry.bestScore = Math.max(dailyEntry.bestScore || 0, nextScore);
    if (nextTime > 0) dailyEntry.bestTime = bestTime(dailyEntry.bestTime, nextTime);
    touchDay(today, now);
    return progress;
  }

  function recordVocabularyReviewItems(input, { mode, setId, items }, { now }) {
    const expectedSetPrefix = mode === 'present' ? 'verbs' : mode === 'past' ? 'past' : '';
    if (!expectedSetPrefix || !new RegExp(`^${expectedSetPrefix}(?:[1-9]|10)$`).test(String(setId || '')) || !Array.isArray(items)) {
      return { progress: null, added: 0 };
    }

    const progress = copyProgress(input);
    let added = 0;
    items.forEach((item) => {
      const itemId = Number(item?.id);
      const front = typeof item?.english === 'string' ? item.english.trim().slice(0, 160) : '';
      const back = typeof item?.portuguese === 'string' ? item.portuguese.trim().slice(0, 160) : '';
      if (!Number.isInteger(itemId) || itemId < 0 || itemId > 999 || !front || !back) return;

      const id = `${mode}:${setId}:${itemId}`;
      if (progress.vocabularyReviews.cards[id]) return;

      progress.vocabularyReviews.cards[id] = {
        mode,
        setId,
        front,
        back,
        due: now,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        learning_steps: 0,
        state: 0,
        last_review: null,
        updatedAt: now
      };
      added += 1;
    });

    return { progress: added ? progress : null, added };
  }

  function recordVocabularyReviewCard(input, cardId, cardData, { now }) {
    if (typeof cardId !== 'string' || !VOCABULARY_REVIEW_CARD_ID.test(cardId)) return null;
    const normalized = normalizeVocabularyReviews({ cards: { [cardId]: cardData } }).cards[cardId];
    if (!normalized) return null;

    const progress = copyProgress(input);
    progress.vocabularyReviews.cards[cardId] = {
      ...normalized,
      updatedAt: now
    };
    return progress;
  }

  function recordTopicResult(input, { topicId, levelId, volumeId, gameType, score, timeSeconds }, { dateKey, now }) {
    if (!topicId || !levelId || !volumeId || !['match', 'speak'].includes(gameType)) return null;

    const progress = copyProgress(input);
    const today = getDay(progress, dateKey);
    const nextScore = Math.max(0, Math.min(1000, Math.floor(safeNumber(score))));
    const nextTime = Math.max(0, Math.floor(safeNumber(timeSeconds)));

    progress.topics[topicId] ||= {};
    progress.topics[topicId][levelId] ||= {};
    progress.topics[topicId][levelId][volumeId] ||= { match: false, speak: false };
    progress.topics[topicId][levelId][volumeId][gameType] = true;

    today.topics[topicId] ||= {};
    today.topics[topicId][levelId] ||= {};
    today.topics[topicId][levelId][volumeId] ||= { match: false, speak: false };
    today.topics[topicId][levelId][volumeId][gameType] = true;

    progress.topicStats[topicId] ||= {};
    progress.topicStats[topicId][levelId] ||= {};
    progress.topicStats[topicId][levelId][volumeId] ||= {};
    const current = progress.topicStats[topicId][levelId][volumeId][gameType] || { bestScore: 0, bestTime: null };
    current.bestScore = Math.max(current.bestScore || 0, nextScore);
    if (nextTime > 0) current.bestTime = bestTime(current.bestTime, nextTime);
    progress.topicStats[topicId][levelId][volumeId][gameType] = current;

    today.topicStats[topicId] ||= {};
    today.topicStats[topicId][levelId] ||= {};
    today.topicStats[topicId][levelId][volumeId] ||= {};
    const daily = today.topicStats[topicId][levelId][volumeId][gameType] || { bestScore: 0, bestTime: null };
    daily.bestScore = Math.max(daily.bestScore || 0, nextScore);
    if (nextTime > 0) daily.bestTime = bestTime(daily.bestTime, nextTime);
    today.topicStats[topicId][levelId][volumeId][gameType] = daily;

    touchDay(today, now);
    return progress;
  }

  return Object.freeze({
    recordNumbersBest,
    recordWordsResult,
    recordVocabularyReviewItems,
    recordVocabularyReviewCard,
    recordTopicResult
  });
});
