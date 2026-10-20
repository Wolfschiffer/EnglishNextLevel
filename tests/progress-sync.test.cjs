const test = require('node:test');
const assert = require('node:assert/strict');
const { PROGRESS_SYNC_TOO_LARGE_REASON } = require('../functions/shared/progress-profile-data.js');
const {
    MAX_PROGRESS_BYTES,
    normalizeProgressPayload,
    syncProgressData
} = require('../functions/progress-sync');

class HttpsError extends Error {
    constructor(code, message, details = null) {
        super(message);
        this.code = code;
        this.details = details;
    }
}

function progressWithDailyHistory(startYear, dayCount) {
    const days = {};
    for (let index = 0; index < dayCount; index += 1) {
        const date = new Date(Date.UTC(startYear, 0, 1 + index)).toISOString().slice(0, 10);
        days[date] = { updatedAt: index + 1 };
    }
    return { history: { days } };
}

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createFakeFirestore(initialUserData = null) {
    let userData = clone(initialUserData);
    let writeCount = 0;
    const userRef = { path: 'users/user-a' };
    const db = {
        collection(name) {
            assert.equal(name, 'users');
            return { doc(uid) {
                assert.equal(uid, 'user-a');
                return userRef;
            } };
        },
        async runTransaction(callback) {
            let pendingWrite = null;
            const transaction = {
                async get(ref) {
                    assert.equal(ref, userRef);
                    return { exists: userData !== null, data: () => clone(userData) };
                },
                set(ref, value, options) {
                    assert.equal(ref, userRef);
                    assert.ok(options.mergeFields.includes('progressV1'));
                    assert.ok(options.mergeFields.includes('progressUpdatedAt'));
                    pendingWrite = { value: clone(value), mergeFields: [...options.mergeFields] };
                }
            };
            const result = await callback(transaction);
            if (pendingWrite) {
                userData = { ...(userData || {}) };
                pendingWrite.mergeFields.forEach((field) => {
                    userData[field] = pendingWrite.value[field];
                });
                writeCount += 1;
            }
            return clone(result);
        }
    };

    return {
        db,
        get userData() { return clone(userData); },
        get writeCount() { return writeCount; }
    };
}

test('progress sync rejects non-map and oversized input before touching Firestore', () => {
    const store = createFakeFirestore();

    assert.throws(
        () => normalizeProgressPayload([], HttpsError),
        error => error.code === 'invalid-argument'
    );
    assert.throws(
        () => normalizeProgressPayload({ note: 'x'.repeat(MAX_PROGRESS_BYTES) }, HttpsError),
        error => error.code === 'resource-exhausted'
            && error.details?.reason === PROGRESS_SYNC_TOO_LARGE_REASON
    );
    assert.equal(store.writeCount, 0);
});

test('progress sync tags normalized and merged payload size failures consistently', async () => {
    assert.throws(
        () => normalizeProgressPayload(progressWithDailyHistory(2000, 2700), HttpsError),
        error => error.code === 'resource-exhausted'
            && error.details?.reason === PROGRESS_SYNC_TOO_LARGE_REASON
    );

    const store = createFakeFirestore({
        name: 'Learner',
        email: 'learner@example.test',
        createdAt: 'existing profile timestamp',
        progressV1: normalizeProgressPayload(progressWithDailyHistory(2000, 1600), HttpsError)
    });

    await assert.rejects(
        syncProgressData({
            db: store.db,
            uid: 'user-a',
            progress: normalizeProgressPayload(progressWithDailyHistory(2010, 1600), HttpsError),
            profileName: 'Learner',
            email: 'learner@example.test',
            FieldValue: { serverTimestamp: () => 'server timestamp' },
            HttpsError
        }),
        error => error.code === 'resource-exhausted'
            && error.details?.reason === PROGRESS_SYNC_TOO_LARGE_REASON
    );

    assert.equal(store.writeCount, 0);
});

test('progress sync treats prototype-like topic IDs as data without changing shared prototypes', async () => {
    const pollutionKey = 'enlProgressSyncPrototypePollution';
    const hadOwnPollutionKey = Object.prototype.hasOwnProperty.call(Object.prototype, pollutionKey);
    const originalPollutionValue = Object.prototype[pollutionKey];
    const store = createFakeFirestore({ name: 'Learner', email: 'learner@example.test' });
    const progress = normalizeProgressPayload(JSON.parse(
        `{"topicStats":{"constructor":{"prototype":{"${pollutionKey}":{"match":{}}}}}}`
    ), HttpsError);

    try {
        const merged = await syncProgressData({
            db: store.db,
            uid: 'user-a',
            progress,
            FieldValue: { serverTimestamp: () => 'server timestamp' },
            HttpsError
        });

        assert.deepEqual(
            merged.topicStats.constructor.prototype[pollutionKey].match,
            { bestScore: 0, bestTime: null }
        );
        assert.equal(Object.prototype.hasOwnProperty.call(Object.prototype, pollutionKey), hadOwnPollutionKey);
        assert.equal(Object.prototype[pollutionKey], originalPollutionValue);
    } finally {
        if (!hadOwnPollutionKey) delete Object.prototype[pollutionKey];
        else Object.prototype[pollutionKey] = originalPollutionValue;
    }
});

