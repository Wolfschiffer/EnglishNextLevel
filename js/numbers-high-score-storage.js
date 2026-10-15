// Local storage helpers for per-mode Numbers high scores.

window.EnglishNextLevelNumbersHighScoreStorage = (() => {
    function createEmptyScores(modeIds) {
        return Object.fromEntries(modeIds.map(modeId => [modeId, 0]));
    }

    function loadScores(getStorage, storageKey, modeIds, logger = console) {
        const scores = createEmptyScores(modeIds);
        try {
            const storage = typeof getStorage === 'function' ? getStorage() : getStorage;
            const stored = JSON.parse(storage.getItem(storageKey) || '{}');
            modeIds.forEach(modeId => {
                scores[modeId] = Math.max(0, Math.floor(Number(stored?.[modeId]) || 0));
            });
        } catch (error) {
            logger?.warn?.('NUMBERS: could not load saved Best Scores.', error);
        }
        return scores;
    }

    function saveScores(getStorage, storageKey, scores, logger = console) {
        try {
            const storage = typeof getStorage === 'function' ? getStorage() : getStorage;
            storage.setItem(storageKey, JSON.stringify(scores));
            return true;
        } catch (error) {
            logger?.warn?.('NUMBERS: could not save Best Scores.', error);
            return false;
        }
    }

    return Object.freeze({ createEmptyScores, loadScores, saveScores });
})();
