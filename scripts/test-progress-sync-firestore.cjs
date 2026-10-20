const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PROJECT_ID = 'demo-english-next-level';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

function requireLoopbackHost(host) {
    const url = new URL(`http://${host}`);
    assert.ok(
        ['127.0.0.1', 'localhost', '::1'].includes(url.hostname) && url.port === '8080',
        'Progress sync Firestore integration test must use the local emulator on port 8080'
    );
}

requireLoopbackHost(FIRESTORE_HOST);
process.env.GCLOUD_PROJECT = PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

const requireFunctions = createRequire(path.join(__dirname, '..', 'functions', 'package.json'));
const { initializeApp, deleteApp } = requireFunctions('firebase-admin/app');
const { FieldValue, getFirestore } = requireFunctions('firebase-admin/firestore');
const { normalizeProgressPayload, syncProgressData } = requireFunctions('./progress-sync');
const app = initializeApp({ projectId: PROJECT_ID }, `progress-sync-test-${randomUUID()}`);
const db = getFirestore(app);

class HttpsError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

async function main() {
    const userRef = db.doc(`users/progress-sync-${randomUUID().replaceAll('-', '')}`);
    const missingUserRef = db.doc(`users/progress-sync-missing-${randomUUID().replaceAll('-', '')}`);
    const progress = normalizeProgressPayload({
        numbers: { bestScores: { numbers: 42 } }
    }, HttpsError);
    const options = {
        db,
        uid: userRef.id,
        progress,
        profileName: 'Learner',
        email: 'learner@example.test',
        FieldValue,
        HttpsError
    };

    try {
        await userRef.set({
            name: 'Learner',
            email: 'learner@example.test',
            createdAt: new Date(),
            progressV1: {
                legacyField: { obsolete: true },
                numbers: {
                    bestScores: { numbers: 42 },
                    legacyMode: 99
                }
            }
        });

        await syncProgressData(options);
        const normalizedSnapshot = await userRef.get();
        const userData = normalizedSnapshot.data();
        assert.equal(userData.name, 'Learner');
        assert.equal(userData.email, 'learner@example.test');
        assert.equal(userData.createdAt.toMillis() > 0, true);
        assert.equal(userData.progressV1.legacyField, undefined);
        assert.equal(userData.progressV1.numbers.legacyMode, undefined);
        assert.equal(userData.progressV1.numbers.bestScores.numbers, 42);

        await syncProgressData(options);
        const unchangedSnapshot = await userRef.get();
        assert.ok(normalizedSnapshot.updateTime.isEqual(unchangedSnapshot.updateTime),
            'A second normalized sync must not rewrite the user document');
        console.log('PASS legacy nested fields are removed and unchanged progress is not rewritten');

        await syncProgressData({ ...options, uid: missingUserRef.id });
        const recoveredSnapshot = await missingUserRef.get();
        assert.equal(recoveredSnapshot.exists, true,
            'A verified user missing a profile should receive a recoverable profile');
        assert.equal(recoveredSnapshot.data().name, 'Learner');
        assert.equal(recoveredSnapshot.data().email, 'learner@example.test');
        assert.equal(recoveredSnapshot.data().createdAt.toMillis() > 0, true);
        assert.equal(recoveredSnapshot.data().progressV1.numbers.bestScores.numbers, 42);
        console.log('PASS missing verified-user profiles are repaired with synced progress');
    } finally {
        await Promise.all([userRef.delete().catch(() => {}), missingUserRef.delete().catch(() => {})]);
        await deleteApp(app);
    }
}

main().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
});
