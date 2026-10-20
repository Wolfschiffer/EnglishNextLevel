const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createHarness({
    failReads = false, failWrites = false, initialStorage = {}, guest = false,
    afterTransaction = null, beforeCloudRead = null
} = {}) {
    const values = new Map(Object.entries(initialStorage));
    const authTimers = [];
    const windowListeners = new Map();
    let authObserver = null;
    const storage = {
        getItem(key) {
            if (this.failReads) throw new Error('read denied');
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            if (this.failWrites) throw new Error('write denied');
            values.set(key, value);
        },
        failReads,
        failWrites
    };

    let cloudUserData = null;
    let cloudWriteCount = 0;
    let cloudReadCount = 0;
    let cloudCallableCount = 0;
    let progressData = null;
    let cloudUnavailable = false;
    const userRef = {
        uid: 'test-user',
        async get() {
            if (cloudUnavailable) throw new Error('network unavailable');
            cloudReadCount += 1;
            if (beforeCloudRead) await beforeCloudRead();
            return {
                exists: cloudUserData !== null,
                data: () => clone(cloudUserData)
            };
        }
    };
    const db = {
        collection(name) {
            assert.equal(name, 'users');
            return { doc(uid) {
                assert.equal(uid, 'test-user');
                return userRef;
            } };
        }
    };

    const syncStatus = { textContent: '', dataset: {} };
    const window = {
        currentUser: guest ? null : { uid: 'test-user', email: 'qa@example.test' },
        currentUserName: 'QA',
        isGuest: guest,
        localStorage: storage,
        addEventListener(type, callback) {
            const listeners = windowListeners.get(type) || [];
            listeners.push(callback);
            windowListeners.set(type, listeners);
        },
        setTimeout(callback, delay) {
            if (delay === 250) authTimers.push(callback);
            return 1;
        }
    };
    window.enlSyncProgress = async (progress, expectedUid, profileName) => {
        if (cloudUnavailable) throw new Error('network unavailable');
        assert.equal(expectedUid, 'test-user');
        cloudCallableCount += 1;
        const normalizedProgress = progressData.normalizeProgress(progress);
        const cloudProgress = cloudUserData?.progressV1;
        const next = progressData.mergeProgress(normalizedProgress, cloudProgress);
        const normalizedCloud = progressData.normalizeProgress(cloudProgress);
        const serialize = value => JSON.stringify(stableValue(value));
        const hasProfileName = typeof cloudUserData?.name === 'string' && cloudUserData.name.trim().length > 0;
        const hasProfileEmail = typeof cloudUserData?.email === 'string' && cloudUserData.email.trim().length > 0;
        const needsProfileRepair = !hasProfileName || !hasProfileEmail || cloudUserData?.createdAt == null;
        const needsWrite = needsProfileRepair || serialize(next) !== serialize(normalizedCloud)
            || (cloudProgress != null && serialize(cloudProgress) !== serialize(normalizedCloud));
        afterTransaction?.(storage);
        if (needsWrite) {
            cloudUserData = {
                ...(cloudUserData || {}),
                ...(!hasProfileName ? { name: profileName || 'QA' } : {}),
                ...(!hasProfileEmail ? { email: window.currentUser.email } : {}),
                ...(cloudUserData?.createdAt == null ? { createdAt: 'server timestamp' } : {}),
                progressV1: clone(next),
                progressUpdatedAt: 'server timestamp'
            };
            cloudWriteCount += 1;
        }
        return clone(next);
    };
    const document = {
        readyState: 'complete',
        getElementById(id) { return id === 'progress-sync-status' ? syncStatus : null; },
        addEventListener() {}
    };
    const firebase = {
        firestore: {
            FieldValue: { serverTimestamp: () => 'server timestamp' }
        }
    };
    const auth = {
        onAuthStateChanged(callback) {
            authObserver = callback;
        }
    };
    const dataSource = fs.readFileSync(path.join(__dirname, '../functions/shared/progress-profile-data.js'), 'utf8');
    const summarySource = fs.readFileSync(path.join(__dirname, '../js/progress-profile-summary.js'), 'utf8');
    const rendererSource = fs.readFileSync(path.join(__dirname, '../js/progress-profile-renderer.js'), 'utf8');
    const source = fs.readFileSync(path.join(__dirname, '../js/progress-profile.js'), 'utf8');

    vm.runInNewContext(dataSource, { window });
    progressData = window.EnglishNextLevelProgressData;
    vm.runInNewContext(summarySource, { window });
    vm.runInNewContext(rendererSource, { window });

    vm.runInNewContext(source, {
        window,
        document,
        db,
        firebase,
        auth,
        setTimeout: () => 1,
        clearTimeout() {},
        console: { warn() {} }
    });

    return {
        api: window.EnglishNextLevelProgress,
        storage,
        syncStatus,
        setCurrentUser(user) { window.currentUser = user; },
        setSpacedReviewManager(manager) { window.EnglishNextLevelSpacedReviewManager = manager; },
        setCloudUnavailable(value) { cloudUnavailable = value; },
        setCloudUserData(value) {
            cloudUserData = value == null ? value : {
                name: 'Learner',
                email: 'qa@example.test',
                createdAt: 'existing profile timestamp',
                ...clone(value)
            };
        },
        dispatchWindowEvent(type) { (windowListeners.get(type) || []).forEach((callback) => callback()); },
        notifyAuth(user) { authObserver(user); },
        flushAuthTimers() { authTimers.splice(0).forEach((callback) => callback()); },
        get cloudUserData() { return cloudUserData; },
        get cloudWriteCount() { return cloudWriteCount; },
        get cloudReadCount() { return cloudReadCount; },
        get cloudCallableCount() { return cloudCallableCount; }
    };
}

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
}

