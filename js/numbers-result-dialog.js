((root, factory) => {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelNumbersResultDialog = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, (root) => {
    function create(dependencies = {}) {
        const document = dependencies.document || root.document;
        const escapeHtml = dependencies.escapeHtml || ((text) => {
            const element = document.createElement('div');
            element.textContent = text;
            return element.innerHTML;
        });
        const formatTime = dependencies.formatTime || ((seconds) => String(seconds));
        const formatScore = dependencies.formatScore || ((score) => String(score));
        const getPlayerName = dependencies.getPlayerName || (() => '');
        const getCurrentGame = dependencies.getCurrentGame || (() => 'numbers');
        const saveToLeaderboard = dependencies.saveToLeaderboard || (async () => ({ saved: false }));
        const client = dependencies.client || root.EnglishNextLevelLeaderboardClient;
        const onRestart = dependencies.onRestart || (() => {});
        const onBack = dependencies.onBack || (() => {});
        const removeWinScreen = dependencies.removeWinScreen || (() => {});
        const removeRestartButton = dependencies.removeRestartButton || (() => {});
        const logger = dependencies.logger || root.console;

        function remove() {
            document.querySelector('.numbers-result-modal')?.remove();
        }

        function show(result, options = {}) {
            if (!result) return;

            remove();
            removeWinScreen();
            removeRestartButton();

            const won = options.won !== false;
            const modal = document.createElement('div');
            modal.className = 'numbers-result-modal';

            const speedBonus = Number(result.speedBonus || 1).toFixed(1);
            const lifeBonus = Number(result.lifeBonus || 1).toFixed(1);
            const defaultName = escapeHtml(getPlayerName());
            const modeForLeaderboard = result.completedMode || getCurrentGame();
            const leaderboardRunId = result.leaderboardRunId || null;

            modal.innerHTML = `
                <div class="numbers-result-card" role="dialog" aria-modal="true" aria-labelledby="numbers-result-title">
                    <div class="numbers-result-heading">
                        <span class="numbers-result-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" focusable="false">
                                <path d="M7 3h10v2h3a1 1 0 0 1 1 1v2a5 5 0 0 1-4 4.9A6 6 0 0 1 13 17.9V20h4v2H7v-2h4v-2.1A6 6 0 0 1 7 12.9A5 5 0 0 1 3 8V6a1 1 0 0 1 1-1h3V3Zm0 4H5v1a3 3 0 0 0 2 2.82V7Zm10 0v3.82A3 3 0 0 0 19 8V7h-2Z"/>
                            </svg>
                        </span>
                        <div>
                            <span class="numbers-result-eyebrow">${won ? 'Round complete' : 'Round ended'}</span>
                            <h2 id="numbers-result-title">${won ? 'Excellent work' : 'Game Over'}</h2>
                            <p>${won ? 'Your final score includes your speed and remaining-lives bonuses.' : 'Review your score and try again when you are ready.'}</p>
                        </div>
                    </div>

                    ${won && result.isNewBest ? '<div class="numbers-result-best">New Best Score</div>' : ''}

                    <div class="numbers-result-breakdown">
                        <div class="numbers-result-stat">
                            <span>Base Score</span>
                            <strong>${formatScore(result.baseScore)}</strong>
                        </div>
                        <div class="numbers-result-stat">
                            <span>Speed Bonus</span>
                            <strong>×${speedBonus}</strong>
                        </div>
                        <div class="numbers-result-stat">
                            <span>Lives Bonus</span>
                            <strong>×${lifeBonus}</strong>
                        </div>
                        <div class="numbers-result-stat">
                            <span>Time</span>
                            <strong>${formatTime(result.totalGameTime)}</strong>
                        </div>
                    </div>

                    <div class="numbers-result-final">
                        <span>Final Score</span>
                        <strong>${formatScore(result.finalScore)}</strong>
                    </div>

                    ${won ? `
                        <div class="numbers-result-leaderboard">
                            <div class="numbers-result-leaderboard-copy">
                                <strong>${leaderboardRunId ? 'Global Leaderboard' : 'Device-only score'}</strong>
                                <span>${leaderboardRunId
                                    ? 'This verified run can be added to the global leaderboard using your account profile. If online saving fails, you can keep a device-only copy.'
                                    : 'This run was not verified for global scores. You can save it on this device; sign in with a verified email to submit a global score.'}</span>
                            </div>
                            <div class="numbers-result-save-row">
                                <input id="numbers-result-name" class="numbers-result-name" type="text" maxlength="20" autocomplete="name" placeholder="Your name" value="${defaultName}">
                                <button id="numbers-result-save" class="numbers-result-save" type="button">Save Score</button>
                            </div>
                            <div id="numbers-result-save-status" class="numbers-result-save-status" aria-live="polite"></div>
                        </div>
                    ` : ''}

                    <div class="numbers-result-actions">
                        <button id="numbers-result-restart" class="numbers-result-action primary" type="button">Play Again</button>
                        <button id="numbers-result-menu" class="numbers-result-action secondary" type="button">Back to Menu</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const restartButton = modal.querySelector('#numbers-result-restart');
            const menuButton = modal.querySelector('#numbers-result-menu');

            restartButton?.addEventListener('click', () => {
                remove();
                onRestart();
            });

            menuButton?.addEventListener('click', () => {
                remove();
                onBack();
            });

            if (won) {
                const nameInput = modal.querySelector('#numbers-result-name');
                const saveButton = modal.querySelector('#numbers-result-save');
                const saveStatus = modal.querySelector('#numbers-result-save-status');

                const submitScore = async () => {
                    if (!saveButton || saveButton.disabled) return;
                    const typedName = String(nameInput?.value || '').trim();
                    const finalName = typedName || 'Anonymous';

                    saveButton.disabled = true;
                    saveButton.textContent = 'Saving...';

                    let saveResult = { saved: false, destination: 'none' };
                    try {
                        saveResult = await saveToLeaderboard(
                            modeForLeaderboard,
                            result.finalScore,
                            finalName,
                            leaderboardRunId
                        );
                    } catch (error) {
                        logger?.error?.('LEADERBOARD: could not save score.', error);
                    }

                    if (!saveResult.saved) {
                        saveButton.disabled = false;
                        saveButton.textContent = 'Try Again';
                        if (saveStatus) {
                            saveStatus.textContent = 'Could not save your score. Check your connection or local storage, then try again.';
                        }
                        return;
                    }

                    if (nameInput) nameInput.disabled = true;
                    const feedback = client.getSuccessfulSaveFeedback(
                        saveResult.destination,
                        saveResult.playerName || finalName,
                        saveResult.improved
                    );
                    saveButton.textContent = feedback.buttonText;
                    if (saveStatus) saveStatus.textContent = feedback.statusText;
                };

                saveButton?.addEventListener('click', submitScore);
                nameInput?.addEventListener('keydown', event => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        submitScore();
                    }
                });
            }
        }

        return { remove, show };
    }

    return { create };
});
