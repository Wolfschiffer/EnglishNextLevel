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

test('callable limits count requests in the rolling window and stay per account', async () => {
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
        { requestTimestampsMs: [1_000 + limit.windowMs] }
    );
    assert.deepEqual(
        documents.get('callableRateLimits/user-b/operations/startNumbersQuestion'),
        { requestTimestampsMs: [1_000] }
    );
});

test('the rolling window blocks a burst across adjacent minute boundaries', async () => {
    const { db, documents } = createFakeFirestore();
    const limit = CALLABLE_RATE_LIMITS.startNumbersQuestion;
    const options = { db, HttpsError };
    const justBeforeBoundary = limit.windowMs - 1;

    for (let count = 0; count < limit.maxRequests; count++) {
        await consumeCallableRateLimit(
            options,
            'user-a',
            'startNumbersQuestion',
            () => justBeforeBoundary
        );
    }

    await assert.rejects(
        consumeCallableRateLimit(
            options,
            'user-a',
            'startNumbersQuestion',
            () => limit.windowMs + 1
        ),
        error => error.code === 'resource-exhausted'
    );

    await consumeCallableRateLimit(
        options,
        'user-a',
        'startNumbersQuestion',
        () => justBeforeBoundary + limit.windowMs
    );

    assert.equal(
        documents.get('callableRateLimits/user-a/operations/startNumbersQuestion')
            .requestTimestampsMs.length,
        1
    );
});

test('a slower instance clock preserves requests recorded by a faster instance', async () => {
    const { db, documents } = createFakeFirestore();
    const limit = CALLABLE_RATE_LIMITS.startNumbersQuestion;
    const options = { db, HttpsError };

    for (let count = 0; count < limit.maxRequests - 1; count++) {
        await consumeCallableRateLimit(options, 'user-a', 'startNumbersQuestion', () => 1_000);
    }

    await consumeCallableRateLimit(options, 'user-a', 'startNumbersQuestion', () => 999);

    assert.equal(
        documents.get('callableRateLimits/user-a/operations/startNumbersQuestion')
            .requestTimestampsMs.length,
        limit.maxRequests
    );
    await assert.rejects(
        consumeCallableRateLimit(options, 'user-a', 'startNumbersQuestion', () => 998),
        error => error.code === 'resource-exhausted'
    );
});

test('a retried transaction uses the current time and preserves a concurrent request', async () => {
    const limit = CALLABLE_RATE_LIMITS.startNumbersQuestion;
    const previousRequestTime = 1_000;
    const concurrentRequestTime = previousRequestTime + limit.windowMs;
    const referencePath = 'callableRateLimits/user-a/operations/startNumbersQuestion';
    const { db, documents } = createFakeFirestore({
        beforeRetry(currentDocuments) {
            currentDocuments.set(referencePath, {
                requestTimestampsMs: [concurrentRequestTime]
            });
        }
    });
    documents.set(referencePath, {
        requestTimestampsMs: Array(limit.maxRequests - 1).fill(previousRequestTime)
    });
    const times = [concurrentRequestTime - 1, concurrentRequestTime + 1];
    const clock = () => times.shift();

    await consumeCallableRateLimit(
        { db, HttpsError },
        'user-a',
        'startNumbersQuestion',
        clock
    );

    assert.deepEqual(documents.get(referencePath), {
        requestTimestampsMs: [concurrentRequestTime, concurrentRequestTime + 1]
    });
});
