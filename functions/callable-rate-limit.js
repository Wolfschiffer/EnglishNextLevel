const CALLABLE_RATE_LIMITS = Object.freeze({
    startNumbersQuestion: Object.freeze({ windowMs: 60_000, maxRequests: 60 }),
    recordNumbersAnswer: Object.freeze({ windowMs: 60_000, maxRequests: 60 }),
    finishNumbersRun: Object.freeze({ windowMs: 60_000, maxRequests: 10 }),
    submitScore: Object.freeze({ windowMs: 60_000, maxRequests: 10 })
});

async function consumeCallableRateLimit({ db, HttpsError }, uid, operation, clock = Date.now) {
    const limit = CALLABLE_RATE_LIMITS[operation];
    if (!limit) throw new TypeError('Unknown callable rate limit: ' + operation);

    const limitRef = db.collection('callableRateLimits')
        .doc(uid)
        .collection('operations')
        .doc(operation);

    await db.runTransaction(async (transaction) => {
        const now = clock();
        const snapshot = await transaction.get(limitRef);
        const previous = snapshot.exists ? snapshot.data() : null;
        const hasActiveWindow = Number.isSafeInteger(previous?.windowStartedAtMs) &&
            previous.windowStartedAtMs <= now &&
            now < previous.windowStartedAtMs + limit.windowMs &&
            Number.isSafeInteger(previous.count) &&
            previous.count > 0;

        if (hasActiveWindow && previous.count >= limit.maxRequests) {
            throw new HttpsError('resource-exhausted', 'Too many requests. Try again later.');
        }

        const windowStartedAtMs = hasActiveWindow ? previous.windowStartedAtMs : now;
        transaction.set(limitRef, {
            windowStartedAtMs,
            count: hasActiveWindow ? previous.count + 1 : 1
        });
    });
}

module.exports = { CALLABLE_RATE_LIMITS, consumeCallableRateLimit };