test('guest progress reports a save failure when local storage is unavailable', () => {
    const harness = createHarness({ guest: true, failWrites: true });

    harness.api.recordWordsResult({ mode: 'present', score: 25, timeSeconds: 90 });

    assert.equal(harness.syncStatus.textContent, 'Progress not saved');
    assert.equal(harness.syncStatus.dataset.state, 'error');
    assert.equal(harness.api.getProgress().words.present.bestScore, 0);
    assert.equal(harness.api.getProgress().words.present.completed, false);
});

test('Numbers, Words, and Topics records roll back when no storage can save them', () => {
    const harness = createHarness({ guest: true, failWrites: true });

    assert.equal(harness.api.recordNumbersBest('numbers', 42), false);
    assert.equal(harness.api.recordWordsResult({ mode: 'past', score: 30, timeSeconds: 80 }), false);
    assert.equal(harness.api.recordTopicResult({
        topicId: 'kitchen', levelId: 'common', volumeId: 'volume-1',
        gameType: 'match', score: 100, timeSeconds: 60
    }), false);

    const progress = harness.api.getProgress();
    assert.equal(progress.numbers.bestScores.numbers, 0);
    assert.equal(progress.words.past.bestScore, 0);
    assert.equal(progress.words.past.completed, false);
    assert.equal(Object.keys(progress.topics).length, 0);
    assert.equal(Object.keys(progress.topicStats).length, 0);
    assert.equal(harness.syncStatus.textContent, 'Progress not saved');
});

test('signed-in progress reports a save failure when both local and cloud storage fail', async () => {
    const harness = createHarness({ failWrites: true });
    harness.setCloudUnavailable(true);

    harness.api.recordWordsResult({ mode: 'present', score: 25, timeSeconds: 90 });
    await harness.api.refreshProfile();

    assert.equal(harness.syncStatus.textContent, 'Progress not saved');
    assert.equal(harness.syncStatus.dataset.state, 'error');
    assert.equal(harness.api.getProgress().words.present.bestScore, 0);
    assert.equal(harness.api.getProgress().words.present.completed, false);
});

