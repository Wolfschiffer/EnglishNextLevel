((root, factory) => {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelNumbersFallbackQuestions = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    function buildFallbackNumbers({
        availableNumbers = [],
        allNumbers = [],
        shownValues = new Set(),
        remainingCount = 0
    } = {}) {
        const limit = Math.max(0, Math.floor(Number(remainingCount) || 0));
        if (limit === 0) return [];

        const seenValues = new Set();
        const fallbackNumbers = [];
        const appendUnseen = (number) => {
            if (shownValues.has(number.value) || seenValues.has(number.value)) return;
            fallbackNumbers.push(number);
            seenValues.add(number.value);
        };

        for (const number of availableNumbers) {
            if (fallbackNumbers.length >= limit) break;
            appendUnseen(number);
        }
        for (const number of allNumbers) {
            if (fallbackNumbers.length >= limit) break;
            appendUnseen(number);
        }

        return fallbackNumbers;
    }

    return Object.freeze({ buildFallbackNumbers });
});
