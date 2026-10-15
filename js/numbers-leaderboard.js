(function (root) {
    function create({ document = root.document, logger = root.console, debug = message => root.enlDebug?.(message) } = {}) {
        function escapeHtml(text) {
            const element = document.createElement('div');
            element.textContent = text;
            return element.innerHTML;
        }

        function readLocalLeaderboardResult(gameMode) {
            const storage = root.EnglishNextLevelLeaderboardStorage;
            if (!storage) {
                logger.error('LEADERBOARD: local storage module is unavailable.');
                return { scores: [], ok: false };
            }
            return storage.readLocalLeaderboardResult(gameMode);
        }

        function saveToLocalLeaderboard(gameMode, score, playerName) {
            const storage = root.EnglishNextLevelLeaderboardStorage;
            if (!storage) {
                logger.error('LEADERBOARD: local storage module is unavailable.');
                return false;
            }
            return storage.saveLocalLeaderboard(gameMode, score, playerName);
        }

        async function saveToLeaderboard(gameMode, score, playerName, runId = null) {
            const client = root.EnglishNextLevelLeaderboardClient;
            if (!client) {
                logger.error('LEADERBOARD: save client module is unavailable.');
                return { saved: false, destination: 'none' };
            }

            debug(`🏆 Saving to leaderboard: ${playerName} - ${score} points in ${gameMode}`);

            const numbersRunClient = root.EnglishNextLevelNumbersRunClient;
            const saveToCloud = runId && numbersRunClient?.canSubmitGlobally()
                ? async () => numbersRunClient.submitScore(runId)
                : null;

            return client.saveLeaderboardScore(gameMode, score, playerName, {
                saveToCloud,
                cloudDestination: ['test', 'qa'].includes(root.enlFirebaseEnvironment)
                    ? root.enlFirebaseEnvironment
                    : 'global',
                saveLocally: saveToLocalLeaderboard,
                logger
            });
        }

        async function showModal() {
            const dialogModule = root.EnglishNextLevelLeaderboardDialog;
            if (!dialogModule) {
                logger.error('LEADERBOARD: dialog module is unavailable.');
                return;
            }

            const dialog = dialogModule.create({
                document,
                client: root.EnglishNextLevelLeaderboardClient,
                readLocalScores: readLocalLeaderboardResult,
                focusTrap: root.EnlKeyboardAccessibility,
                environment: root.enlFirebaseEnvironment,
                isCloudConfigured: () => typeof root.firebase !== 'undefined' && Boolean(root.firebase.firestore),
                getFirestore: () => root.firebase.firestore(),
                logger,
                debug
            });
            await dialog.open();
        }

        return Object.freeze({ escapeHtml, saveToLeaderboard, showModal });
    }

    root.EnglishNextLevelNumbersLeaderboard = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