test('signed-in progress reports a cloud save when local storage is unavailable', async () => {
    const harness = createHarness({ failWrites: true });

    harness.api.recordWordsResult({ mode: 'present', score: 25, timeSeconds: 90 });
    await harness.api.refreshProfile();

    assert.equal(harness.cloudWriteCount, 1);
    assert.equal(harness.cloudUserData.progressV1.words.present.bestScore, 25);
    assert.equal(harness.cloudUserData.progressV1.words.present.completed, true);
    assert.equal(harness.syncStatus.textContent, 'Synced');
    assert.equal(harness.syncStatus.dataset.state, 'synced');
});

test('cloud sync skips a write when local and remote progress already match', async () => {
    const harness = createHarness();
    harness.api.recordNumbersBest('numbers', 42);
    const existingProgress = clone(harness.api.getProgress());
    harness.setCloudUserData({
        progressV1: existingProgress,
        progressUpdatedAt: 'previous timestamp'
    });

    await harness.api.refreshProfile();

    assert.equal(harness.cloudReadCount, 1);
    assert.equal(harness.cloudCallableCount, 0);
    assert.equal(harness.cloudWriteCount, 0);
    assert.deepEqual(harness.cloudUserData.progressV1, existingProgress);
    assert.equal(harness.cloudUserData.progressUpdatedAt, 'previous timestamp');
});

test('cloud sync repairs a missing profile even when no progress changed', async () => {
    const harness = createHarness();

    await harness.api.refreshProfile();

    assert.equal(harness.cloudCallableCount, 1);
    assert.equal(harness.cloudWriteCount, 1);
    assert.equal(harness.cloudUserData.name, 'QA');
    assert.equal(harness.cloudUserData.email, 'qa@example.test');
    assert.equal(harness.cloudUserData.createdAt, 'server timestamp');
});

test('cloud sync repairs missing profile metadata while preserving existing profile fields', async () => {
    const harness = createHarness();
    harness.setCloudUserData({ name: '  ', email: '', createdAt: null, customField: 'preserved' });

    await harness.api.refreshProfile();

    assert.equal(harness.cloudUserData.name, 'QA');
    assert.equal(harness.cloudUserData.email, 'qa@example.test');
    assert.equal(harness.cloudUserData.createdAt, 'server timestamp');
    assert.equal(harness.cloudUserData.customField, 'preserved');
});

test('cloud sync repairs missing metadata when the stored profile name is already valid', async () => {
    const harness = createHarness();
    harness.setCloudUserData({ name: 'Existing Learner', email: '', createdAt: null });

    await harness.api.refreshProfile();

    assert.equal(harness.cloudCallableCount, 1);
    assert.equal(harness.cloudUserData.name, 'Existing Learner');
    assert.equal(harness.cloudUserData.email, 'qa@example.test');
    assert.equal(harness.cloudUserData.createdAt, 'server timestamp');
});

test('cloud sync writes normalized progress when the stored cloud shape is incomplete', async () => {
    const harness = createHarness();
    harness.setCloudUserData({
        progressV1: { numbers: { bestScores: { numbers: 29 } } },
        progressUpdatedAt: 'previous timestamp'
    });

    await harness.api.refreshProfile();

    assert.equal(harness.cloudWriteCount, 1);
    assert.equal(harness.cloudUserData.progressV1.numbers.bestScores.numbers, 29);
    assert.equal(typeof harness.cloudUserData.progressV1.words.present.completed, 'boolean');
    assert.equal(harness.cloudUserData.progressUpdatedAt, 'server timestamp');
});


