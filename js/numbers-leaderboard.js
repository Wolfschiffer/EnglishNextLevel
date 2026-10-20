(function (root) {
    function create({ document = root.document, logger = root.console, debug = message => root.enlDebug?.(message) } = {}) {
        let activeDialog = null;
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

            activeDialog?.close?.({ restoreFocus: false });

            const dialog = dialogModule.create({
                document,
                client: root.EnglishNextLevelLeaderboardClient,
                readLocalScores: readLocalLeaderboardResult,
                focusTrap: root.EnlKeyboardAccessibility,
                environment: root.enlFirebaseEnvironment,
                isCloudConfigured: () => !root.enlFirebaseUnavailable
                    && typeof root.firebase !== 'undefined'
                    && Boolean(root.firebase.firestore),
                getFirestore: () => root.firebase.firestore(),
                logger,
                debug
            });
            activeDialog = dialog;
            await dialog.open();
        }

        function closeModal(options) {
            const dialog = activeDialog;
            activeDialog = null;
            return dialog?.close?.(options) || false;
        }

        return Object.freeze({ escapeHtml, saveToLeaderboard, showModal, closeModal });
    }

    root.EnglishNextLevelNumbersLeaderboard = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
