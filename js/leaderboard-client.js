((root, factory) => {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelLeaderboardClient = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, (root) => {
    function getLeaderboardScopeTitle(environment) {
        if (environment === 'qa') return 'QA Leaderboards';
        if (environment === 'test') return 'Test Leaderboards';
        return 'Global Leaderboards';
    }

    function createLatestRequestTracker() {
        let latestRequest = 0;

        return {
            begin() {
                latestRequest += 1;
                return latestRequest;
            },
            isCurrent(requestId) {
                return requestId === latestRequest;
            }
        };
    }

    function isServerBackedLeaderboardSnapshot(snapshot) {
        return snapshot?.metadata?.fromCache !== true;
    }

    function getLeaderboardReadFeedback({
        cloudConfigured,
        cloudReadFailed,
        localStorageReadFailed,
        hasScores
    }) {
        if (cloudConfigured && cloudReadFailed) {
            if (localStorageReadFailed) {
                return {
                    type: 'unavailable',
                    title: 'Scores are unavailable',
                    message: 'Shared scores could not be loaded, and scores saved on this device could not be read.',
                    retry: true
                };
            }

            if (hasScores) {
                return {
                    type: 'local-fallback',
                    title: 'Device-only scores',
                    message: 'Showing scores saved on this device. Shared scores could not be loaded.',
                    retry: true
                };
            }

            return {
                type: 'cloud-error',
                title: 'Shared scores are unavailable',
                message: 'We could not load the shared leaderboard. Check your connection and try again.',
                retry: true
            };
        }

        if (localStorageReadFailed) {
            return {
                type: 'unavailable',
                title: 'Scores are unavailable',
                message: 'Scores saved on this device could not be read.',
                retry: false
            };
        }

        if (!cloudConfigured) {
            return hasScores
                ? {
                    type: 'local',
                    title: 'Device-only scores',
                    message: 'These scores are saved on this device and are not shared.',
                    retry: false
                }
                : {
                    type: 'local-empty',
                    title: 'No scores saved on this device',
                    message: 'Play a Numbers mode to save a score here.',
                    retry: false
                };
        }

        return hasScores
            ? { type: 'global', title: '', message: '', retry: false }
            : { type: 'global-empty', title: '', message: '', retry: false };
    }

    async function saveLeaderboardScore(gameMode, score, playerName, dependencies = {}) {
        const numericScore = Number(score);
        const normalizedName = typeof playerName === 'string' ? playerName.trim() : '';
        const { saveToCloud, saveLocally, logger = root.console } = dependencies;
        const cloudDestination = ['test', 'qa'].includes(dependencies.cloudDestination)
            ? dependencies.cloudDestination
            : 'global';

        if (!gameMode || !normalizedName || !Number.isFinite(numericScore) || numericScore < 0) {
            return { saved: false, destination: 'none' };
        }

        if (typeof saveToCloud === 'function') {
            try {
                const cloudResult = await saveToCloud(gameMode, numericScore, normalizedName);
                return {
                    saved: cloudResult?.saved !== false,
                    improved: cloudResult?.improved !== false,
                    destination: cloudDestination,
                    playerName: typeof cloudResult?.name === 'string' && cloudResult.name.trim()
                        ? cloudResult.name.trim()
                        : normalizedName
                };
            } catch (error) {
                logger?.error?.('LEADERBOARD: could not save score online.', error);
            }
        }

        try {
            const saved = typeof saveLocally === 'function'
                ? await saveLocally(gameMode, numericScore, normalizedName)
                : false;
            return saved
                ? { saved: true, improved: true, destination: 'local', playerName: normalizedName }
                : { saved: false, destination: 'none' };
        } catch (error) {
            logger?.error?.('LEADERBOARD: could not save score on this device.', error);
            return { saved: false, destination: 'none' };
        }
    }

    function getSuccessfulSaveFeedback(destination, playerName, improved = true) {
        const name = typeof playerName === 'string' ? playerName : '';

        if (improved === false && ['global', 'test', 'qa'].includes(destination)) {
            const where = destination === 'test'
                ? 'test leaderboard'
                : destination === 'qa' ? 'QA leaderboard' : 'online leaderboard';
            return {
                buttonText: 'Best score kept',
                statusText: `Your score did not beat the existing ${where} record for ${name}; the previous best remains.`
            };
        }

        if (destination === 'local') {
            return {
                buttonText: 'Saved on this device',
                statusText: `Score saved on this device as ${name}. We could not confirm whether it was added to the shared leaderboard.`
            };
        }

        if (destination === 'test') {
            return {
                buttonText: 'Saved in test mode',
                statusText: `Score saved to the local Firebase test environment as ${name}. It will not appear on the online leaderboard.`
            };
        }

        if (destination === 'qa') {
            return {
                buttonText: 'Saved in QA',
                statusText: `Score saved to the separate QA Firebase project as ${name}. It will not appear on the production leaderboard.`
            };
        }

        return {
            buttonText: 'Saved',
            statusText: `Score saved online as ${name}.`
        };
    }

    return {
        createLatestRequestTracker,
        getLeaderboardScopeTitle,
        getLeaderboardReadFeedback,
        isServerBackedLeaderboardSnapshot,
        saveLeaderboardScore,
        getSuccessfulSaveFeedback
    };
});
