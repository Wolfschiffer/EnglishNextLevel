((root, factory) => {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelNumbersAnswerOptions = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    function create({ random = Math.random } = {}) {
        let lastCorrectIndex = null;
        let consecutiveCorrectCount = 0;

        function reset() {
            lastCorrectIndex = null;
            consecutiveCorrectCount = 0;
        }

        function generate(values, correctValue) {
            if (!Array.isArray(values)) {
                throw new TypeError('Numbers answer options require an array of values.');
            }

            const allowedCorrectIndexes = [0, 1, 2];
            if (lastCorrectIndex !== null && consecutiveCorrectCount >= 2) {
                allowedCorrectIndexes.splice(allowedCorrectIndexes.indexOf(lastCorrectIndex), 1);
            }

            const randomIndex = (length) => Math.min(
                length - 1,
                Math.max(0, Math.floor(random() * length))
            );
            const correctIndex = allowedCorrectIndexes[randomIndex(allowedCorrectIndexes.length)];

            if (correctIndex === lastCorrectIndex) {
                consecutiveCorrectCount++;
            } else {
                lastCorrectIndex = correctIndex;
                consecutiveCorrectCount = 1;
            }

            const possibleValues = values.filter((value) => value !== correctValue);
            const distractors = [];
            while (distractors.length < 2 && possibleValues.length > 0) {
                const [value] = possibleValues.splice(randomIndex(possibleValues.length), 1);
                if (!distractors.includes(value)) distractors.push(value);
            }

            const options = new Array(3);
            options[correctIndex] = correctValue;
            let distractorIndex = 0;
            for (let index = 0; index < options.length; index++) {
                if (index !== correctIndex) options[index] = distractors[distractorIndex++];
            }

            return options;
        }

        return Object.freeze({ generate, reset });
    }

    return Object.freeze({ create });
});