test('cloud sync preserves new progress when local storage writes fail', async () => {
    const harness = createHarness({ failWrites: true });

    harness.api.recordNumbersBest('numbers', 42);
    await harness.api.refreshProfile();

    assert.equal(harness.cloudWriteCount, 1);
    assert.equal(harness.cloudUserData.progressV1.numbers.bestScores.numbers, 42);
    assert.equal(harness.api.getProgress().numbers.bestScores.numbers, 42);
});

test('cloud sync clears the rollback snapshot after local storage recovers', async () => {
    const harness = createHarness({
        failWrites: true,
        afterTransaction(storage) { storage.failWrites = false; }
    });

    harness.api.recordWordsResult({ mode: 'present', score: 25, timeSeconds: 90 });
    await harness.api.refreshProfile();
    assert.equal(harness.api.getProgress().words.present.bestScore, 25);

    harness.setCloudUnavailable(true);
    await harness.api.refreshProfile();
    assert.equal(harness.api.getProgress().words.present.bestScore, 25);
});

test('cloud sync preserves cached progress when local storage reads fail', async () => {
    const harness = createHarness();

    harness.api.recordWordsResult({ mode: 'present', score: 25, timeSeconds: 90 });
    harness.storage.failReads = true;
    await harness.api.refreshProfile();

    assert.equal(harness.cloudUserData.progressV1.words.present.bestScore, 25);
    assert.equal(harness.cloudUserData.progressV1.words.present.completed, true);
    assert.equal(harness.api.getProgress().words.present.bestScore, 25);
});

test('review card stays unchanged when local storage rejects the update', () => {
    const harness = createHarness({ guest: true });
    harness.api.recordVocabularyReviewItems({
        mode: 'present', setId: 'verbs1',
        items: [{ id: 0, english: 'to work', portuguese: 'trabalhar' }]
    });
    const [card] = harness.api.getVocabularyReviewCards();
    const nextDue = card.due + 60_000;

    harness.storage.failWrites = true;
    assert.equal(harness.api.recordVocabularyReviewCard(card.id, {
        ...card, due: nextDue, reps: card.reps + 1
    }), false);
    assert.equal(harness.api.getVocabularyReviewCards()[0].due, card.due);
    assert.equal(harness.api.getVocabularyReviewCards()[0].reps, card.reps);

    harness.storage.failWrites = false;
    assert.equal(harness.api.recordVocabularyReviewCard(card.id, {
        ...card, due: nextDue, reps: card.reps + 1
    }), true);
    assert.equal(harness.api.getVocabularyReviewCards()[0].due, nextDue);
});

test('completed set is not added to the review queue when local storage rejects the update', () => {
    const harness = createHarness({ guest: true });
    const firstSet = {
        mode: 'present', setId: 'verbs1',
        items: [{ id: 0, english: 'to work', portuguese: 'trabalhar' }]
    };
    const secondSet = {
        mode: 'past', setId: 'past1',
        items: [{ id: 0, english: 'to work', portuguese: 'worked' }]
    };

    assert.equal(harness.api.recordVocabularyReviewItems(firstSet), 1);
    const existingCard = harness.api.getVocabularyReviewCards()[0];

    harness.storage.failWrites = true;
    assert.equal(harness.api.recordVocabularyReviewItems(secondSet), 0);
    assert.deepEqual(Array.from(harness.api.getVocabularyReviewCards(), (card) => card.id), [existingCard.id]);

    harness.storage.failWrites = false;
    assert.equal(harness.api.recordVocabularyReviewItems(secondSet), 1);
    assert.equal(harness.api.getVocabularyReviewCards().length, 2);
});

test('review cards sync to Firestore when local storage rejects a signed-in user write', async () => {
    const harness = createHarness();
    harness.api.recordVocabularyReviewItems({
        mode: 'present', setId: 'verbs1',
        items: [{ id: 0, english: 'to work', portuguese: 'trabalhar' }]
    });

    harness.storage.failWrites = true;
    assert.equal(harness.api.recordVocabularyReviewItems({
        mode: 'past', setId: 'past1',
        items: [{ id: 0, english: 'to work', portuguese: 'worked' }]
    }), 1);

    await harness.api.refreshProfile();

    const cards = harness.cloudUserData.progressV1.vocabularyReviews.cards;
    assert.equal(cards['present:verbs1:0'].back, 'trabalhar');
    assert.equal(cards['past:past1:0'].back, 'worked');
    assert.equal(harness.cloudWriteCount, 1);
});

