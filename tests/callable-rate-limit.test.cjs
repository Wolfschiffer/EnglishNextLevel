const assert = require('node:assert/strict');
const test = require('node:test');
const { CALLABLE_RATE_LIMITS, consumeCallableRateLimit } = require('../functions/callable-rate-limit');

class HttpsError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function createReference(path) {
    return {
        path,
        collection(name) {
            return { doc: id => createReference(path + '/' + name + '/' + id) };
        },
        doc(id) {
            return createReference(path ? path + '/' + id : id);
        }
    };
}

function createFakeFirestore({ beforeRetry = null } = {}) {
    const documents = new Map();
    let retryPending = Boolean(beforeRetry);

    const db = {
        collection: name => createReference(name),
        async runTransaction(work) {
            while (true) {
                const writes = [];
                const transaction = {
                    async get(reference) {
                        const value = documents.get(reference.path);
                        return {
                            exists: value !== undefined,
                            data: () => value
                        };
                    },
                    set(reference, value) {
                        writes.push([reference.path, value]);
                    }
                };
                const result = await work(transaction);

                if (retryPending) {
                    retryPending = false;
                    beforeRetry(documents);
                    continue;
                }

                for (const [path, value] of writes) documents.set(path, value);
                return result;
            }
        }
    };

    return { db, documents };
}

test('callable limits reject excess requests, reset after the window, and stay per account', async () => {
    const { db, documents } = createFakeFirestore();
    const limit = CALLABLE_RATE_LIMITS.startNumbersQuestion;
    const options = { db, HttpsError };
    const fixedClock = () => 1_000;

    for (let count = 0; count < limit.maxRequests; count++) {
        await consumeCallableRateLimit(options, 'user-a', 'startNumbersQuestion', fixedClock);
    }

    await assert.rejects(
        consumeCallableRateLimit(options, 'user-a', 'startNumbersQuestion', fixedClock),
        error => error.code === 'resource-exhausted'
    );

    await consumeCallableRateLimit(
        options,
        'user-a',
        'startNumbersQuestion',
        () => 1_000 + limit.windowMs
    );
    await consumeCallableRateLimit(options, 'user-b', 'startNumbersQuestion', fixedClock);

    assert.deepEqual(
        documents.get('callableRateLimits/user-a/operations/startNumbersQuestion'),
        { windowStartedAtMs: 1_000 + limit.windowMs, count: 1 }
    );
    assert.deepEqual(
        documents.get('callableRateLimits/user-b/operations/startNumbersQuestion'),
        { windowStartedAtMs: 1_000, count: 1 }
    );
});

test('a retried transaction uses the current time and preserves a concurrent new window', async () => {
    const limit = CALLABLE_RATE_LIMITS.startNumbersQuestion;
    const firstWindowStart = 1_000;
    const nextWindowStart = firstWindowStart + limit.windowMs;
    const referencePath = 'callableRateLimits/user-a/operations/startNumbersQuestion';
    const { db, documents } = createFakeFirestore({
        beforeRetry(currentDocuments) {
            currentDocuments.set(referencePath, {
                windowStartedAtMs: nextWindowStart,
                count: 1
            });
        }
    });
    documents.set(referencePath, {
        windowStartedAtMs: firstWindowStart,
        count: limit.maxRequests - 1
    });
    const times = [nextWindowStart - 1, nextWindowStart + 1];
    const clock = () => times.shift();

    await consumeCallableRateLimit(
        { db, HttpsError },
        'user-a',
        'startNumbersQuestion',
        clock
    );

    assert.deepEqual(documents.get(referencePath), {
        windowStartedAtMs: nextWindowStart,
        count: 2
    });
});
