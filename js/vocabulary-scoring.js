// Pure scoring rules for the Words matching activity.

(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelVocabularyScoring = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    function calculateMatchPoints(secondsSinceLastMatch, isMobile = false) {
        const thresholds = isMobile
            ? { perfect: 5, fast: 8, good: 13, fair: 20 }
            : { perfect: 4, fast: 7, good: 12, fair: 18 };

        let speedBonus = 0;
        if (secondsSinceLastMatch <= thresholds.perfect) speedBonus = 100;
        else if (secondsSinceLastMatch <= thresholds.fast) speedBonus = 75;
        else if (secondsSinceLastMatch <= thresholds.good) speedBonus = 50;
        else if (secondsSinceLastMatch <= thresholds.fair) speedBonus = 25;

        return 100 + speedBonus;
    }

    return Object.freeze({ calculateMatchPoints });
});
