const assert = require('node:assert/strict');
const test = require('node:test');
const reviewApi = require('../js/spaced-review.js');

function makeProgress(cards = []) {
    let storedCards = cards.map((card) => ({ ...card }));
    return {
        getVocabularyReviewCards: () => storedCards.map((card) => ({ ...card })),
        recordVocabularyReviewItems: (set) => set.items.length,
        recordVocabularyReviewCard: (id, update) => {
            storedCards = storedCards.map((card) => card.id === id ? { ...card, ...update } : card);
            return storedCards.some((card) => card.id === id);
        }
    };
}

function makeFsrs() {
    const calls = [];
    const library = {
        Rating: { Again: 1, Hard: 2, Good: 3, Easy: 4 },
        createEmptyCard: () => ({}),
        fsrs: () => ({
            next(card, reviewedAt, rating) {
                calls.push({ card, reviewedAt, rating });
                return {
                    card: {
                        ...card,
                        due: new Date(reviewedAt.getTime() + 60_000),
                        last_review: reviewedAt,
                        reps: card.reps + 1,
                        state: 2
                    },
                    log: { rating }
                };
            }
        })
    };
    return { library, calls };
}

const dueCard = {
    id: 'present:verbs1:0', mode: 'present', setId: 'verbs1',
    front: 'to work', back: 'trabalhar', due: 1_000,
    stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0,
    reps: 0, lapses: 0, learning_steps: 0, state: 0,
    last_review: null, updatedAt: 1_000
};