test('review ratings sync to Firestore when local storage rejects a signed-in user write', async () => {
    const harness = createHarness();
    harness.api.recordVocabularyReviewItems({
        mode: 'present', setId: 'verbs1',
        items: [{ id: 0, english: 'to work', portuguese: 'trabalhar' }]
    });
    const [card] = harness.api.getVocabularyReviewCards();
    const nextDue = card.due + 60_000;

    harness.storage.failWrites = true;
    assert.equal(harness.api.recordVocabularyReviewCard(card.id, {
        ...card, due: nextDue, reps: card.reps + 1
    }), true);

    await harness.api.refreshProfile();

    const cloudCard = harness.cloudUserData.progressV1.vocabularyReviews.cards[card.id];
    assert.equal(cloudCard.due, nextDue);
    assert.equal(cloudCard.reps, card.reps + 1);
    assert.equal(harness.cloudWriteCount, 1);
});

test('review queue changes roll back when local storage and Firestore both fail', async () => {
    const harness = createHarness();
    harness.api.recordVocabularyReviewItems({
        mode: 'present', setId: 'verbs1',
        items: [{ id: 0, english: 'to work', portuguese: 'trabalhar' }]
    });
    harness.storage.failWrites = true;
    harness.setCloudUnavailable(true);

    assert.equal(harness.api.recordVocabularyReviewItems({
        mode: 'past', setId: 'past1',
        items: [{ id: 0, english: 'to work', portuguese: 'worked' }]
    }), 1);
    await harness.api.refreshProfile();

    assert.deepEqual(Array.from(harness.api.getVocabularyReviewCards(), (card) => card.id), ['present:verbs1:0']);
    assert.equal(harness.syncStatus.dataset.state, 'error');
});

test('review ratings roll back when local storage and Firestore both fail', async () => {
    const harness = createHarness();
    harness.api.recordVocabularyReviewItems({
        mode: 'present', setId: 'verbs1',
        items: [{ id: 0, english: 'to work', portuguese: 'trabalhar' }]
    });
    const [card] = harness.api.getVocabularyReviewCards();
    const nextDue = card.due + 60_000;
    harness.storage.failWrites = true;
    harness.setCloudUnavailable(true);
    const refreshCalls = [];
    harness.setSpacedReviewManager({ refresh: (options) => refreshCalls.push(options) });

    assert.equal(harness.api.recordVocabularyReviewCard(card.id, {
        ...card, due: nextDue, reps: card.reps + 1
    }), true);
    await harness.api.refreshProfile();

    const [restoredCard] = harness.api.getVocabularyReviewCards();
    assert.equal(restoredCard.due, card.due);
    assert.equal(restoredCard.reps, card.reps);
    assert.equal(harness.syncStatus.dataset.state, 'error');
    assert.equal(refreshCalls.length, 1);
    assert.equal(refreshCalls[0].rollback, true);
});

test('pending progress survives sign-out and is synced after returning to the account', async () => {
    const harness = createHarness({ failWrites: true });

    harness.api.recordNumbersBest('numbers', 73);
    harness.setCurrentUser(null);
    harness.notifyAuth(null);
    harness.flushAuthTimers();

    harness.storage.failWrites = false;
    harness.setCurrentUser({ uid: 'test-user', email: 'qa@example.test' });
    await harness.api.refreshProfile();

    assert.equal(harness.cloudUserData.progressV1.numbers.bestScores.numbers, 73);
    assert.equal(harness.api.getProgress().numbers.bestScores.numbers, 73);
    assert.equal(JSON.parse(harness.storage.getItem('englishNextLevel.progress.v1.user.test-user')).numbers.bestScores.numbers, 73);
});

