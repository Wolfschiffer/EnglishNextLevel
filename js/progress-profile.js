// ============================================
// PHASE 6A — PROFILE / PROGRESS
// Local-first progress with optional Firestore sync for signed-in users.
// ============================================

(function () {
  const STORAGE_PREFIX = 'englishNextLevel.progress.v1';
  const NUMBERS_STORAGE_PREFIX = 'englishNextLevel.numbersHighScores.v1';
  const {
    PROGRESS_VERSION,
    PROGRESS_SYNC_TOO_LARGE_REASON,
    NUMBER_MODES,
    WORD_MODES,
    emptyProgress,
    localDateKey,
    mergeProgress,
    normalizeProgress,
    safeNumber
  } = window.EnglishNextLevelProgressData;
  const progressMutations = window.EnglishNextLevelProgressMutations;
  if (!progressMutations) {
    throw new Error('EnglishNextLevelProgressMutations must load before progress-profile.js.');
  }
  const {
    formatScore,
    formatTime,
    summarizeOverall
  } = window.EnglishNextLevelProgressSummary;

  let cacheKey = null;
  let cache = null;
  let cloudSyncTimer = null;
  let cloudSyncState = 'local';
  let cloudSyncError = null;
  let localStorageUnavailable = false;
  let cloudLoadedUid = null;
  const cloudSyncInFlight = new Map();
  const cloudSyncPending = new Set();
  const localStoragePendingWrites = new Map();
  const progressRollbackByStorageKey = new Map();
  const profileRenderer = window.EnglishNextLevelProgressRenderer.create({
    document,
    window,
    numberModes: NUMBER_MODES,
    wordModes: WORD_MODES,
    formatScore,
    formatTime,
    summarizeOverall,
    setSyncState,
    getSyncState: () => cloudSyncState
  });

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

  function loadLocal(force = false) {
    const key = currentProfileKey();
    // Keep a failed local write available even if the auth observer clears the
    // active cache while switching accounts.
    if (localStoragePendingWrites.has(key)) {
      cacheKey = key;
      cache = localStoragePendingWrites.get(key);
      return cache;
    }
    if (!force && cache && cacheKey === key) return cache;
    let parsed = null;
    try {
      parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
    } catch (error) {
      console.warn('PROGRESS: could not read local progress.', error);
      if (cache && cacheKey === key) return cache;
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

    const savedLocally = writeLocalProgress(cacheKey, progress);

    renderProfile();
    scheduleCloudSync();
    return savedLocally;
  }

  function writeLocalProgress(key, progress) {
    try {
      window.localStorage.setItem(key, JSON.stringify(progress));
      localStoragePendingWrites.delete(key);
      localStorageUnavailable = false;
      return true;
    } catch (error) {
      localStoragePendingWrites.set(key, progress);
      localStorageUnavailable = true;
      console.warn('PROGRESS: could not save local progress.', error);
      return false;
    }
  }

  function saveProgress(progress, previousProgress) {
    const key = currentProfileKey();
    const hadPendingWrite = localStoragePendingWrites.has(key);
    const savedLocally = saveLocal(progress);
    if (savedLocally) {
      progressRollbackByStorageKey.delete(key);
      return true;
    }
    if (canUseCloud()) {
      if (!progressRollbackByStorageKey.has(key)) {
        progressRollbackByStorageKey.set(key, previousProgress);
      }
      return true;
    }

    // Do not present session-only results as saved progress when neither local
    // storage nor an account-backed cloud sync can accept them.
    cache = previousProgress;
    cacheKey = key;
    if (hadPendingWrite) localStoragePendingWrites.set(key, previousProgress);
    else localStoragePendingWrites.delete(key);
    progressRollbackByStorageKey.delete(key);
    renderProfile();
    return false;
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
      if (typeof setNumbersHighScoresFromProgress === 'function') {
        setNumbersHighScoresFromProgress(merged);
      } else {
        if (typeof loadNumbersHighScoresForCurrentProfile === 'function') {
          loadNumbersHighScoresForCurrentProfile(true);
        }
        if (typeof syncNumbersMenuBestScores === 'function') syncNumbersMenuBestScores();
      }
    } catch (error) {
      // The Numbers module may not have initialized yet.
    }
  }

  function isOversizedProgressSyncError(error) {
    return error?.details?.reason === PROGRESS_SYNC_TOO_LARGE_REASON;
  }

  function setSyncState(state, syncError = null) {
    cloudSyncState = state;
    if (state === 'error') {
      if (syncError) cloudSyncError = syncError;
    } else {
      cloudSyncError = null;
    }
    const el = document.getElementById('progress-sync-status');
    if (!el) return;

    if (window.isGuest || !window.currentUser?.uid) {
      el.textContent = localStorageUnavailable ? 'Progress not saved' : 'Saved on this device';
      el.dataset.state = localStorageUnavailable ? 'error' : 'local';
      return;
    }

    const errorLabel = localStorageUnavailable
      ? 'Progress not saved'
      : isOversizedProgressSyncError(cloudSyncError)
        ? 'Too large to sync; saved locally'
        : 'Saved locally';
    const labels = {
      syncing: 'Syncing…',
      synced: 'Synced',
      error: errorLabel,
      local: localStorageUnavailable ? 'Progress not saved' : 'Saved locally'
    };
    el.textContent = labels[state] || 'Saved locally';
    el.dataset.state = state;
  }

  function canUseCloud() {
    return Boolean(
      !window.isGuest && window.currentUser?.uid && typeof db !== 'undefined'
      && typeof window.enlSyncProgress === 'function'
    );
  }

  function stableProgressValue(value) {
    if (Array.isArray(value)) return value.map(stableProgressValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableProgressValue(value[key])]));
  }

  function serializeProgress(value) {
    return JSON.stringify(stableProgressValue(value));
  }

  async function syncFromCloud(force = false, queueIfInFlight = false) {
    if (!canUseCloud()) {
      cloudLoadedUid = null;
      setSyncState('local');
      return loadLocal(true);
    }

    const uid = window.currentUser.uid;
    if (!force && cloudLoadedUid === uid) return loadLocal();
    if (cloudSyncInFlight.has(uid)) {
      if (queueIfInFlight) cloudSyncPending.add(uid);
      return cloudSyncInFlight.get(uid);
    }

    const syncPromise = (async () => {
      setSyncState('syncing');
      try {
        const docRef = db.collection('users').doc(uid);
        const local = loadLocal(true);
        importExistingNumbers(local);
        const snapshot = await docRef.get();
        const cloudData = snapshot.exists ? snapshot.data() : null;
        const cloud = cloudData?.progressV1;
        const cloudProfileName = typeof cloudData?.name === 'string' ? cloudData.name.trim() : '';
        const cloudProfileEmail = typeof cloudData?.email === 'string' ? cloudData.email.trim() : '';
        const needsProfileRepair = !cloudProfileName || !cloudProfileEmail || cloudData?.createdAt == null;
        const next = mergeProgress(local, cloud);
        const normalizedCloud = normalizeProgress(cloud);
        const hasMergedChanges = serializeProgress(next) !== serializeProgress(normalizedCloud);
        const needsCloudNormalization = cloud != null
          && serializeProgress(cloud) !== serializeProgress(normalizedCloud);
        let merged = next;

        if (hasMergedChanges || needsCloudNormalization || needsProfileRepair) {
          if (window.isGuest || window.currentUser?.uid !== uid) return next;

            const syncedProgress = await window.enlSyncProgress(local, uid, window.currentUserName);
          if (!syncedProgress || typeof syncedProgress !== 'object' || Array.isArray(syncedProgress)) {
            throw new Error('Progress sync returned an invalid response.');
          }
          merged = normalizeProgress(syncedProgress);
        }

        if (window.isGuest || window.currentUser?.uid !== uid) return merged;

        const latestLocal = loadLocal(true);
        importExistingNumbers(latestLocal);
        const mergedLatest = mergeProgress(latestLocal, merged);
        const hasNewerLocalProgress = JSON.stringify(mergedLatest) !== JSON.stringify(merged);
        if (hasNewerLocalProgress) {
          cloudSyncPending.add(uid);
        }

        cache = mergedLatest;
        cacheKey = currentProfileKey();
        writeLocalProgress(cacheKey, mergedLatest);
        if (hasNewerLocalProgress && localStorageUnavailable) {
          progressRollbackByStorageKey.set(cacheKey, normalizeProgress(merged));
        } else {
          progressRollbackByStorageKey.delete(cacheKey);
        }
        writeNumbersBack(mergedLatest);

        cloudLoadedUid = uid;
        setSyncState('synced');
        renderProfile();
        return mergedLatest;
      } catch (error) {
        console.warn('PROGRESS: Firestore sync unavailable; keeping local progress.', error);
        if (!window.isGuest && window.currentUser?.uid === uid) {
          const key = currentProfileKey();
          const rollback = progressRollbackByStorageKey.get(key);
          let didRollback = false;
          let reviewRollback = null;
          if (rollback) {
            reviewRollback = {
              beforeCards: cache?.vocabularyReviews?.cards || {},
              restoredCards: rollback.vocabularyReviews?.cards || {}
            };
            cache = rollback;
            cacheKey = key;
            if (localStoragePendingWrites.has(key)) localStoragePendingWrites.set(key, rollback);
            progressRollbackByStorageKey.delete(key);
            didRollback = true;
            if (typeof setNumbersHighScoresFromProgress === 'function') {
              setNumbersHighScoresFromProgress(rollback.numbers?.bestScores || {}, {
                invalidateUnconfirmedResult: true
              });
            }
          }
          cloudLoadedUid = null;
          setSyncState('error', error);
          renderProfile();
          if (didRollback) {
            window.EnglishNextLevelSpacedReviewManager?.refresh?.({ rollback: true, ...reviewRollback });
          }
        }
        return loadLocal();
      }
    })();

    cloudSyncInFlight.set(uid, syncPromise);
    try {
      return await syncPromise;
    } finally {
      const shouldSyncAgain = cloudSyncPending.delete(uid);
      if (cloudSyncInFlight.get(uid) === syncPromise) cloudSyncInFlight.delete(uid);
      if (shouldSyncAgain && !window.isGuest && window.currentUser?.uid === uid) {
        await syncFromCloud(true);
      }
    }
  }

  async function pushCloud() {
    if (!canUseCloud()) {
      setSyncState('local');
      return;
    }
    return syncFromCloud(true, true);
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
    const current = loadLocal();
    const previousProgress = normalizeProgress(current);
    const now = Date.now();
    const nextProgress = progressMutations.recordNumbersBest(current, modeId, score, {
      dateKey: localDateKey(new Date(now)),
      now
    });
    if (!nextProgress) return false;
    // game.js only calls this hook when a new Best Score is confirmed. Save even
    // if the legacy Numbers storage was imported a millisecond earlier, so the
    // cloud profile receives that new best as well.
    return saveProgress(nextProgress, previousProgress);
  }

  function recordWordsResult(result) {
    const current = loadLocal();
    const previousProgress = normalizeProgress(current);
    const now = Date.now();
    const nextProgress = progressMutations.recordWordsResult(current, result, {
      dateKey: localDateKey(new Date(now)),
      now
    });
    return nextProgress ? saveProgress(nextProgress, previousProgress) : false;
  }

  function recordVocabularyReviewItems(input) {
    const current = loadLocal();
    const { progress: nextProgress, added } = progressMutations.recordVocabularyReviewItems(current, input, {
      now: Date.now()
    });
    if (!added) return 0;
    const previousProgress = normalizeProgress(current);
    return saveProgress(nextProgress, previousProgress) ? added : 0;
  }

  function recordVocabularyReviewCard(cardId, cardData) {
    const current = loadLocal();
    const nextProgress = progressMutations.recordVocabularyReviewCard(current, cardId, cardData, {
      now: Date.now()
    });
    if (!nextProgress) return false;
    return saveProgress(nextProgress, normalizeProgress(current));
  }

  function recordTopicResult(result) {
    const current = loadLocal();
    const previousProgress = normalizeProgress(current);
    const now = Date.now();
    const nextProgress = progressMutations.recordTopicResult(current, result, {
      dateKey: localDateKey(new Date(now)),
      now
    });
    return nextProgress ? saveProgress(nextProgress, previousProgress) : false;
  }

  function renderProfile() {
    if (!document.getElementById('profile-container')) return;
    const progress = loadLocal();
    importExistingNumbers(progress);
    profileRenderer.render(progress, window.TOPICS_DATA || {});
  }

  async function refreshProfile() {
    renderProfile();
    if (canUseCloud()) {
      await syncFromCloud(true);
    } else {
      setSyncState('local');
    }
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

    window.addEventListener('online', () => {
      if (canUseCloud()) syncFromCloud(true, true);
    });
  }

  window.EnglishNextLevelProgress = {
    recordNumbersBest,
    recordWordsResult,
    recordVocabularyReviewItems,
    recordVocabularyReviewCard,
    recordTopicResult,
    refreshProfile,
    getProgress() {
      return normalizeProgress(loadLocal());
    },
    getVocabularyReviewCards() {
      const cards = normalizeProgress(loadLocal()).vocabularyReviews.cards;
      return Object.entries(cards).map(([id, card]) => ({ id, ...card }));
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
