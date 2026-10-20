const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PROJECT_ID = 'demo-english-next-level';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

function requireLoopbackHost(host, port, serviceName) {
    const url = new URL(`http://${host}`);
    assert.ok(
        ['127.0.0.1', 'localhost', '::1'].includes(url.hostname) && url.port === String(port),
        `${serviceName} tests must use the local emulator at port ${port}`
    );
}

requireLoopbackHost(AUTH_HOST, 9099, 'Auth');
requireLoopbackHost(FIRESTORE_HOST, 8080, 'Firestore');
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

const requireFunctions = createRequire(path.join(__dirname, '..', 'functions', 'package.json'));
const { initializeApp } = requireFunctions('firebase-admin/app');
const { getFirestore } = requireFunctions('firebase-admin/firestore');

const authBase = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1`;
const firestoreBase = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const authEmulatorAdmin = `http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}`;

async function readJson(response) {
    return response.json().catch(() => ({}));
}

async function signUp(email) {
    const response = await fetch(`${authBase}/accounts:signUp?key=fake-api-key`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: `ENL-${randomUUID()}-Aa1!`, returnSecureToken: true })
    });
    const body = await readJson(response);
    assert.equal(response.status, 200, `Auth emulator signup failed: ${JSON.stringify(body)}`);
    return body;
}

async function expectStatus(response, expectedStatus, description) {
    const body = await readJson(response);
    assert.equal(
        response.status,
        expectedStatus,
        `${description}: expected HTTP ${expectedStatus}, got ${response.status}: ${JSON.stringify(body)}`
    );
    return body;
}

async function main() {
    const runId = randomUUID();
    const headers = (idToken) => ({ authorization: `Bearer ${idToken}` });
    const results = [];
    let owner;
    let other;
    let adminApp;
    let adminDb;

    try {
        owner = await signUp(`enl-rules-owner-${runId}@example.test`);
        other = await signUp(`enl-rules-other-${runId}@example.test`);
        adminApp = initializeApp({ projectId: PROJECT_ID }, `rules-test-${runId}`);
        adminDb = getFirestore(adminApp);
        const userPath = `${firestoreBase}/users/${owner.localId}`;
        const documentName = `projects/${PROJECT_ID}/databases/(default)/documents/users/${owner.localId}`;

        const unauthenticatedRead = await fetch(userPath);
        await expectStatus(unauthenticatedRead, 403, 'Unauthenticated user cannot read a private profile');
        results.push('unauthenticated profile read denied');

        const extraProgressCreate = await fetch(`${firestoreBase}:commit`, {
            method: 'POST',
            headers: { ...headers(owner.idToken), 'content-type': 'application/json' },
            body: JSON.stringify({
                writes: [{
                    update: {
                        name: documentName,
                        fields: {
                            progressV1: { mapValue: { fields: {} } },
                            serverOnlyField: { stringValue: 'must not be client-writable' }
                        }
                    },
                    updateMask: { fieldPaths: ['progressV1', 'serverOnlyField'] },
                    updateTransforms: [{
                        fieldPath: 'progressUpdatedAt',
                        setToServerValue: 'REQUEST_TIME'
                    }]
                }]
            })
        });
        await expectStatus(extraProgressCreate, 403, 'Progress-only profile creation rejects extra fields');
        results.push('extra fields in progress-only profile creation denied');

        const profileCreate = await fetch(userPath, {
            method: 'PATCH',
            headers: { ...headers(owner.idToken), 'content-type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    name: { stringValue: 'Rules Test' },
                    email: { stringValue: owner.email },
                    createdAt: { timestampValue: new Date().toISOString() }
                }
            })
        });
        await expectStatus(profileCreate, 200, 'Owner can create the account profile');
        results.push('owner profile create allowed');

        const ownerRead = await fetch(userPath, { headers: headers(owner.idToken) });
        await expectStatus(ownerRead, 200, 'Owner can read their profile');
        results.push('owner profile read allowed');

        const otherRead = await fetch(userPath, { headers: headers(other.idToken) });
        await expectStatus(otherRead, 403, 'Another signed-in user cannot read the profile');
        results.push('cross-account profile read denied');

        const progressWrite = await fetch(`${firestoreBase}:commit`, {
            method: 'POST',
            headers: { ...headers(owner.idToken), 'content-type': 'application/json' },
            body: JSON.stringify({
                writes: [{
                    update: {
                        name: documentName,
                        fields: { progressV1: { mapValue: { fields: {} } } }
                    },
                    updateMask: { fieldPaths: ['progressV1'] },
                    updateTransforms: [{
                        fieldPath: 'progressUpdatedAt',
                        setToServerValue: 'REQUEST_TIME'
                    }]
                }]
            })
        });
        await expectStatus(progressWrite, 403, 'Owner cannot write progress directly from the client');
        results.push('direct client progress write denied');

        const progressOnlyCreate = await fetch(`${firestoreBase}:commit`, {
            method: 'POST',
            headers: { ...headers(other.idToken), 'content-type': 'application/json' },
            body: JSON.stringify({
                writes: [{
                    update: {
                        name: `projects/${PROJECT_ID}/databases/(default)/documents/users/${other.localId}`,
                        fields: { progressV1: { mapValue: { fields: {} } } }
                    },
                    updateMask: { fieldPaths: ['progressV1'] },
                    updateTransforms: [{
                        fieldPath: 'progressUpdatedAt',
                        setToServerValue: 'REQUEST_TIME'
                    }]
                }]
            })
        });
        await expectStatus(progressOnlyCreate, 403, 'Client cannot create a progress-only account document');
        results.push('direct progress-only profile creation denied');

        const publicLeaderboardRead = await fetch(`${firestoreBase}/leaderboards/numbers/scores?pageSize=1`);
        await expectStatus(publicLeaderboardRead, 200, 'Leaderboard remains publicly readable');
        results.push('public leaderboard read allowed');

        const clientScoreWrite = await fetch(
            `${firestoreBase}/leaderboards/numbers/scores?documentId=enl-rules-${runId}`,
            {
                method: 'POST',
                headers: { ...headers(owner.idToken), 'content-type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        name: { stringValue: 'Rules Test' },
                        score: { integerValue: '100' },
                        date: { timestampValue: new Date().toISOString() }
                    }
                })
            }
        );
        await expectStatus(clientScoreWrite, 403, 'Client cannot submit a public leaderboard score directly');
        results.push('direct client leaderboard write denied');

        const privateRunPath = `${firestoreBase}/numbersRuns/enl-private-${runId}`;
        const directRunRead = await fetch(privateRunPath, { headers: headers(owner.idToken) });
        await expectStatus(directRunRead, 403, 'Client cannot read a server-side Numbers run');
        results.push('direct client Numbers run read denied');

        const directRunWrite = await fetch(privateRunPath, {
            method: 'PATCH',
            headers: { ...headers(owner.idToken), 'content-type': 'application/json' },
            body: JSON.stringify({ fields: { score: { integerValue: '99999' } } })
        });
        await expectStatus(directRunWrite, 403, 'Client cannot create or change a Numbers run');
        results.push('direct client Numbers run write denied');

        const privateLimitPath = `${firestoreBase}/numbersRunLimits/${owner.localId}`;
        const directLimitRead = await fetch(privateLimitPath, { headers: headers(owner.idToken) });
        await expectStatus(directLimitRead, 403, 'Client cannot read a server-side Numbers run limit');
        results.push('direct client Numbers run limit read denied');

        const directLimitWrite = await fetch(privateLimitPath, {
            method: 'PATCH',
            headers: { ...headers(owner.idToken), 'content-type': 'application/json' },
            body: JSON.stringify({ fields: { count: { integerValue: '1' } } })
        });
        await expectStatus(directLimitWrite, 403, 'Client cannot create or change a Numbers run limit');
        results.push('direct client Numbers run limit write denied');

        const callableLimitPath = firestoreBase + '/callableRateLimits/' +
            owner.localId + '/operations/startNumbersQuestion';
        const directCallableLimitRead = await fetch(callableLimitPath, {
            headers: headers(owner.idToken)
        });
        await expectStatus(directCallableLimitRead, 403,
            'Client cannot read a server-side callable rate limit');
        results.push('direct client callable rate limit read denied');

        const directCallableLimitWrite = await fetch(callableLimitPath, {
            method: 'PATCH',
            headers: { ...headers(owner.idToken), 'content-type': 'application/json' },
            body: JSON.stringify({ fields: { count: { integerValue: '1' } } })
        });
        await expectStatus(directCallableLimitWrite, 403,
            'Client cannot create or change a callable rate limit');
        results.push('direct client callable rate limit write denied');

        for (const result of results) console.log(`PASS ${result}`);
        console.log(`\n${results.length} Firestore emulator rule checks passed.`);
    } finally {
        if (owner && adminDb) {
            await adminDb.doc(`users/${owner.localId}`).delete().catch(() => {});
        }
        if (adminApp) await adminApp.delete().catch(() => {});
        for (const account of [owner, other].filter(Boolean)) {
            await fetch(`${authBase}/accounts:delete?key=fake-api-key`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ idToken: account.idToken })
            }).catch(() => {});
        }
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
