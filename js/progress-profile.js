// ============================================
// PHASE 6A — PROFILE / PROGRESS
// Local-first progress with optional Firestore sync for signed-in users.
// ============================================

(function () {
  const PROGRESS_VERSION = 1;
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
      topics: {}
    };
  }

  function safeNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
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

    if (input.topics && typeof input.topics === 'object') {
      Object.entries(input.topics).forEach(([topicId, levels]) => {
        if (!levels || typeof levels !== 'object') return;
        base.topics[topicId] = {};
        Object.entries(levels).forEach(([levelId, volumes]) => {
          if (!volumes || typeof volumes !== 'object') return;
          base.topics[topicId][levelId] = {};
          Object.entries(volumes).forEach(([volumeId, games]) => {
            if (!games || typeof games !== 'object') return;
            base.topics[topicId][levelId][volumeId] = {
              match: Boolean(games.match),
              speak: Boolean(games.speak)
            };
          });
        });
      });
    }

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

    const topicIds = new Set([...Object.keys(left.topics), ...Object.keys(right.topics)]);
    topicIds.forEach((topicId) => {
      merged.topics[topicId] = {};
      const levelIds = new Set([
        ...Object.keys(left.topics[topicId] || {}),
        ...Object.keys(right.topics[topicId] || {})
      ]);
      levelIds.forEach((levelId) => {
        merged.topics[topicId][levelId] = {};
        const volumeIds = new Set([
          ...Object.keys(left.topics[topicId]?.[levelId] || {}),
          ...Object.keys(right.topics[topicId]?.[levelId] || {})
        ]);
        volumeIds.forEach((volumeId) => {
          const l = left.topics[topicId]?.[levelId]?.[volumeId] || {};
          const r = right.topics[topicId]?.[levelId]?.[volumeId] || {};
          merged.topics[topicId][levelId][volumeId] = {
            match: Boolean(l.match || r.match),
            speak: Boolean(l.speak || r.speak)
          };
        });
      });
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

    const progress = loadLocal();
    setSyncState('syncing');
    try {
      await db.collection('users').doc(window.currentUser.uid).set({
        progressV1: progress,
        progressUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      cloudLoadedUid = window.currentUser.uid;
      setSyncState('synced');
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

  function recordNumbersBest(modeId, score) {
    if (!modeId) return;
    const progress = loadLocal();
    const next = Math.max(0, Math.floor(safeNumber(score)));
    const previous = Math.max(0, progress.numbers.bestScores[modeId] || 0);
    progress.numbers.bestScores[modeId] = Math.max(previous, next);
    // game.js only calls this hook when a new Best Score is confirmed. Save even
    // if the legacy Numbers storage was imported a millisecond earlier, so the
    // cloud profile receives that new best as well.
    saveLocal(progress);
  }

  function recordWordsResult({ mode, score, timeSeconds }) {
    if (!WORD_MODES[mode]) return;
    const progress = loadLocal();
    const entry = progress.words[mode] || { completed: false, bestScore: 0, bestTime: null };
    const nextScore = Math.max(0, Math.floor(safeNumber(score)));
    const nextTime = Math.max(0, Math.floor(safeNumber(timeSeconds)));

    entry.completed = true;
    entry.bestScore = Math.max(entry.bestScore || 0, nextScore);
    if (nextTime > 0) entry.bestTime = bestTime(entry.bestTime, nextTime);
    progress.words[mode] = entry;
    saveLocal(progress);
  }

  function recordTopicCompletion({ topicId, levelId, volumeId, gameType }) {
    if (!topicId || !levelId || !volumeId || !['match', 'speak'].includes(gameType)) return;
    const progress = loadLocal();
    progress.topics[topicId] ||= {};
    progress.topics[topicId][levelId] ||= {};
    progress.topics[topicId][levelId][volumeId] ||= { match: false, speak: false };

    if (progress.topics[topicId][levelId][volumeId][gameType]) return;
    progress.topics[topicId][levelId][volumeId][gameType] = true;
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
          rows.push(`
            <div class="progress-topic-row">
              <div class="progress-topic-row-copy"><strong>${level.label}</strong><span>${volume.label}</span></div>
              <div class="progress-topic-games">
                <span class="${games.match ? 'is-done' : ''}">${games.match ? '✓ ' : ''}Match</span>
                <span class="${games.speak ? 'is-done' : ''}">${games.speak ? '✓ ' : ''}Speak</span>
              </div>
            </div>
          `);
        });
      });

      topicCard.innerHTML = `
        <div class="progress-topic-heading">
          <span class="progress-topic-icon" aria-hidden="true">${topic.icon || '•'}</span>
          <div><span>TOPIC</span><strong>${topic.title || topic.id}</strong></div>
        </div>
        <div class="progress-topic-rows">${rows.join('')}</div>
      `;
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
    refreshProfile,
    getProgress() {
      return normalizeProgress(loadLocal());
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