test('local progress syncs to Firestore after the connection returns', async () => {
    const harness = createHarness();
    harness.setCloudUnavailable(true);

    harness.api.recordNumbersBest('numbers', 57);
    await harness.api.refreshProfile();
    assert.equal(harness.cloudWriteCount, 0);
    assert.equal(harness.api.getProgress().numbers.bestScores.numbers, 57);

    harness.setCloudUnavailable(false);
    harness.dispatchWindowEvent('online');
    assert.equal(harness.cloudReadCount, 1, 'online event should read the saved profile');
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(harness.cloudCallableCount, 1, 'online event should send pending progress through the callable');
    assert.equal(harness.cloudWriteCount, 1);
    assert.equal(harness.cloudUserData.progressV1.numbers.bestScores.numbers, 57);
});

test('cloud sync does not send a prior account progress after the account changes during the read', async () => {
    let releaseCloudRead;
    let markCloudReadStarted;
    const cloudReadStarted = new Promise(resolve => { markCloudReadStarted = resolve; });
    const cloudReadGate = new Promise(resolve => { releaseCloudRead = resolve; });
    const harness = createHarness({
        beforeCloudRead: async () => {
            markCloudReadStarted();
            await cloudReadGate;
        }
    });

    harness.api.recordNumbersBest('numbers', 57);
    const pendingSync = harness.api.refreshProfile();
    await cloudReadStarted;
    harness.setCurrentUser({ uid: 'other-user', email: 'other@example.test' });
    releaseCloudRead();
    await pendingSync;

    assert.equal(harness.cloudCallableCount, 0);
    assert.equal(harness.cloudWriteCount, 0);
    assert.equal(harness.cloudUserData, null);
});

test('completed Words sets enter a persistent review queue that syncs to the account', async () => {
    const harness = createHarness();

    assert.equal(harness.api.recordVocabularyReviewItems({
        mode: 'present',
        setId: 'verbs1',
        items: [
            { id: 0, english: 'to work', portuguese: 'trabalhar' },
            { id: 1, english: 'to ask', portuguese: 'perguntar' }
        ]
    }), 2);
    assert.equal(harness.api.recordVocabularyReviewItems({
        mode: 'present',
        setId: 'verbs1',
        items: [{ id: 0, english: 'to work', portuguese: 'trabalhar' }]
    }), 0, 'replaying a set should preserve existing FSRS scheduling data');

    const localCards = harness.api.getVocabularyReviewCards();
    assert.equal(localCards.length, 2);
    assert.equal(localCards[0].due > 0, true);
    assert.equal(localCards[0].state, 0);

    await harness.api.refreshProfile();
    assert.equal(Object.keys(harness.cloudUserData.progressV1.vocabularyReviews.cards).length, 2);
});

test('review card sync keeps the latest state when devices have different copies', async () => {
    const storageKey = 'englishNextLevel.progress.v1.user.test-user';
    const cardId = 'past:past7:3';
    const localCard = {
        front: 'to go', back: 'went', due: 100, stability: 1, difficulty: 5,
        elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0,
        learning_steps: 0, state: 2, last_review: 50, updatedAt: 100
    };
    const cloudCard = { ...localCard, due: 500, reps: 2, last_review: 400, updatedAt: 200 };
    const harness = createHarness({
        initialStorage: { [storageKey]: JSON.stringify({ vocabularyReviews: { cards: { [cardId]: localCard } } }) }
    });
    harness.setCloudUserData({ progressV1: { vocabularyReviews: { cards: { [cardId]: cloudCard } } } });

    await harness.api.refreshProfile();

    const [mergedCard] = harness.api.getVocabularyReviewCards();
    assert.equal(mergedCard.id, cardId);
    assert.equal(mergedCard.reps, 2);
    assert.equal(mergedCard.due, 500);
});