test('progress sync merges incoming and cloud data while preserving profile fields', async () => {
    const store = createFakeFirestore({
        name: 'Learner',
        email: 'learner@example.test',
        createdAt: 'existing profile timestamp',
        progressV1: {
            numbers: { bestScores: { numbers: 73 } },
            words: { present: { completed: true, bestScore: 20, bestTime: 80 } }
        },
        progressUpdatedAt: 'old progress timestamp'
    });
    const incoming = normalizeProgressPayload({
        numbers: { bestScores: { numbers: 30 } },
        words: {
            present: { completed: false, bestScore: 28, bestTime: 90 },
            past: { completed: true, bestScore: 12, bestTime: 100 }
        }
    }, HttpsError);

    const merged = await syncProgressData({
        db: store.db,
        uid: 'user-a',
        progress: incoming,
        FieldValue: { serverTimestamp: () => 'new server timestamp' },
        HttpsError
    });

    assert.equal(merged.numbers.bestScores.numbers, 73);
    assert.equal(merged.words.present.bestScore, 28);
    assert.equal(merged.words.present.bestTime, 80);
    assert.equal(merged.words.past.completed, true);
    assert.equal(store.userData.name, 'Learner');
    assert.equal(store.userData.email, 'learner@example.test');
    assert.equal(store.userData.createdAt, 'existing profile timestamp');
    assert.equal(store.userData.progressUpdatedAt, 'new server timestamp');
    assert.equal(store.writeCount, 1);
});

test('repeating a progress sync does not write an unchanged progress document', async () => {
    const store = createFakeFirestore({
        name: 'Learner',
        email: 'learner@example.test',
        createdAt: 'existing profile timestamp'
    });
    const progress = normalizeProgressPayload({
        numbers: { bestScores: { numbers: 42 } }
    }, HttpsError);
    const options = {
        db: store.db,
        uid: 'user-a',
        progress,
        FieldValue: { serverTimestamp: () => 'server timestamp' },
        HttpsError
    };

    await syncProgressData(options);
    await syncProgressData(options);

    assert.equal(store.writeCount, 1);
    assert.equal(store.userData.progressV1.numbers.bestScores.numbers, 42);
});

test('progress sync repairs a missing profile from the verified account and saves progress', async () => {
    const store = createFakeFirestore();
    const progress = normalizeProgressPayload({
        numbers: { bestScores: { numbers: 42 } }
    }, HttpsError);

    await syncProgressData({
        db: store.db,
        uid: 'user-a',
        progress,
        profileName: '  Recovered Learner  ',
        email: 'learner@example.test',
        FieldValue: { serverTimestamp: () => 'server timestamp' },
        HttpsError
    });

    assert.equal(store.userData.name, 'Recovered Learner');
    assert.equal(store.userData.email, 'learner@example.test');
    assert.equal(store.userData.createdAt, 'server timestamp');
    assert.equal(store.userData.progressV1.numbers.bestScores.numbers, 42);
    assert.equal(store.writeCount, 1);
});

test('progress sync repairs blank profile metadata while preserving existing fields', async () => {
    const store = createFakeFirestore({ name: '   ', existingField: 'preserved' });
    const progress = normalizeProgressPayload({
        numbers: { bestScores: { numbers: 42 } }
    }, HttpsError);

    await syncProgressData({
        db: store.db,
        uid: 'user-a',
        progress,
        profileName: 'Recovered Learner',
        email: 'learner@example.test',
        FieldValue: { serverTimestamp: () => 'server timestamp' },
        HttpsError
    });

    assert.equal(store.userData.name, 'Recovered Learner');
    assert.equal(store.userData.email, 'learner@example.test');
    assert.equal(store.userData.createdAt, 'server timestamp');
    assert.equal(store.userData.existingField, 'preserved');
    assert.equal(store.userData.progressV1.numbers.bestScores.numbers, 42);
    assert.equal(store.writeCount, 1);
});

test('progress sync still rejects an incomplete profile without a recoverable name', async () => {
    const store = createFakeFirestore();
    const progress = normalizeProgressPayload({
        numbers: { bestScores: { numbers: 42 } }
    }, HttpsError);

    await assert.rejects(
        syncProgressData({
            db: store.db,
            uid: 'user-a',
            progress,
            profileName: '   ',
            email: '',
            FieldValue: { serverTimestamp: () => 'server timestamp' },
            HttpsError
        }),
        error => error.code === 'failed-precondition'
            && error.message.includes('profile name')
    );

    assert.equal(store.userData, null);
    assert.equal(store.writeCount, 0);
});

test('normalizing progress replaces obsolete nested fields and avoids later writes', async () => {
    const store = createFakeFirestore({
        name: 'Learner',
        createdAt: 'existing profile timestamp',
        progressV1: {
            legacyField: { obsolete: true },
            numbers: {
                bestScores: { numbers: 42 },
                legacyMode: 99
            }
        },
        progressUpdatedAt: 'old progress timestamp'
    });
    const progress = normalizeProgressPayload({
        numbers: { bestScores: { numbers: 42 } }
    }, HttpsError);
    const options = {
        db: store.db,
        uid: 'user-a',
        progress,
        FieldValue: { serverTimestamp: () => 'new server timestamp' },
        HttpsError
    };

    await syncProgressData(options);

    assert.equal(store.userData.name, 'Learner');
    assert.equal(store.userData.createdAt, 'existing profile timestamp');
    assert.equal(store.userData.progressV1.legacyField, undefined);
    assert.equal(store.userData.progressV1.numbers.legacyMode, undefined);
    assert.equal(store.userData.progressV1.numbers.bestScores.numbers, 42);
    assert.equal(store.writeCount, 1);

    await syncProgressData(options);
    assert.equal(store.writeCount, 1);
});
