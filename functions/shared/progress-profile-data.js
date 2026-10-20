(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.EnglishNextLevelProgressData = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, () => {
  const PROGRESS_VERSION = 4;
  const PROGRESS_SYNC_TOO_LARGE_REASON = 'progress-too-large';
  const MAX_VOCABULARY_REVIEW_CARDS = 500;
  const HISTORY_RETENTION_YEARS = 2;
  const HISTORY_TIMEZONE_GRACE_DAYS = 2;
  const MAX_FUTURE_HISTORY_DAYS = 1;
  const VOCABULARY_REVIEW_CARD_ID = /^(present:verbs|past:past)(?:[1-9]|10):\d{1,3}$/;

  const NUMBER_MODES = [
    ['numbers', '1–10'],
    ['numbers11-20', '11–20'],
    ['tens', '20s'],
    ['random21_99', '21–99'],
    ['hundreds', '100s'],
    ['random101_999', '101–999'],
    ['thousands', '1K'],
    ['random1001_9999', '1K–9K'],
    ['mixedAdvanced', 'MIX']
  ];

  const WORD_MODES = {
    present: 'Simple Verbs',
    past: 'Simple Past'
  };
  function emptyProgress() {
    return {
      version: PROGRESS_VERSION,
      updatedAt: 0,
      numbers: { bestScores: {} },
      words: {
        present: { completed: false, bestScore: 0, bestTime: null },
        past: { completed: false, bestScore: 0, bestTime: null }
      },
      topics: {},
      topicStats: {},
      vocabularyReviews: { cards: {} },
      // Keep recent daily snapshots for charts and preserve older results in
      // the cumulative fields above so history can be compacted safely.
      history: { days: {} }
    };
  }

  function emptyDayProgress() {
    return {
      updatedAt: 0,
      numbers: { bestScores: {} },
      words: {
        present: { completed: false, bestScore: 0, bestTime: null },
        past: { completed: false, bestScore: 0, bestTime: null }
      },
      topics: {},
      topicStats: {}
    };
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isValidHistoryDateKey(dateKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12) return false;

    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day >= 1 && day <= daysInMonth[month - 1];
  }

  function historyRetentionWindow(now = new Date()) {
    const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const current = new Date(Number.isFinite(timestamp) ? timestamp : Date.now());
    const todayYear = current.getUTCFullYear();
    const todayMonth = current.getUTCMonth();
    const todayDay = current.getUTCDate();
    const today = Date.UTC(todayYear, todayMonth, todayDay);

    const cutoffYear = todayYear - HISTORY_RETENTION_YEARS;
    const isLeapYear = cutoffYear % 4 === 0 && (cutoffYear % 100 !== 0 || cutoffYear % 400 === 0);
    const cutoffMonthDays = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const cutoffDay = Math.min(todayDay, cutoffMonthDays[todayMonth]);
    const cutoff = new Date(Date.UTC(cutoffYear, todayMonth, cutoffDay));
    cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_TIMEZONE_GRACE_DAYS);

    const latest = new Date(today + MAX_FUTURE_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    return {
      cutoffDateKey: cutoff.toISOString().slice(0, 10),
      latestDateKey: latest.toISOString().slice(0, 10)
    };
  }

  function safeNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function ownValue(object, key) {
    return object && Object.prototype.hasOwnProperty.call(object, key)
      ? object[key]
      : undefined;
  }

  function setOwnValue(object, key, value) {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
    return value;
  }

  function ensureOwnRecord(object, key) {
    const existing = ownValue(object, key);
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      return existing;
    }
    return setOwnValue(object, key, {});
  }

  function normalizeTopicTree(input) {
    const topics = {};
    if (!input || typeof input !== 'object') return topics;

    Object.entries(input).forEach(([topicId, levels]) => {
      if (!levels || typeof levels !== 'object') return;
      const topic = setOwnValue(topics, topicId, {});
      Object.entries(levels).forEach(([levelId, volumes]) => {
        if (!volumes || typeof volumes !== 'object') return;
        const level = setOwnValue(topic, levelId, {});
        Object.entries(volumes).forEach(([volumeId, games]) => {
          if (!games || typeof games !== 'object') return;
          setOwnValue(level, volumeId, {
            match: Boolean(games.match),
            speak: Boolean(games.speak)
          });
        });
      });
    });

    return topics;
  }

  function normalizeTopicStatsTree(input) {
    const stats = {};
    if (!input || typeof input !== 'object') return stats;

    Object.entries(input).forEach(([topicId, levels]) => {
      if (!levels || typeof levels !== 'object') return;
      const topic = setOwnValue(stats, topicId, {});
      Object.entries(levels).forEach(([levelId, volumes]) => {
        if (!volumes || typeof volumes !== 'object') return;
        const level = setOwnValue(topic, levelId, {});
        Object.entries(volumes).forEach(([volumeId, games]) => {
          if (!games || typeof games !== 'object') return;
          const normalizedGames = {};
          ['match', 'speak'].forEach((gameType) => {
            const source = games[gameType];
            if (!source || typeof source !== 'object') return;
            const score = Math.max(0, Math.min(1000, Math.floor(safeNumber(source.bestScore))));
            const rawTime = source.bestTime == null ? null : Math.max(0, Math.floor(safeNumber(source.bestTime)));
            normalizedGames[gameType] = {
              bestScore: score,
              bestTime: rawTime > 0 ? rawTime : null
            };
          });
          if (Object.keys(normalizedGames).length) {
            setOwnValue(level, volumeId, normalizedGames);
          }
        });
      });
    });

    return stats;
  }

  function normalizeVocabularyReviews(input) {
    const cards = {};
    const sourceCards = input?.cards;
    if (!sourceCards || typeof sourceCards !== 'object' || Array.isArray(sourceCards)) {
      return { cards };
    }

    Object.entries(sourceCards).slice(0, MAX_VOCABULARY_REVIEW_CARDS).forEach(([id, source]) => {
      if (!VOCABULARY_REVIEW_CARD_ID.test(id) || !source || typeof source !== 'object') return;
      if (typeof source.front !== 'string' || typeof source.back !== 'string') return;
      const mode = id.startsWith('present:') ? 'present' : 'past';
      const setId = id.split(':')[1];
      const due = Math.max(0, safeNumber(source.due));
      const updatedAt = Math.max(0, safeNumber(source.updatedAt));
      const state = Math.floor(safeNumber(source.state, -1));
      if (!due || !updatedAt || state < 0 || state > 3) return;

      const metric = (key, fallback = 0, max = 100000) =>
        Math.max(0, Math.min(max, safeNumber(source[key], fallback)));
      const rawLastReview = source.last_review == null
        ? null
        : Math.max(0, safeNumber(source.last_review));

      cards[id] = {
        mode,
        setId,
        front: source.front.trim().slice(0, 160),
        back: source.back.trim().slice(0, 160),
        due,
        stability: metric('stability'),
        difficulty: metric('difficulty', 0, 10),
        elapsed_days: metric('elapsed_days'),
        scheduled_days: metric('scheduled_days'),
        reps: Math.floor(metric('reps', 0, 100000)),
        lapses: Math.floor(metric('lapses', 0, 100000)),
        learning_steps: Math.floor(metric('learning_steps', 0, 100000)),
        state,
        last_review: rawLastReview || null,
        updatedAt
      };
    });

    return { cards };
  }

  function mergeVocabularyReviews(leftInput, rightInput) {
    const left = normalizeVocabularyReviews(leftInput).cards;
    const right = normalizeVocabularyReviews(rightInput).cards;
    const cards = { ...left };

    Object.entries(right).forEach(([id, rightCard]) => {
      const leftCard = cards[id];
      if (!leftCard || rightCard.updatedAt > leftCard.updatedAt) cards[id] = rightCard;
    });

    return { cards };
  }

  function normalizeDayProgress(input) {
    const day = emptyDayProgress();
    if (!input || typeof input !== 'object') return day;

    day.updatedAt = Math.max(0, safeNumber(input.updatedAt));

    const sourceScores = input.numbers?.bestScores || {};
    NUMBER_MODES.forEach(([modeId]) => {
      day.numbers.bestScores[modeId] = Math.max(0, Math.floor(safeNumber(sourceScores[modeId])));
    });

    Object.keys(WORD_MODES).forEach((mode) => {
      const source = input.words?.[mode] || {};
      const time = source.bestTime == null ? null : Math.max(0, Math.floor(safeNumber(source.bestTime)));
      day.words[mode] = {
        completed: Boolean(source.completed),
        bestScore: Math.max(0, Math.floor(safeNumber(source.bestScore))),
        bestTime: time > 0 ? time : null
      };
    });

    day.topics = normalizeTopicTree(input.topics);
    day.topicStats = normalizeTopicStatsTree(input.topicStats);
    return day;
  }

  function mergeTopicTrees(leftTopics, rightTopics) {
    const merged = {};
    const topicIds = new Set([...Object.keys(leftTopics || {}), ...Object.keys(rightTopics || {})]);
    topicIds.forEach((topicId) => {
      const mergedTopic = setOwnValue(merged, topicId, {});
      const leftTopic = ownValue(leftTopics, topicId) || {};
      const rightTopic = ownValue(rightTopics, topicId) || {};
      const levelIds = new Set([
        ...Object.keys(leftTopic),
        ...Object.keys(rightTopic)
      ]);
      levelIds.forEach((levelId) => {
        const mergedLevel = setOwnValue(mergedTopic, levelId, {});
        const leftLevel = ownValue(leftTopic, levelId) || {};
        const rightLevel = ownValue(rightTopic, levelId) || {};
        const volumeIds = new Set([
          ...Object.keys(leftLevel),
          ...Object.keys(rightLevel)
        ]);
        volumeIds.forEach((volumeId) => {
          const l = ownValue(leftLevel, volumeId) || {};
          const r = ownValue(rightLevel, volumeId) || {};
          setOwnValue(mergedLevel, volumeId, {
            match: Boolean(l.match || r.match),
            speak: Boolean(l.speak || r.speak)
          });
        });
      });
    });
    return merged;
  }

  function mergeTopicStatsTrees(leftStats, rightStats) {
    const merged = {};
    const topicIds = new Set([...Object.keys(leftStats || {}), ...Object.keys(rightStats || {})]);

    topicIds.forEach((topicId) => {
      const leftTopic = ownValue(leftStats, topicId) || {};
      const rightTopic = ownValue(rightStats, topicId) || {};
      const levelIds = new Set([
        ...Object.keys(leftTopic),
        ...Object.keys(rightTopic)
      ]);
      levelIds.forEach((levelId) => {
        const leftLevel = ownValue(leftTopic, levelId) || {};
        const rightLevel = ownValue(rightTopic, levelId) || {};
        const volumeIds = new Set([
          ...Object.keys(leftLevel),
          ...Object.keys(rightLevel)
        ]);
        volumeIds.forEach((volumeId) => {
          ['match', 'speak'].forEach((gameType) => {
            const left = ownValue(ownValue(leftLevel, volumeId), gameType);
            const right = ownValue(ownValue(rightLevel, volumeId), gameType);
            if (!left && !right) return;

            const mergedTopic = ensureOwnRecord(merged, topicId);
            const mergedLevel = ensureOwnRecord(mergedTopic, levelId);
            const mergedVolume = ensureOwnRecord(mergedLevel, volumeId);
            setOwnValue(mergedVolume, gameType, {
              bestScore: Math.max(left?.bestScore || 0, right?.bestScore || 0),
              bestTime: bestTime(left?.bestTime, right?.bestTime)
            });
          });
        });
      });
    });

    return merged;
  }

  function mergeDayProgress(a, b) {
    const left = normalizeDayProgress(a);
    const right = normalizeDayProgress(b);
    const merged = emptyDayProgress();

    merged.updatedAt = Math.max(left.updatedAt, right.updatedAt);
    NUMBER_MODES.forEach(([modeId]) => {
      merged.numbers.bestScores[modeId] = Math.max(
        left.numbers.bestScores[modeId] || 0,
        right.numbers.bestScores[modeId] || 0
      );
    });

    Object.keys(WORD_MODES).forEach((mode) => {
      merged.words[mode] = {
        completed: left.words[mode].completed || right.words[mode].completed,
        bestScore: Math.max(left.words[mode].bestScore || 0, right.words[mode].bestScore || 0),
        bestTime: bestTime(left.words[mode].bestTime, right.words[mode].bestTime)
      };
    });

    merged.topics = mergeTopicTrees(left.topics, right.topics);
    merged.topicStats = mergeTopicStatsTrees(left.topicStats, right.topicStats);
    return merged;
  }

  function foldDayIntoCumulative(progress, day) {
    progress.updatedAt = Math.max(progress.updatedAt || 0, day.updatedAt || 0);

    NUMBER_MODES.forEach(([modeId]) => {
      progress.numbers.bestScores[modeId] = Math.max(
        progress.numbers.bestScores[modeId] || 0,
        day.numbers?.bestScores?.[modeId] || 0
      );
    });

    Object.keys(WORD_MODES).forEach((mode) => {
      const current = progress.words[mode];
      const daily = day.words?.[mode] || {};
      current.completed = current.completed || Boolean(daily.completed);
      current.bestScore = Math.max(current.bestScore || 0, daily.bestScore || 0);
      current.bestTime = bestTime(current.bestTime, daily.bestTime);
    });

    progress.topics = mergeTopicTrees(progress.topics, day.topics);
    progress.topicStats = mergeTopicStatsTrees(progress.topicStats, day.topicStats);
  }

  function normalizeProgress(input, now = new Date()) {
    const base = emptyProgress();
    if (!input || typeof input !== 'object') return base;

    base.updatedAt = Math.max(0, safeNumber(input.updatedAt));

    const sourceScores = input.numbers?.bestScores || {};
    NUMBER_MODES.forEach(([modeId]) => {
      base.numbers.bestScores[modeId] = Math.max(0, Math.floor(safeNumber(sourceScores[modeId])));
    });

    Object.keys(WORD_MODES).forEach((mode) => {
      const source = input.words?.[mode] || {};
      const time = source.bestTime == null ? null : Math.max(0, Math.floor(safeNumber(source.bestTime)));
      base.words[mode] = {
        completed: Boolean(source.completed),
        bestScore: Math.max(0, Math.floor(safeNumber(source.bestScore))),
        bestTime: time > 0 ? time : null
      };
    });

    base.topics = normalizeTopicTree(input.topics);
    base.topicStats = normalizeTopicStatsTree(input.topicStats);
    base.vocabularyReviews = normalizeVocabularyReviews(input.vocabularyReviews);

    const sourceDays = input.history?.days;
    const { cutoffDateKey, latestDateKey } = historyRetentionWindow(now);
    if (sourceDays && typeof sourceDays === 'object') {
      Object.entries(sourceDays).forEach(([dateKey, dayValue]) => {
        if (!isValidHistoryDateKey(dateKey) || dateKey > latestDateKey) return;
        const day = normalizeDayProgress(dayValue);
        base.history.days[dateKey] = day;
        foldDayIntoCumulative(base, day);
      });
    }

    // Preserve old best results before deleting their daily detail. UTC dates
    // plus a two-day margin keep browser and Functions cutoffs aligned.
    Object.keys(base.history.days).forEach((dateKey) => {
      if (dateKey < cutoffDateKey) delete base.history.days[dateKey];
    });

    return base;
  }

  function bestTime(a, b) {
    const values = [a, b]
      .map((value) => value == null ? null : Math.max(0, Math.floor(safeNumber(value))))
      .filter((value) => value && value > 0);
    return values.length ? Math.min(...values) : null;
  }

  function mergeProgress(a, b, now = new Date()) {
    const left = normalizeProgress(a, now);
    const right = normalizeProgress(b, now);
    const merged = emptyProgress();

    merged.updatedAt = Math.max(left.updatedAt, right.updatedAt);

    NUMBER_MODES.forEach(([modeId]) => {
      merged.numbers.bestScores[modeId] = Math.max(
        left.numbers.bestScores[modeId] || 0,
        right.numbers.bestScores[modeId] || 0
      );
    });

    Object.keys(WORD_MODES).forEach((mode) => {
      merged.words[mode] = {
        completed: left.words[mode].completed || right.words[mode].completed,
        bestScore: Math.max(left.words[mode].bestScore || 0, right.words[mode].bestScore || 0),
        bestTime: bestTime(left.words[mode].bestTime, right.words[mode].bestTime)
      };
    });

    merged.topics = mergeTopicTrees(left.topics, right.topics);
    merged.topicStats = mergeTopicStatsTrees(left.topicStats, right.topicStats);
    merged.vocabularyReviews = mergeVocabularyReviews(left.vocabularyReviews, right.vocabularyReviews);

    const dates = new Set([
      ...Object.keys(left.history?.days || {}),
      ...Object.keys(right.history?.days || {})
    ]);
    dates.forEach((dateKey) => {
      merged.history.days[dateKey] = mergeDayProgress(
        left.history?.days?.[dateKey],
        right.history?.days?.[dateKey]
      );
      foldDayIntoCumulative(merged, merged.history.days[dateKey]);
    });

    return merged;
  }


  return {
    PROGRESS_VERSION,
    PROGRESS_SYNC_TOO_LARGE_REASON,
    VOCABULARY_REVIEW_CARD_ID,
    NUMBER_MODES,
    WORD_MODES,
    bestTime,
    emptyDayProgress,
    emptyProgress,
    localDateKey,
    historyRetentionWindow,
    mergeProgress,
    normalizeDayProgress,
    normalizeProgress,
    normalizeVocabularyReviews,
    safeNumber
  };
});
