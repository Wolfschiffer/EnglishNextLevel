// FSRS scheduling for vocabulary cards, kept separate from the matching game.
(function (root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.EnglishNextLevelSpacedReview = api;

    if (root?.document) {
        const initialize = () => api.initialize(root.document);
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', initialize, { once: true });
        } else {
            initialize();
        }
    }
})(typeof window !== 'undefined' ? window : globalThis, (root) => {
    const MAX_SESSION_SIZE = 20;
    const RATING_KEYS = ['Again', 'Hard', 'Good', 'Easy'];

    function toTimestamp(value) {
        if (value instanceof Date) return value.getTime();
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    function restoreFsrsCard(card) {
        if (!card || typeof card !== 'object') return null;
        return {
            due: new Date(toTimestamp(card.due)),
            stability: Number(card.stability) || 0,
            difficulty: Number(card.difficulty) || 0,
            elapsed_days: Number(card.elapsed_days) || 0,
            scheduled_days: Number(card.scheduled_days) || 0,
            reps: Number(card.reps) || 0,
            lapses: Number(card.lapses) || 0,
            learning_steps: Number(card.learning_steps) || 0,
            state: Number(card.state) || 0,
            last_review: card.last_review ? new Date(toTimestamp(card.last_review)) : undefined
        };
    }

    function serializeFsrsCard(card, reviewedAt) {
        return {
            due: toTimestamp(card.due),
            stability: Number(card.stability) || 0,
            difficulty: Number(card.difficulty) || 0,
            elapsed_days: Number(card.elapsed_days) || 0,
            scheduled_days: Number(card.scheduled_days) || 0,
            reps: Number(card.reps) || 0,
            lapses: Number(card.lapses) || 0,
            learning_steps: Number(card.learning_steps) || 0,
            state: Number(card.state) || 0,
            last_review: card.last_review ? toTimestamp(card.last_review) : null,
            updatedAt: reviewedAt.getTime()
        };
    }

    function createReviewManager({ fsrsLibrary, progress, now = () => new Date() } = {}) {
        const library = fsrsLibrary || root.FSRS;
        const progressApi = typeof progress === 'function' ? progress : () => progress || root.EnglishNextLevelProgress;
        const scheduler = typeof library?.fsrs === 'function'
            ? library.fsrs({ enable_fuzz: false })
            : null;

        function getCards() {
            return progressApi()?.getVocabularyReviewCards?.() || [];
        }

        function getDueCards(limit = MAX_SESSION_SIZE) {
            const nowMs = now().getTime();
            return getCards()
                .filter((card) => card.due <= nowMs)
                .sort((left, right) => left.due - right.due)
                .slice(0, limit);
        }

        function trackCompletedSet(set) {
            return progressApi()?.recordVocabularyReviewItems?.(set) || 0;
        }

        function recordReview(cardId, ratingKey) {
            if (!scheduler || !RATING_KEYS.includes(ratingKey)) return null;
            const source = getCards().find((card) => card.id === cardId);
            const rating = library.Rating?.[ratingKey];
            if (!source || !Number.isFinite(Number(rating))) return null;

            const reviewedAt = now();
            const result = scheduler.next(restoreFsrsCard(source), reviewedAt, rating);
            const saved = progressApi()?.recordVocabularyReviewCard?.(cardId, {
                ...source,
                ...serializeFsrsCard(result.card, reviewedAt)
            });
            return saved ? { card: result.card, log: result.log, rating: ratingKey } : null;
        }

        return {
            available: Boolean(scheduler && library?.createEmptyCard && library?.Rating),
            getCards,
            getDueCards,
            trackCompletedSet,
            recordReview
        };
    }

    function initialize(document) {
        const openButton = document.getElementById('spaced-review-open-btn');
        const closeButton = document.getElementById('spaced-review-close-btn');
        const panel = document.getElementById('spaced-review-panel');
        if (!openButton || !closeButton || !panel) return null;

        const manager = createReviewManager({ progress: () => root.EnglishNextLevelProgress });
        root.EnglishNextLevelSpacedReviewManager = manager;
        const dueCount = document.getElementById('spaced-review-due-count');
        const status = document.getElementById('spaced-review-status');
        const emptyMessage = document.getElementById('spaced-review-empty');
        const cardView = document.getElementById('spaced-review-card');
        const questionLabel = document.getElementById('spaced-review-question-label');
        const question = document.getElementById('spaced-review-question');
        const answer = document.getElementById('spaced-review-answer');
        const revealButton = document.getElementById('spaced-review-reveal-btn');
        const ratings = document.getElementById('spaced-review-ratings');
        let reviewedThisSession = 0;
        let currentCard = null;
        let reviewedCardCounts = new Map();

        function getDueCount() {
            return manager.getDueCards(Number.MAX_SAFE_INTEGER).length;
        }

        function updateDueCount() {
            const count = getDueCount();
            if (dueCount) dueCount.textContent = `${count} due`;
            return count;
        }

        function hideCurrentCard() {
            currentCard = null;
            if (cardView) cardView.hidden = true;
            if (answer) answer.hidden = true;
            if (revealButton) revealButton.hidden = true;
            if (ratings) ratings.hidden = true;
        }

        function renderCurrentCard({ restoreFocus = false } = {}) {
            const dueCards = manager.getDueCards(MAX_SESSION_SIZE);
            updateDueCount();

            if (!manager.available) {
                hideCurrentCard();
                if (emptyMessage) {
                    emptyMessage.hidden = false;
                    emptyMessage.textContent = 'The review scheduler could not load. Connect to the internet and reload the page.';
                }
                if (status) status.textContent = 'Spaced review is unavailable right now.';
                if (restoreFocus) status?.focus();
                return;
            }

            if (!dueCards.length) {
                hideCurrentCard();
                if (emptyMessage) {
                    emptyMessage.hidden = false;
                    emptyMessage.textContent = reviewedThisSession
                        ? 'You are all caught up. Come back when more words are due.'
                        : 'Complete a Words set to add its verbs to your review queue.';
                }
                if (status) status.textContent = reviewedThisSession
                    ? `${reviewedThisSession} reviewed this session.`
                    : 'No words are due yet.';
                if (restoreFocus) status?.focus();
                return;
            }

            currentCard = dueCards[0];
            if (emptyMessage) emptyMessage.hidden = true;
            if (cardView) cardView.hidden = false;
            if (questionLabel) questionLabel.textContent = currentCard.mode === 'past'
                ? 'What is the simple past of this verb?'
                : 'What does this verb mean?';
            if (question) question.textContent = currentCard.front;
            if (answer) {
                answer.textContent = currentCard.back;
                answer.hidden = true;
            }
            if (revealButton) revealButton.hidden = false;
            if (ratings) ratings.hidden = true;
            if (status) status.textContent = `${Math.min(reviewedThisSession + 1, MAX_SESSION_SIZE)} of up to ${MAX_SESSION_SIZE} words in this review.`;
            if (restoreFocus) revealButton?.focus();
        }

        function closePanel({ restoreFocus = true } = {}) {
            panel.hidden = true;
            openButton.hidden = false;
            openButton.setAttribute('aria-expanded', 'false');
            if (restoreFocus) openButton.focus();
        }

        openButton.addEventListener('click', () => {
            reviewedThisSession = 0;
            reviewedCardCounts = new Map();
            openButton.hidden = true;
            openButton.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
            renderCurrentCard();
            closeButton.focus();
        });
        closeButton.addEventListener('click', closePanel);
        panel.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closePanel();
        });
        revealButton?.addEventListener('click', () => {
            if (!currentCard || !answer) return;
            answer.hidden = false;
            if (revealButton) revealButton.hidden = true;
            if (ratings) ratings.hidden = false;
            document.querySelector('#spaced-review-ratings button')?.focus();
        });
        ratings?.querySelectorAll('button[data-rating]').forEach((button) => {
            button.addEventListener('click', () => {
                if (!currentCard) return;
                const result = manager.recordReview(currentCard.id, button.dataset.rating);
                if (!result) {
                    if (status) status.textContent = 'The review could not be saved. Try again.';
                    return;
                }
                reviewedThisSession += 1;
                reviewedCardCounts.set(currentCard.id, (reviewedCardCounts.get(currentCard.id) || 0) + 1);
                renderCurrentCard({ restoreFocus: true });
            });
        });

        updateDueCount();
        manager.closePanel = closePanel;
        manager.refresh = ({ rollback = false, beforeCards = {}, restoredCards = {} } = {}) => {
            updateDueCount();
            if (rollback) {
                let revertedReviews = 0;
                for (const [cardId, reviewCount] of reviewedCardCounts) {
                    const beforeReps = Math.max(0, Number(beforeCards[cardId]?.reps) || 0);
                    const restoredReps = Math.max(0, Number(restoredCards[cardId]?.reps) || 0);
                    const lostReviews = Math.min(reviewCount, Math.max(0, beforeReps - restoredReps));
                    if (lostReviews) {
                        revertedReviews += lostReviews;
                        const remainingReviews = reviewCount - lostReviews;
                        if (remainingReviews) reviewedCardCounts.set(cardId, remainingReviews);
                        else reviewedCardCounts.delete(cardId);
                    }
                }
                reviewedThisSession = Math.max(0, reviewedThisSession - revertedReviews);
            }
            if (!panel.hidden) renderCurrentCard();
        };
        return manager;
    }

    function trackCompletedSet(set) {
        const manager = root.EnglishNextLevelSpacedReviewManager;
        if (!manager) return 0;
        const added = manager.trackCompletedSet(set);
        const count = manager.getDueCards(Number.MAX_SAFE_INTEGER).length;
        const dueCount = root.document.getElementById('spaced-review-due-count');
        if (dueCount) dueCount.textContent = `${count} due`;
        return added;
    }

    return {
        MAX_SESSION_SIZE,
        createReviewManager,
        initialize,
        restoreFsrsCard,
        serializeFsrsCard,
        trackCompletedSet,
        toTimestamp
    };
});
