// ============================================
// PHASE 6A — PROFILE / PROGRESS
// Local-first progress with optional Firestore sync for signed-in users.
// ============================================

(function () {
  const PROGRESS_VERSION = 3;
  const STORAGE_PREFIX = 'englishNextLevel.progress.v1';
  const NUMBERS_STORAGE_PREFIX = 'englishNextLevel.numbersHighScores.v1';

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

  let cacheKey = null;
  let cache = null;
  let cloudSyncTimer = null;
  let cloudSyncState = 'local';
  let cloudLoadedUid = null;

  function currentProfileKey() {
    if (!window.isGuest && window.currentUser?.uid) {
      return `${STORAGE_PREFIX}.user.${window.currentUser.uid}`;
    }
    if (window.isGuest) return `${STORAGE_PREFIX}.guest`;
    return `${STORAGE_PREFIX}.local`;
  }

  function numbersStorageKey() {
    if (!window.isGuest && window.currentUser?.uid) {
      return `${NUMBERS_STORAGE_PREFIX}.user.${window.currentUser.uid}`;
    }
    if (window.isGuest) return `${NUMBERS_STORAGE_PREFIX}.guest`;
    return `${NUMBERS_STORAGE_PREFIX}.local`;
  }

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
      // Daily snapshots are append-only by date. The UI still renders the
      // cumulative fields above, while history prevents a new day/device from
      // erasing older progress and gives later phases a safe place for stats.
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

  function safeNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function normalizeTopicTree(input) {
    const topics = {};
    if (!input || typeof input !== 'object') return topics;

    Object.entries(input).forEach(([topicId, levels]) => {
      if (!levels || typeof levels !== 'object') return;
      topics[topicId] = {};
      Object.entries(levels).forEach(([levelId, volumes]) => {
        if (!volumes || typeof volumes !== 'object') return;
        topics[topicId][levelId] = {};
        Object.entries(volumes).forEach(([volumeId, games]) => {
          if (!games || typeof games !== 'object') return;
          topics[topicId][levelId][volumeId] = {
            match: Boolean(games.match),
            speak: Boolean(games.speak)
          };
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
      stats[topicId] = {};
      Object.entries(levels).forEach(([levelId, volumes]) => {
        if (!volumes || typeof volumes !== 'object') return;
        stats[topicId][levelId] = {};
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
            stats[topicId][levelId][volumeId] = normalizedGames;
          }
        });
      });
    });

    return stats;
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
      merged[topicId] = {};
      const levelIds = new Set([
        ...Object.keys(leftTopics?.[topicId] || {}),
        ...Object.keys(rightTopics?.[topicId] || {})
      ]);
      levelIds.forEach((levelId) => {
        merged[topicId][levelId] = {};
        const volumeIds = new Set([
          ...Object.keys(leftTopics?.[topicId]?.[levelId] || {}),
          ...Object.keys(rightTopics?.[topicId]?.[levelId] || {})
        ]);
        volumeIds.forEach((volumeId) => {
          const l = leftTopics?.[topicId]?.[levelId]?.[volumeId] || {};
          const r = rightTopics?.[topicId]?.[levelId]?.[volumeId] || {};
          merged[topicId][levelId][volumeId] = {
            match: Boolean(l.match || r.match),
            speak: Boolean(l.speak || r.speak)
          };
        });
      });
    });
    return merged;
  }

  function mergeTopicStatsTrees(leftStats, rightStats) {
    const merged = {};
    const topicIds = new Set([...Object.keys(leftStats || {}), ...Object.keys(rightStats || {})]);

    topicIds.forEach((topicId) => {
      const levelIds = new Set([
        ...Object.keys(leftStats?.[topicId] || {}),
        ...Object.keys(rightStats?.[topicId] || {})
      ]);
      levelIds.forEach((levelId) => {
        const volumeIds = new Set([
          ...Object.keys(leftStats?.[topicId]?.[levelId] || {}),
          ...Object.keys(rightStats?.[topicId]?.[levelId] || {})
        ]);
        volumeIds.forEach((volumeId) => {
          ['match', 'speak'].forEach((gameType) => {
            const left = leftStats?.[topicId]?.[levelId]?.[volumeId]?.[gameType];
            const right = rightStats?.[topicId]?.[levelId]?.[volumeId]?.[gameType];
            if (!left && !right) return;

            merged[topicId] ||= {};
            merged[topicId][levelId] ||= {};
            merged[topicId][levelId][volumeId] ||= {};
            merged[topicId][levelId][volumeId][gameType] = {
              bestScore: Math.max(left?.bestScore || 0, right?.bestScore || 0),
              bestTime: bestTime(left?.bestTime, right?.bestTime)
            };
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

  function normalizeProgress(input) {
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

    const sourceDays = input.history?.days;
    if (sourceDays && typeof sourceDays === 'object') {
      Object.entries(sourceDays).forEach(([dateKey, dayValue]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
        base.history.days[dateKey] = normalizeDayProgress(dayValue);
      });
    }

    // The cumulative view is rebuilt from every preserved day as a safety net.
    // This makes an old "today-only" payload incapable of wiping yesterday.
    Object.values(base.history.days).forEach((day) => foldDayIntoCumulative(base, day));

    return base;
  }

  function loadLocal(force = false) {
    const key = currentProfileKey();
    if (!force && cache && cacheKey === key) return cache;

    let parsed = null;
    try {
      parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
    } catch (error) {
      console.warn('PROGRESS: could not read local progress.', error);
    }

    cacheKey = key;
    cache = normalizeProgress(parsed);
    importExistingNumbers(cache);
    return cache;
  }

  function saveLocal(progress = loadLocal()) {
    progress.version = PROGRESS_VERSION;
    progress.updatedAt = Date.now();
    cache = progress;
    cacheKey = currentProfileKey();

    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(progress));
    } catch (error) {
      console.warn('PROGRESS: could not save local progress.', error);
    }

    renderProfile();
    scheduleCloudSync();
  }

  function readExistingNumbers() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(numbersStorageKey()) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function importExistingNumbers(progress) {
    const existing = readExistingNumbers();
    NUMBER_MODES.forEach(([modeId]) => {
      const value = Math.max(0, Math.floor(safeNumber(existing[modeId])));
      progress.numbers.bestScores[modeId] = Math.max(
        progress.numbers.bestScores[modeId] || 0,
        value
      );
    });
  }

  function writeNumbersBack(progress) {
    const merged = readExistingNumbers();
    NUMBER_MODES.forEach(([modeId]) => {
      merged[modeId] = Math.max(
        0,
        Math.floor(safeNumber(merged[modeId])),
        Math.floor(safeNumber(progress.numbers?.bestScores?.[modeId]))
      );
    });

    try {
      window.localStorage.setItem(numbersStorageKey(), JSON.stringify(merged));
    } catch (error) {
      console.warn('PROGRESS: could not write Numbers Best Scores.', error);
    }

    try {
      if (typeof loadNumbersHighScoresForCurrentProfile === 'function') {
        loadNumbersHighScoresForCurrentProfile(true);
      }
      if (typeof syncNumbersMenuBestScores === 'function') syncNumbersMenuBestScores();
    } catch (error) {
      // game.js may not have initialized yet.
    }
  }

  function bestTime(a, b) {
    const values = [a, b]
      .map((value) => value == null ? null : Math.max(0, Math.floor(safeNumber(value))))
      .filter((value) => value && value > 0);
    return values.length ? Math.min(...values) : null;
  }

  function mergeProgress(a, b) {
    const left = normalizeProgress(a);
    const right = normalizeProgress(b);
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

  function setSyncState(state) {
    cloudSyncState = state;
    const el = document.getElementById('progress-sync-status');
    if (!el) return;

    if (window.isGuest || !window.currentUser?.uid) {
      el.textContent = 'Saved on this device';
      el.dataset.state = 'local';
      return;
    }

    const labels = {
      syncing: 'Syncing…',
      synced: 'Synced',
      error: 'Saved locally',
      local: 'Saved locally'
    };
    el.textContent = labels[state] || 'Saved locally';
    el.dataset.state = state;
  }

  function canUseCloud() {
    return Boolean(!window.isGuest && window.currentUser?.uid && typeof db !== 'undefined');
  }

  async function syncFromCloud(force = false) {
    if (!canUseCloud()) {
      cloudLoadedUid = null;
      setSyncState('local');
      return loadLocal(true);
    }

    const uid = window.currentUser.uid;
    if (!force && cloudLoadedUid === uid) return loadLocal();

    setSyncState('syncing');
    try {
      const snapshot = await db.collection('users').doc(uid).get();
      const cloud = snapshot.exists ? snapshot.data()?.progressV1 : null;
      const local = loadLocal(true);
      importExistingNumbers(local);
      const merged = mergeProgress(local, cloud);
      cache = merged;
      cacheKey = currentProfileKey();
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify(merged));
      } catch (error) {}
      writeNumbersBack(merged);

      await db.collection('users').doc(uid).set({
        progressV1: merged,
        progressUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      cloudLoadedUid = uid;
      setSyncState('synced');
      renderProfile();
      return merged;
    } catch (error) {
      console.warn('PROGRESS: Firestore sync unavailable; keeping local progress.', error);
      cloudLoadedUid = uid;
      setSyncState('error');
      renderProfile();
      return loadLocal();
    }
  }

  async function pushCloud() {
    if (!canUseCloud()) {
      setSyncState('local');
      return;
    }

    const uid = window.currentUser.uid;
    const local = loadLocal();
    const docRef = db.collection('users').doc(uid);
    setSyncState('syncing');

    try {
      // Never push a stale local snapshot blindly. Read+merge inside a
      // transaction so older days/completions already in Firestore survive.
      const merged = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(docRef);
        const cloud = snapshot.exists ? snapshot.data()?.progressV1 : null;
        const next = mergeProgress(local, cloud);
        next.updatedAt = Math.max(next.updatedAt, Date.now());

        transaction.set(docRef, {
          progressV1: next,
          progressUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return next;
      });

      cache = merged;
      cacheKey = currentProfileKey();
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify(merged));
      } catch (error) {}
      writeNumbersBack(merged);

      cloudLoadedUid = uid;
      setSyncState('synced');
      renderProfile();
    } catch (error) {
      console.warn('PROGRESS: could not sync to Firestore.', error);
      setSyncState('error');
    }
  }

  function scheduleCloudSync() {
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    if (!canUseCloud()) {
      setSyncState('local');
      return;
    }
    cloudSyncTimer = setTimeout(() => {
      cloudSyncTimer = null;
      pushCloud();
    }, 450);
  }

  function getToday(progress) {
    progress.history ||= { days: {} };
    progress.history.days ||= {};
    const key = localDateKey();
    progress.history.days[key] = normalizeDayProgress(progress.history.days[key]);
    return progress.history.days[key];
  }

  function touchDay(day) {
    day.updatedAt = Date.now();
  }

  function recordNumbersBest(modeId, score) {
    if (!modeId) return;
    const progress = loadLocal();
    const today = getToday(progress);
    const next = Math.max(0, Math.floor(safeNumber(score)));
    const previous = Math.max(0, progress.numbers.bestScores[modeId] || 0);
    progress.numbers.bestScores[modeId] = Math.max(previous, next);
    today.numbers.bestScores[modeId] = Math.max(today.numbers.bestScores[modeId] || 0, next);
    touchDay(today);
    // game.js only calls this hook when a new Best Score is confirmed. Save even
    // if the legacy Numbers storage was imported a millisecond earlier, so the
    // cloud profile receives that new best as well.
    saveLocal(progress);
  }

  function recordWordsResult({ mode, score, timeSeconds }) {
    if (!WORD_MODES[mode]) return;
    const progress = loadLocal();
    const today = getToday(progress);
    const entry = progress.words[mode] || { completed: false, bestScore: 0, bestTime: null };
    const dailyEntry = today.words[mode] || { completed: false, bestScore: 0, bestTime: null };
    const nextScore = Math.max(0, Math.floor(safeNumber(score)));
    const nextTime = Math.max(0, Math.floor(safeNumber(timeSeconds)));

    entry.completed = true;
    entry.bestScore = Math.max(entry.bestScore || 0, nextScore);
    if (nextTime > 0) entry.bestTime = bestTime(entry.bestTime, nextTime);
    progress.words[mode] = entry;

    dailyEntry.completed = true;
    dailyEntry.bestScore = Math.max(dailyEntry.bestScore || 0, nextScore);
    if (nextTime > 0) dailyEntry.bestTime = bestTime(dailyEntry.bestTime, nextTime);
    today.words[mode] = dailyEntry;
    touchDay(today);
    saveLocal(progress);
  }

  function recordTopicCompletion({ topicId, levelId, volumeId, gameType }) {
    if (!topicId || !levelId || !volumeId || !['match', 'speak'].includes(gameType)) return;
    const progress = loadLocal();
    const today = getToday(progress);

    progress.topics[topicId] ||= {};
    progress.topics[topicId][levelId] ||= {};
    progress.topics[topicId][levelId][volumeId] ||= { match: false, speak: false };

    today.topics[topicId] ||= {};
    today.topics[topicId][levelId] ||= {};
    today.topics[topicId][levelId][volumeId] ||= { match: false, speak: false };

    const globalWasDone = Boolean(progress.topics[topicId][levelId][volumeId][gameType]);
    const todayWasDone = Boolean(today.topics[topicId][levelId][volumeId][gameType]);
    if (globalWasDone && todayWasDone) return;

    progress.topics[topicId][levelId][volumeId][gameType] = true;
    today.topics[topicId][levelId][volumeId][gameType] = true;
    touchDay(today);
    saveLocal(progress);
  }

  function recordTopicResult({ topicId, levelId, volumeId, gameType, score, timeSeconds }) {
    if (!topicId || !levelId || !volumeId || !['match', 'speak'].includes(gameType)) return;

    const progress = loadLocal();
    const today = getToday(progress);
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

    progress.topicStats ||= {};
    progress.topicStats[topicId] ||= {};
    progress.topicStats[topicId][levelId] ||= {};
    progress.topicStats[topicId][levelId][volumeId] ||= {};
    const current = progress.topicStats[topicId][levelId][volumeId][gameType] || { bestScore: 0, bestTime: null };
    current.bestScore = Math.max(current.bestScore || 0, nextScore);
    if (nextTime > 0) current.bestTime = bestTime(current.bestTime, nextTime);
    progress.topicStats[topicId][levelId][volumeId][gameType] = current;

    today.topicStats ||= {};
    today.topicStats[topicId] ||= {};
    today.topicStats[topicId][levelId] ||= {};
    today.topicStats[topicId][levelId][volumeId] ||= {};
    const daily = today.topicStats[topicId][levelId][volumeId][gameType] || { bestScore: 0, bestTime: null };
    daily.bestScore = Math.max(daily.bestScore || 0, nextScore);
    if (nextTime > 0) daily.bestTime = bestTime(daily.bestTime, nextTime);
    today.topicStats[topicId][levelId][volumeId][gameType] = daily;

    touchDay(today);
    saveLocal(progress);
  }

  function formatScore(value) {
    return Math.max(0, Math.floor(safeNumber(value))).toLocaleString('en-US');
  }

  function formatTime(seconds) {
    if (!seconds) return '—';
    const total = Math.max(0, Math.floor(safeNumber(seconds)));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function countTopicActivities(progress) {
    let completed = 0;
    Object.values(progress.topics || {}).forEach((levels) => {
      Object.values(levels || {}).forEach((volumes) => {
        Object.values(volumes || {}).forEach((games) => {
          if (games?.match) completed += 1;
          if (games?.speak) completed += 1;
        });
      });
    });
    return completed;
  }

  function totalAvailableTopicActivities() {
    let total = 0;
    Object.values(window.TOPICS_DATA || {}).forEach((topic) => {
      Object.values(topic?.levels || {}).forEach((level) => {
        const volumes = Array.isArray(level?.volumes)
          ? level.volumes
          : (Array.isArray(level?.words) ? [{ words: level.words }] : []);
        total += volumes.length * 2;
      });
    });
    return total;
  }

  function renderIdentity() {
    const name = window.currentUserName || window.currentUser?.displayName || (window.isGuest ? 'Guest' : 'Player');
    const email = !window.isGuest && window.currentUser?.email
      ? window.currentUser.email
      : 'Guest progress is stored on this device.';

    const nameEl = document.getElementById('progress-profile-name');
    const emailEl = document.getElementById('progress-profile-email');
    const avatar = document.getElementById('progress-avatar');
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (avatar) avatar.textContent = (name.trim()[0] || 'P').toUpperCase();

    setSyncState(cloudSyncState);
  }

  function renderNumbers(progress) {
    const grid = document.getElementById('progress-numbers-grid');
    if (!grid) return;

    const scores = progress.numbers?.bestScores || {};
    const practiced = NUMBER_MODES.filter(([modeId]) => (scores[modeId] || 0) > 0).length;
    const highest = Math.max(0, ...NUMBER_MODES.map(([modeId]) => scores[modeId] || 0));

    const primary = document.getElementById('progress-numbers-primary');
    const best = document.getElementById('progress-numbers-best');
    if (primary) primary.textContent = `${practiced}/${NUMBER_MODES.length}`;
    if (best) best.textContent = `Highest: ${formatScore(highest)}`;

    grid.innerHTML = '';
    NUMBER_MODES.forEach(([modeId, label]) => {
      const score = scores[modeId] || 0;
      const item = document.createElement('div');
      item.className = `progress-number-item${score > 0 ? ' is-complete' : ''}`;
      item.innerHTML = `<span>${label}</span><strong>${formatScore(score)}</strong>`;
      grid.appendChild(item);
    });
  }

  function renderWords(progress) {
    const grid = document.getElementById('progress-words-grid');
    if (!grid) return;

    const completedCount = Object.keys(WORD_MODES).filter((mode) => progress.words?.[mode]?.completed).length;
    const primary = document.getElementById('progress-words-primary');
    if (primary) primary.textContent = `${completedCount}/${Object.keys(WORD_MODES).length}`;

    grid.innerHTML = '';
    Object.entries(WORD_MODES).forEach(([mode, label]) => {
      const entry = progress.words?.[mode] || {};
      const card = document.createElement('article');
      card.className = `progress-word-card${entry.completed ? ' is-complete' : ''}`;
      card.innerHTML = `
        <div class="progress-word-card-heading">
          <div><span>WORDS</span><strong>${label}</strong></div>
          <span class="progress-complete-badge">${entry.completed ? 'Completed' : 'Not played'}</span>
        </div>
        <div class="progress-word-stats">
          <div><span>Best points</span><strong>${formatScore(entry.bestScore || 0)}</strong></div>
          <div><span>Best time</span><strong>${formatTime(entry.bestTime)}</strong></div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderTopics(progress) {
    const container = document.getElementById('progress-topics-list');
    if (!container) return;

    const completed = countTopicActivities(progress);
    const total = totalAvailableTopicActivities();
    const primary = document.getElementById('progress-topics-primary');
    if (primary) primary.textContent = `${completed}/${total}`;

    container.innerHTML = '';
    const topics = Object.values(window.TOPICS_DATA || {});
    if (!topics.length) {
      container.innerHTML = '<p class="progress-empty">No topic progress yet.</p>';
      return;
    }

    topics.forEach((topic) => {
      const topicCard = document.createElement('article');
      topicCard.className = 'progress-topic-card';
      const rows = [];

      Object.values(topic.levels || {}).forEach((level) => {
        const volumes = Array.isArray(level.volumes)
          ? level.volumes
          : (Array.isArray(level.words) ? [{ id: 'volume-1', label: 'Volume 1', words: level.words }] : []);

        volumes.forEach((volume) => {
          const games = progress.topics?.[topic.id]?.[level.id]?.[volume.id] || {};
          const stats = progress.topicStats?.[topic.id]?.[level.id]?.[volume.id] || {};
          const matchStats = stats.match || {};
          const speakStats = stats.speak || {};
          rows.push(`
            <div class="progress-topic-row">
              <div class="progress-topic-row-copy"><strong>${level.label}</strong><span>${volume.label}</span></div>
              <div class="progress-topic-games">
                <div class="progress-topic-game ${games.match ? 'is-done' : ''}">
                  <span>${games.match ? '✓ ' : ''}Match</span>
                  ${games.match && matchStats.bestScore ? `<small>${formatScore(matchStats.bestScore)} pts · ${formatTime(matchStats.bestTime)}</small>` : ''}
                </div>
                <div class="progress-topic-game ${games.speak ? 'is-done' : ''}">
                  <span>${games.speak ? '✓ ' : ''}Speak</span>
                  ${games.speak && speakStats.bestScore ? `<small>${formatScore(speakStats.bestScore)} pts · ${formatTime(speakStats.bestTime)}</small>` : ''}
                </div>
              </div>
            </div>
          `);
        });
      });

      topicCard.innerHTML = `
        <div class="progress-topic-heading">
          <span class="progress-topic-icon" aria-hidden="true"></span>
          <div><span>TOPIC</span><strong>${topic.title || topic.id}</strong></div>
        </div>
        <div class="progress-topic-rows">${rows.join('')}</div>
      `;

      // Topics now use PNG assets for their menu icons. The Progress screen used
      // to print the asset path as text (e.g. "images/topics/kitchen.png").
      // Render file-backed icons as images while keeping support for legacy
      // emoji/text icons in older topic data.
      const iconHost = topicCard.querySelector('.progress-topic-icon');
      const iconValue = typeof topic.icon === 'string' ? topic.icon.trim() : '';
      const iconIsAsset = /^(?:\.?\.?\/|images\/|assets\/)|\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i.test(iconValue);

      if (iconHost) {
        if (iconValue && iconIsAsset) {
          const image = document.createElement('img');
          image.src = iconValue;
          image.alt = '';
          image.decoding = 'async';
          image.loading = 'lazy';
          iconHost.appendChild(image);
        } else {
          iconHost.textContent = iconValue || '•';
        }
      }

      container.appendChild(topicCard);
    });
  }

  function renderOverall(progress) {
    const numberCompleted = NUMBER_MODES.filter(([modeId]) => (progress.numbers?.bestScores?.[modeId] || 0) > 0).length;
    const wordCompleted = Object.keys(WORD_MODES).filter((mode) => progress.words?.[mode]?.completed).length;
    const topicCompleted = countTopicActivities(progress);
    const total = NUMBER_MODES.length + Object.keys(WORD_MODES).length + totalAvailableTopicActivities();
    const done = numberCompleted + wordCompleted + topicCompleted;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    const value = document.getElementById('progress-overall-percent');
    const fill = document.getElementById('progress-overall-fill');
    if (value) value.textContent = `${percent}%`;
    if (fill) fill.style.width = `${percent}%`;
  }

  function renderProfile() {
    if (!document.getElementById('profile-container')) return;
    const progress = loadLocal();
    importExistingNumbers(progress);
    renderIdentity();
    renderOverall(progress);
    renderNumbers(progress);
    renderWords(progress);
    renderTopics(progress);
  }

  async function refreshProfile() {
    renderProfile();
    if (canUseCloud()) {
      await syncFromCloud(true);
    } else {
      setSyncState('local');
    }
  }

  function recordVisibleTopicReview(gameType) {
    const selection = window.TopicApp?.getSelection?.();
    const topic = selection?.topic;
    const level = selection?.level;
    const volume = selection?.volume;
    if (!topic || !level || !volume) return;

    recordTopicCompletion({
      topicId: topic.id,
      levelId: level.levelId || level.id,
      volumeId: volume.id || level.volumeId || 'volume-1',
      gameType
    });
  }

  function observeTopicReviews() {
    [
      ['topic-match-review', 'match'],
      ['topic-speak-review', 'speak']
    ].forEach(([id, gameType]) => {
      const element = document.getElementById(id);
      if (!element || typeof MutationObserver === 'undefined') return;

      const observer = new MutationObserver(() => {
        const visible = element.classList.contains('visible') && element.getAttribute('aria-hidden') !== 'true';
        if (visible) recordVisibleTopicReview(gameType);
      });
      observer.observe(element, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
    });
  }

  function openProfile() {
    if (typeof navigateTo === 'function') {
      navigateTo('profile');
      return;
    }
    const profile = document.getElementById('profile-container');
    const category = document.getElementById('category-container');
    if (category) category.style.display = 'none';
    if (profile) profile.style.display = 'block';
    refreshProfile();
  }

  function init() {
    document.getElementById('category-profile-btn')?.addEventListener('click', openProfile);
    document.getElementById('back-from-profile')?.addEventListener('click', () => {
      if (typeof goBack === 'function') goBack();
    });

    observeTopicReviews();
    renderProfile();

    try {
      if (typeof auth !== 'undefined' && auth?.onAuthStateChanged) {
        auth.onAuthStateChanged((user) => {
          cache = null;
          cacheKey = null;
          cloudLoadedUid = null;
          cloudSyncState = user && !window.isGuest ? 'syncing' : 'local';
          window.setTimeout(() => {
            renderProfile();
            if (user && !window.isGuest) syncFromCloud(true);
          }, 250);
        });
      }
    } catch (error) {
      console.warn('PROGRESS: auth observer unavailable.', error);
    }
  }

  window.EnglishNextLevelProgress = {
    recordNumbersBest,
    recordWordsResult,
    recordTopicCompletion,
    recordTopicResult,
    refreshProfile,
    getProgress() {
      return normalizeProgress(loadLocal());
    },
    getHistory() {
      return normalizeProgress(loadLocal()).history.days;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