test('FSRS review state survives a local profile reload', () => {
    const storageKey = 'englishNextLevel.progress.v1.user.test-user';
    const firstSession = createHarness();
    firstSession.api.recordVocabularyReviewItems({
        mode: 'present', setId: 'verbs1',
        items: [{ id: 0, english: 'to work', portuguese: 'trabalhar' }]
    });
    const [initialCard] = firstSession.api.getVocabularyReviewCards();
    const reviewedAt = Date.now();
    firstSession.api.recordVocabularyReviewCard(initialCard.id, {
        ...initialCard,
        due: reviewedAt + 86_400_000,
        last_review: reviewedAt,
        reps: 1,
        state: 2,
        updatedAt: reviewedAt
    });

    const storedProgress = firstSession.storage.getItem(storageKey);
    const secondSession = createHarness({ initialStorage: { [storageKey]: storedProgress } });
    const [restoredCard] = secondSession.api.getVocabularyReviewCards();

    assert.equal(restoredCard.id, initialCard.id);
    assert.equal(restoredCard.due, reviewedAt + 86_400_000);
    assert.equal(restoredCard.last_review, reviewedAt);
    assert.equal(restoredCard.reps, 1);
    assert.equal(restoredCard.state, 2);
});

test('topic results keep the best score and time while preserving other game progress', () => {
    const harness = createHarness();

    harness.api.recordTopicResult({
        topicId: 'kitchen', levelId: 'common', volumeId: 'volume-1',
        gameType: 'match', score: 840, timeSeconds: 72
    });
    harness.api.recordTopicResult({
        topicId: 'kitchen', levelId: 'common', volumeId: 'volume-1',
        gameType: 'match', score: 700, timeSeconds: 90
    });
    harness.api.recordTopicResult({
        topicId: 'kitchen', levelId: 'common', volumeId: 'volume-1',
        gameType: 'speak', score: 760, timeSeconds: 64
    });

    const progress = harness.api.getProgress();
    const activities = progress.topics.kitchen.common['volume-1'];
    const stats = progress.topicStats.kitchen.common['volume-1'];

    assert.deepEqual({ ...activities }, { match: true, speak: true });
    assert.deepEqual({ ...stats.match }, { bestScore: 840, bestTime: 72 });
    assert.deepEqual({ ...stats.speak }, { bestScore: 760, bestTime: 64 });
});

test('recording a new Topic result preserves existing local data and persists the merged profile', () => {
    const storageKey = 'englishNextLevel.progress.v1.user.test-user';
    const previousProgress = {
        version: 3,
        topics: { kitchen: { common: { 'volume-1': { match: true, speak: false } } } },
        topicStats: {
            kitchen: {
                common: {
                    'volume-1': { match: { bestScore: 880, bestTime: 58 } }
                }
            }
        }
    };
    const harness = createHarness({
        initialStorage: { [storageKey]: JSON.stringify(previousProgress) }
    });

    harness.api.recordTopicResult({
        topicId: 'kitchen', levelId: 'common', volumeId: 'volume-1',
        gameType: 'match', score: 700, timeSeconds: 90
    });
    harness.api.recordTopicResult({
        topicId: 'kitchen', levelId: 'common', volumeId: 'volume-1',
        gameType: 'speak', score: 760, timeSeconds: 64
    });

    const persisted = JSON.parse(harness.storage.getItem(storageKey));
    const activities = persisted.topics.kitchen.common['volume-1'];
    const stats = persisted.topicStats.kitchen.common['volume-1'];

    assert.deepEqual({ ...activities }, { match: true, speak: true });
    assert.deepEqual({ ...stats.match }, { bestScore: 880, bestTime: 58 });
    assert.deepEqual({ ...stats.speak }, { bestScore: 760, bestTime: 64 });
});
