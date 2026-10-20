// Select and cache the Numbers high scores for the active account profile.

window.EnglishNextLevelNumbersHighScoreProfile = (() => {
    function create({ prefix, modeIds, getProfile, getStorage, storage, logger = console }) {
        let loadedStorageKey = null;
        let loadedScores = null;

        function getStorageKey() {
            const profile = typeof getProfile === 'function' ? getProfile() : {};
            if (!profile?.isGuest && profile?.uid) {
                return `${prefix}.user.${profile.uid}`;
            }
            if (profile?.isGuest) {
                return `${prefix}.guest`;
            }
            return `${prefix}.local`;
        }

        function loadForKey(storageKey) {
            return storage.loadScores(getStorage, storageKey, modeIds, logger);
        }

        function loadCurrent(force = false) {
            const storageKey = getStorageKey();
            if (!force && loadedStorageKey === storageKey) return loadedScores;

            loadedScores = loadForKey(storageKey);
            loadedStorageKey = storageKey;
            return loadedScores;
        }

        function saveForKey(storageKey, gameMode, finalScoreCandidate) {
            if (!modeIds.includes(gameMode) || !Number.isFinite(finalScoreCandidate)) return false;

            const profileScores = loadForKey(storageKey);
            const nextBest = Math.max(0, Math.floor(finalScoreCandidate));
            if (nextBest <= (profileScores[gameMode] || 0)) return true;

            profileScores[gameMode] = nextBest;
            return storage.saveScores(getStorage, storageKey, profileScores, logger);
        }

        function saveCurrent(scores) {
            const storageKey = getStorageKey();
            loadedStorageKey = storageKey;
            loadedScores = scores;
            return storage.saveScores(getStorage, storageKey, scores, logger);
        }

        function setCurrentScores(scores) {
            loadedStorageKey = getStorageKey();
            loadedScores = scores;
            return loadedScores;
        }

        return Object.freeze({ getStorageKey, loadCurrent, loadForKey, saveForKey, saveCurrent, setCurrentScores });
    }

    return Object.freeze({ create });
})();