function makeElement() {
    const listeners = new Map();
    return {
        hidden: true,
        textContent: '',
        dataset: {},
        attributes: {},
        addEventListener(type, callback) {
            const callbacks = listeners.get(type) || [];
            callbacks.push(callback);
            listeners.set(type, callbacks);
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        focus() { this.focused = true; },
        trigger(type, event = {}) { (listeners.get(type) || []).forEach((callback) => callback(event)); },
        querySelectorAll() { return []; }
    };
}

test('review manager lists only due cards and respects its session limit', () => {
    const futureCard = { ...dueCard, id: 'present:verbs1:1', due: 9_000 };
    const progress = makeProgress([futureCard, dueCard]);
    const manager = reviewApi.createReviewManager({
        fsrsLibrary: makeFsrs().library,
        progress,
        now: () => new Date(5_000)
    });

    assert.equal(manager.available, true);
    assert.deepEqual(manager.getDueCards().map((card) => card.id), [dueCard.id]);
    assert.equal(manager.trackCompletedSet({ items: [1, 2] }), 2);
});

test('review ratings schedule the card and persist dates as numbers', () => {
    const { library, calls } = makeFsrs();
    const progress = makeProgress([dueCard]);
    const manager = reviewApi.createReviewManager({
        fsrsLibrary: library,
        progress,
        now: () => new Date(5_000)
    });

    const result = manager.recordReview(dueCard.id, 'Good');
    const [savedCard] = progress.getVocabularyReviewCards();

    assert.equal(result.rating, 'Good');
    assert.equal(calls[0].rating, library.Rating.Good);
    assert.equal(calls[0].reviewedAt.getTime(), 5_000);
    assert.equal(savedCard.due, 65_000);
    assert.equal(savedCard.last_review, 5_000);
    assert.equal(savedCard.reps, 1);
    assert.equal(savedCard.state, 2);
});

test('review manager keeps a failed-to-save card due for another attempt', () => {
    const progress = {
        getVocabularyReviewCards: () => [{ ...dueCard }],
        recordVocabularyReviewCard: () => false
    };
    const manager = reviewApi.createReviewManager({
        fsrsLibrary: makeFsrs().library,
        progress,
        now: () => new Date(5_000)
    });

    assert.equal(manager.recordReview(dueCard.id, 'Good'), null);
    assert.deepEqual(manager.getDueCards().map((card) => card.id), [dueCard.id]);
});

test('review manager safely reports unavailable when the FSRS library is missing', () => {
    const manager = reviewApi.createReviewManager({ progress: makeProgress([dueCard]) });

    assert.equal(manager.available, false);
    assert.equal(manager.recordReview(dueCard.id, 'Good'), null);
    assert.equal(manager.recordReview(dueCard.id, 'unknown'), null);
});

test('FSRS card serialization restores valid Date values', () => {
    const restored = reviewApi.restoreFsrsCard({ ...dueCard, due: 1_000, last_review: 500 });

    assert.ok(restored.due instanceof Date);
    assert.ok(restored.last_review instanceof Date);
    assert.equal(restored.due.getTime(), 1_000);
    assert.equal(restored.last_review.getTime(), 500);
});

test('review panel restores a rolled-back card and session count after cloud failure', () => {
    const elements = new Map([
        'spaced-review-open-btn', 'spaced-review-close-btn', 'spaced-review-panel',
        'spaced-review-due-count', 'spaced-review-status', 'spaced-review-empty',
        'spaced-review-card', 'spaced-review-question-label', 'spaced-review-question',
        'spaced-review-answer', 'spaced-review-reveal-btn', 'spaced-review-ratings'
    ].map((id) => [id, makeElement()]));
    const ratingButton = makeElement();
    ratingButton.dataset.rating = 'Good';
    elements.get('spaced-review-ratings').querySelectorAll = () => [ratingButton];
    const document = {
        getElementById: (id) => elements.get(id) || null,
        querySelector: () => ratingButton
    };
    const previousFsrs = globalThis.FSRS;
    const previousProgress = globalThis.EnglishNextLevelProgress;
    const previousManager = globalThis.EnglishNextLevelSpacedReviewManager;
    let cards = [{ ...dueCard }];
    globalThis.FSRS = makeFsrs().library;
    globalThis.EnglishNextLevelProgress = {
        getVocabularyReviewCards: () => cards.map((card) => ({ ...card })),
        recordVocabularyReviewCard(id, update) {
            cards = cards.map((card) => card.id === id ? { ...card, ...update } : card);
            return cards.some((card) => card.id === id);
        }
    };

    try {
        const manager = reviewApi.initialize(document);
        elements.get('spaced-review-open-btn').trigger('click');
        elements.get('spaced-review-reveal-btn').trigger('click');
        ratingButton.trigger('click');

        assert.equal(elements.get('spaced-review-card').hidden, true);
        assert.equal(elements.get('spaced-review-status').textContent, '1 reviewed this session.');

        cards = cards.map((card) => ({ ...card, due: 1_000 }));
        manager.refresh();
        elements.get('spaced-review-reveal-btn').trigger('click');
        ratingButton.trigger('click');
        assert.equal(elements.get('spaced-review-card').hidden, true);

        const beforeRollbackCards = cards.map((card) => ({ ...card }));
        const restoredCards = [{ ...dueCard }];
        cards = restoredCards;
        manager.refresh({
            rollback: true,
            beforeCards: Object.fromEntries(beforeRollbackCards.map((card) => [card.id, card])),
            restoredCards: Object.fromEntries(restoredCards.map((card) => [card.id, card]))
        });

        assert.equal(elements.get('spaced-review-due-count').textContent, '1 due');
        assert.equal(elements.get('spaced-review-card').hidden, false);
        assert.equal(elements.get('spaced-review-empty').hidden, true);
        assert.equal(elements.get('spaced-review-status').textContent, '1 of up to 20 words in this review.');

        elements.get('spaced-review-reveal-btn').trigger('click');
        ratingButton.trigger('click');
        cards = cards.map((card) => ({ ...card, due: 1_000 }));
        manager.refresh();
        elements.get('spaced-review-reveal-btn').trigger('click');
        ratingButton.trigger('click');
        const beforeSecondRollback = cards.map((card) => ({ ...card }));
        const confirmedCards = cards.map((card) => ({ ...card, due: 1_000, reps: 1 }));
        cards = confirmedCards;
        manager.refresh({
            rollback: true,
            beforeCards: Object.fromEntries(beforeSecondRollback.map((card) => [card.id, card])),
            restoredCards: Object.fromEntries(confirmedCards.map((card) => [card.id, card]))
        });

        assert.equal(elements.get('spaced-review-due-count').textContent, '1 due');
        assert.equal(elements.get('spaced-review-card').hidden, false);
        assert.equal(elements.get('spaced-review-status').textContent, '2 of up to 20 words in this review.');
    } finally {
        if (previousFsrs === undefined) delete globalThis.FSRS;
        else globalThis.FSRS = previousFsrs;
        if (previousProgress === undefined) delete globalThis.EnglishNextLevelProgress;
        else globalThis.EnglishNextLevelProgress = previousProgress;
        if (previousManager === undefined) delete globalThis.EnglishNextLevelSpacedReviewManager;
        else globalThis.EnglishNextLevelSpacedReviewManager = previousManager;
    }
});
