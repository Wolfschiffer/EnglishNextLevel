((root, factory) => {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelLeaderboardDialog = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, (root) => {
    function create(dependencies = {}) {
        const document = dependencies.document || root.document;
        const client = dependencies.client || root.EnglishNextLevelLeaderboardClient;
        const readLocalScores = dependencies.readLocalScores
            || ((modeId) => root.EnglishNextLevelLeaderboardStorage?.readLocalLeaderboardResult(modeId)
                || { scores: [], ok: false });
        const isCloudConfigured = dependencies.isCloudConfigured
            || (() => Boolean(root.firebase?.firestore));
        const getFirestore = dependencies.getFirestore
            || (() => root.firebase.firestore());
        const focusTrap = dependencies.focusTrap || root.EnlKeyboardAccessibility;
        const environment = dependencies.environment ?? root.enlFirebaseEnvironment;
        const logger = dependencies.logger || root.console;
        const debug = dependencies.debug || ((message) => root.enlDebug?.(message));

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        async function open() {
            const existingModal = document.querySelector('.leaderboard-modal');
            if (existingModal) existingModal.remove();

            const previouslyFocusedElement = document.activeElement;
            const leaderboardScopeTitle = client?.getLeaderboardScopeTitle(environment)
                || 'Global Leaderboards';
            const modal = document.createElement('div');
            modal.className = 'leaderboard-modal';
            modal.innerHTML = `
                <div class="leaderboard-content" role="dialog" aria-modal="true" aria-labelledby="leaderboard-dialog-title">
                    <div class="leaderboard-header">
                        <div class="leaderboard-heading">
                            <div class="leaderboard-kicker">
                                <span class="leaderboard-kicker-badge" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" focusable="false"><path d="M7 3h10v2h3a1 1 0 0 1 1 1v2a5 5 0 0 1-4 4.9A6 6 0 0 1 13 17.9V20h4v2H7v-2h4v-2.1A6 6 0 0 1 7 12.9A5 5 0 0 1 3 8V6a1 1 0 0 1 1-1h3V3Zm0 4H5v1a3 3 0 0 0 2 2.82V7Zm10 0v3.82A3 3 0 0 0 19 8V7h-2Z"/></svg>
                                </span>
                                <span>${leaderboardScopeTitle}</span>
                            </div>
                            <h2 id="leaderboard-dialog-title">${leaderboardScopeTitle}</h2>
                            <p>Track the best scores for each Numbers mode.</p>
                        </div>
                        <button class="close-modal" type="button" aria-label="Close ${leaderboardScopeTitle.toLowerCase()}"></button>
                    </div>
                    <div class="leaderboard-tabs-wrap">
                        <div class="leaderboard-tabs" id="leaderboard-tabs" role="tablist" aria-label="Numbers modes"></div>
                    </div>
                    <div class="leaderboard-panel">
                        <div class="leaderboard-panel-header">
                            <div>
                                <span class="leaderboard-panel-label">Showing leaderboard for</span>
                                <strong id="leaderboard-mode-label">1–10</strong>
                            </div>
                            <span class="leaderboard-panel-note">Top 20 scores</span>
                        </div>
                        <div id="leaderboard-list" class="leaderboard-list">
                            <div class="leaderboard-empty" role="status">Loading...</div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const trophyEmptyIcon = `<span class="leaderboard-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M7 3h10v2h3a1 1 0 0 1 1 1v2a5 5 0 0 1-4 4.9A6 6 0 0 1 13 17.9V20h4v2H7v-2h4v-2.1A6 6 0 0 1 7 12.9A5 5 0 0 1 3 8V6a1 1 0 0 1 1-1h3V3Zm0 4H5v1a3 3 0 0 0 2 2.82V7Zm10 0v3.82A3 3 0 0 0 19 8V7h-2Z"/></svg></span>`;
            const gameModes = [
                { id: 'numbers', name: '1–10' },
                { id: 'numbers11-20', name: '11–20' },
                { id: 'tens', name: 'Tens' },
                { id: 'random21_99', name: '21–99' },
                { id: 'hundreds', name: '100s' },
                { id: 'random101_999', name: '101–999' },
                { id: 'thousands', name: '1,000s' },
                { id: 'random1001_9999', name: '1K–9K' },
                { id: 'mixedAdvanced', name: 'Mixed' }
            ];
            const modeMap = Object.fromEntries(gameModes.map(mode => [mode.id, mode.name]));
            const requestTracker = client.createLatestRequestTracker();
            let selectedModeId = gameModes[0].id;

            const tabsContainer = modal.querySelector('#leaderboard-tabs');

            gameModes.forEach((mode, index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tab-btn' + (index === 0 ? ' active' : '');
                btn.textContent = mode.name;
                btn.dataset.mode = mode.id;
                btn.setAttribute('role', 'tab');
                btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
                btn.onclick = () => {
                    selectedModeId = mode.id;
                    modal.querySelectorAll('.tab-btn').forEach(tab => {
                        tab.classList.remove('active');
                        tab.setAttribute('aria-selected', 'false');
                    });
                    btn.classList.add('active');
                    btn.setAttribute('aria-selected', 'true');
                    loadLeaderboardForMode(mode.id);
                };
                tabsContainer.appendChild(btn);
            });

            async function loadLeaderboardForMode(modeId) {
                const requestId = requestTracker.begin();
                const isCurrentRequest = () => modal.isConnected && requestTracker.isCurrent(requestId);
                const listContainer = modal.querySelector('#leaderboard-list');
                const modeLabel = modal.querySelector('#leaderboard-mode-label');
                modeLabel.textContent = modeMap[modeId] || modeId;
                listContainer.innerHTML = '<div class="leaderboard-empty" role="status">Loading...</div>';

                let scores = [];
                let localStorageReadFailed = false;
                const cloudConfigured = Boolean(isCloudConfigured());
                let cloudReadFailed = false;
                const useLocalScores = () => {
                    const result = readLocalScores(modeId);
                    scores = result.scores;
                    localStorageReadFailed = !result.ok;
                };

                if (cloudConfigured) {
                    try {
                        const db = getFirestore();
                        const snapshot = await db.collection('leaderboards').doc(modeId).collection('scores')
                            .orderBy('score', 'desc')
                            .limit(20)
                            .get();
                        if (!isCurrentRequest()) return;
                        if (client.isServerBackedLeaderboardSnapshot(snapshot)) {
                            snapshot.forEach(doc => scores.push(doc.data()));
                            debug(`✅ Loaded ${scores.length} scores from Firebase for ${modeId}`);
                        } else {
                            cloudReadFailed = true;
                            useLocalScores();
                            debug(`⚠️ Firebase returned cached leaderboard data for ${modeId}; using device scores instead.`);
                        }
                    } catch (error) {
                        if (!isCurrentRequest()) return;
                        logger?.error?.('❌ Error loading from Firebase:', error);
                        cloudReadFailed = true;
                        useLocalScores();
                    }
                } else {
                    useLocalScores();
                }

                if (!isCurrentRequest()) return;

                const readFeedback = client.getLeaderboardReadFeedback({
                    cloudConfigured,
                    cloudReadFailed,
                    localStorageReadFailed,
                    hasScores: scores.length > 0
                });

                if (scores.length === 0) {
                    const title = readFeedback.type === 'global-empty'
                        ? `No scores yet for ${escapeHtml(modeMap[modeId] || modeId)}`
                        : readFeedback.title;
                    const retryButton = readFeedback.retry
                        ? '<button class="leaderboard-retry-btn" type="button" data-leaderboard-retry>Try again</button>'
                        : '';
                    listContainer.innerHTML = `
                        <div class="leaderboard-empty" role="status">
                            ${trophyEmptyIcon}
                            <h3>${title}</h3>
                            <p>${readFeedback.type === 'global-empty'
                                ? 'Be the first to set a record in this mode.'
                                : escapeHtml(readFeedback.message)}</p>
                            ${retryButton}
                        </div>
                    `;
                    return;
                }

                scores.sort((a, b) => b.score - a.score);
                const sourceNote = ['local', 'local-fallback'].includes(readFeedback.type)
                    ? `<div class="leaderboard-source-note" role="status">${escapeHtml(readFeedback.message)}${readFeedback.retry
                        ? '<button class="leaderboard-retry-btn" type="button" data-leaderboard-retry>Try again</button>'
                        : ''}</div>`
                    : '';
                listContainer.innerHTML = `${sourceNote}
                    <div class="leaderboard-columns" aria-hidden="true">
                        <span>Rank</span>
                        <span>Player</span>
                        <span>Score</span>
                    </div>`;

                scores.slice(0, 20).forEach((score, index) => {
                    const item = document.createElement('div');
                    item.className = `leaderboard-item rank-${Math.min(index + 1, 3)}`;
                    item.innerHTML = `
                        <div class="leaderboard-rank">#${index + 1}</div>
                        <div class="leaderboard-name">${escapeHtml(score.name)}</div>
                        <div class="leaderboard-score">${Number(score.score) || 0}</div>
                    `;
                    listContainer.appendChild(item);
                });
            }

            modal.querySelector('#leaderboard-list').addEventListener('click', event => {
                if (event.target?.closest?.('[data-leaderboard-retry]')) {
                    loadLeaderboardForMode(selectedModeId);
                }
            });

            let releaseFocusTrap = () => {};
            const close = () => {
                releaseFocusTrap();
                modal.remove();
                if (previouslyFocusedElement?.isConnected) previouslyFocusedElement.focus();
            };
            const closeButton = modal.querySelector('.close-modal');
            closeButton.onclick = close;
            modal.addEventListener('click', event => {
                if (event.target === modal) close();
            });
            releaseFocusTrap = focusTrap.trapDialogFocus(
                modal.querySelector('[role="dialog"]'),
                { initialFocus: closeButton, onEscape: close }
            );

            await loadLeaderboardForMode('numbers');
        }

        return { open };
    }

    return { create };
});
