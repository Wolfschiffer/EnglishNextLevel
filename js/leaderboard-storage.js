((root, factory) => {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelLeaderboardStorage = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, (root) => {
    function createLeaderboardStorage(storageProvider = () => root.localStorage, logger = root.console) {
        function loadStoredLeaderboard(gameMode) {
            try {
                const storage = storageProvider();
                const rawStored = storage.getItem(`leaderboard_${gameMode}`);
                const stored = rawStored === null ? [] : JSON.parse(rawStored);
                if (!Array.isArray(stored)) {
                    logger?.warn?.('LEADERBOARD: local scores have an invalid format.');
                    return { scores: [], ok: false };
                }

                const scores = stored.filter((entry) => {
                    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
                    if (typeof entry.name !== 'string' || !entry.name.trim()) return false;
                    if (typeof entry.score !== 'number' && typeof entry.score !== 'string') return false;
                    if (typeof entry.score === 'string' && !entry.score.trim()) return false;

                    const score = Number(entry.score);
                    return Number.isFinite(score) && score >= 0;
                }).map((entry) => ({
                    ...entry,
                    score: Number(entry.score)
                }));
                if (stored.length > 0 && scores.length === 0) {
                    logger?.warn?.('LEADERBOARD: local scores contain no valid entries.');
                    return { scores: [], ok: false };
                }
                return { scores, ok: true };
            } catch (error) {
                logger?.warn?.('LEADERBOARD: could not read local scores.', error);
                return { scores: [], ok: false };
            }
        }

        function readLocalLeaderboard(gameMode) {
            return loadStoredLeaderboard(gameMode).scores;
        }

        function readLocalLeaderboardResult(gameMode) {
            return loadStoredLeaderboard(gameMode);
        }

        function saveLocalLeaderboard(gameMode, score, playerName) {
            const scoreType = typeof score;
            const numericScore = Number(score);
            const normalizedName = typeof playerName === 'string' ? playerName.trim() : '';

            if (!normalizedName || !['number', 'string'].includes(scoreType)) return false;
            if (scoreType === 'string' && !score.trim()) return false;
            if (!Number.isFinite(numericScore) || numericScore < 0) return false;

            const leaderboardKey = `leaderboard_${gameMode}`;
            const stored = loadStoredLeaderboard(gameMode);
            if (!stored.ok) return false;

            const leaderboard = stored.scores;
            leaderboard.push({
                name: normalizedName,
                score: numericScore,
                date: new Date().toISOString()
            });
            leaderboard.sort((a, b) => b.score - a.score);

            try {
                storageProvider().setItem(leaderboardKey, JSON.stringify(leaderboard.slice(0, 50)));
                return true;
            } catch (error) {
                logger?.warn?.('LEADERBOARD: could not save local scores.', error);
                return false;
            }
        }

        return { readLocalLeaderboard, readLocalLeaderboardResult, saveLocalLeaderboard };
    }

    const defaultStorage = createLeaderboardStorage();
    return {
        createLeaderboardStorage,
        readLocalLeaderboard: defaultStorage.readLocalLeaderboard,
        readLocalLeaderboardResult: defaultStorage.readLocalLeaderboardResult,
        saveLocalLeaderboard: defaultStorage.saveLocalLeaderboard
    };
});
