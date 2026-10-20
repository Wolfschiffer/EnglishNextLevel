const CALLABLE_RATE_LIMITS = Object.freeze({
    startNumbersRun: Object.freeze({ windowMs: 10 * 60_000, maxRequests: 10 }),
    startNumbersQuestion: Object.freeze({ windowMs: 60_000, maxRequests: 60 }),
    recordNumbersAnswer: Object.freeze({ windowMs: 60_000, maxRequests: 60 }),
    finishNumbersRun: Object.freeze({ windowMs: 60_000, maxRequests: 10 }),
    submitScore: Object.freeze({ windowMs: 60_000, maxRequests: 10 }),
    syncProgress: Object.freeze({ windowMs: 60_000, maxRequests: 60 })
});

async function consumeCallableRateLimit({ db, HttpsError }, uid, operation, clock = Date.now) {
    const limit = CALLABLE_RATE_LIMITS[operation];
    if (!limit) throw new TypeError('Unknown callable rate limit: ' + operation);

    const limitRef = db.collection('callableRateLimits')
        .doc(uid)
        .collection('operations')
        .doc(operation);

    await db.runTransaction(async (transaction) => {
        const currentTimeMs = clock();
        if (!Number.isSafeInteger(currentTimeMs) || currentTimeMs < 0) {
            throw new TypeError('Callable rate limit clock must return a non-negative integer.');
        }

        const snapshot = await transaction.get(limitRef);
        const previous = snapshot.exists ? snapshot.data() : null;
        const storedTimestamps = Array.isArray(previous?.requestTimestampsMs)
            ? previous.requestTimestampsMs.filter(timestamp =>
                Number.isSafeInteger(timestamp) && timestamp >= 0
            )
            : [];
        const logicalNowMs = storedTimestamps.reduce(
            (latest, timestamp) => Math.max(latest, timestamp),
            currentTimeMs
        );
        const recentRequests = storedTimestamps.filter(
            timestamp => logicalNowMs - timestamp < limit.windowMs
        );

        if (recentRequests.length >= limit.maxRequests) {
            throw new HttpsError('resource-exhausted', 'Too many requests. Try again later.');
        }

        transaction.set(limitRef, {
            requestTimestampsMs: [...recentRequests, logicalNowMs],
            expiresAt: new Date(logicalNowMs + limit.windowMs)
        });
    });
}

module.exports = { CALLABLE_RATE_LIMITS, consumeCallableRateLimit };
