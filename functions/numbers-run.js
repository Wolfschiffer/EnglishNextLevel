const { SCORE_MODES } = require('./score-validation');

const QUESTIONS_PER_RUN = 10;
const INITIAL_LIVES = 3;
const RUN_RULES_VERSION = 2;
const MAX_RUN_DURATION_MS = 30 * 60 * 1000;

const SMALL_NUMBER_WORDS = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen'
];

const TENS_WORDS = {
    2: 'twenty',
    3: 'thirty',
    4: 'forty',
    5: 'fifty',
    6: 'sixty',
    7: 'seventy',
    8: 'eighty',
    9: 'ninety'
};

function numberToWords(value) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 9999) {
        throw new RangeError('Numbers game values must be integers from 1 to 9,999.');
    }

    const parts = [];
    let remaining = value;

    if (remaining >= 1000) {
        const thousands = Math.floor(remaining / 1000);
        parts.push(`${SMALL_NUMBER_WORDS[thousands]} thousand`);
        remaining %= 1000;
    }

    if (remaining >= 100) {
        const hundreds = Math.floor(remaining / 100);
        parts.push(`${SMALL_NUMBER_WORDS[hundreds]} hundred`);
        remaining %= 100;
    }

    if (remaining > 0 && remaining < 20) {
        parts.push(SMALL_NUMBER_WORDS[remaining]);
    } else if (remaining >= 20) {
        const tens = Math.floor(remaining / 10);
        const units = remaining % 10;
        parts.push(units === 0
            ? TENS_WORDS[tens]
            : `${TENS_WORDS[tens]}-${SMALL_NUMBER_WORDS[units]}`);
    }

    return parts.join(' ');
}

function range(start, end, predicate = () => true) {
    const values = [];
    for (let value = start; value <= end; value++) {
        if (predicate(value)) values.push(value);
    }
    return values;
}

function getNumberPool(mode) {
    if (!SCORE_MODES.has(mode)) return [];

    switch (mode) {
        case 'numbers':
            return range(1, 10);
        case 'numbers11-20':
            return range(11, 20);
        case 'tens':
            return range(20, 90, value => value % 10 === 0);
        case 'random21_99':
            return range(21, 99, value => value % 10 !== 0);
        case 'hundreds':
            return range(100, 900, value => value % 100 === 0);
        case 'random101_999':
            // The current game data includes full hundreds such as 100 and 200.
            return range(100, 999);
        case 'thousands':
            return range(1000, 9000, value => value % 1000 === 0);
        case 'random1001_9999':
            return range(1001, 9999);
        case 'mixedAdvanced': {
            const values = new Set();
            for (const supportedMode of SCORE_MODES) {
                if (supportedMode === 'mixedAdvanced') continue;
                for (const value of getNumberPool(supportedMode)) values.add(value);
            }
            return [...values];
        }
        default:
            return [];
    }
}

function shuffle(values, random = Math.random) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const otherIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
    }
    return shuffled;
}

function createNumbersRunQuestions(mode, random = Math.random) {
    const pool = getNumberPool(mode);
    if (pool.length === 0) return null;

    const questionValues = shuffle(pool, random).slice(0, Math.min(QUESTIONS_PER_RUN, pool.length));
    return questionValues.map((value) => {
        const distractors = shuffle(pool.filter(candidate => candidate !== value), random).slice(0, 2);
        return {
            value,
            word: numberToWords(value),
            options: shuffle([value, ...distractors], random)
        };
    });
}

function calculateNumbersRoundPoints(streak, elapsedMs) {
    const base = 100;
    const streakBonus = Math.min(Math.max(0, streak), 5) * 0.35;
    const roundTime = Math.max(0, elapsedMs) / 1000;
    let timeBonus = 1;

    if (roundTime <= 2.5) {
        timeBonus = 2.5;
    } else if (roundTime <= 12) {
        const timeFactor = (12 - roundTime) / (12 - 2.5);
        timeBonus = Math.min(2.5, Math.max(1, 1 + (timeFactor * 1.5)));
    }

    const points = Math.floor(Math.floor(base * (1 + streakBonus)) * timeBonus);
    return { base, streakBonus, timeBonus, roundTime, points };
}

function calculateNumbersFinalResult(baseScore, totalGameTime, livesRemaining) {
    const safeTime = Math.max(0, totalGameTime);
    const safeLives = Math.min(INITIAL_LIVES, Math.max(0, livesRemaining));
    let speedBonus = 1;

    if (safeTime <= 22) speedBonus = 2.4;
    else if (safeTime <= 30) speedBonus = 2.2;
    else if (safeTime <= 45) speedBonus = 1.8;
    else if (safeTime <= 65) speedBonus = 1.5;
    else if (safeTime <= 90) speedBonus = 1.2;

    const lifeBonus = 1 + (safeLives * 0.2);
    return {
        baseScore,
        speedBonus,
        lifeBonus,
        finalScore: Math.floor(baseScore * speedBonus * lifeBonus),
        totalGameTime: safeTime,
        livesRemaining: safeLives
    };
}

module.exports = {
    INITIAL_LIVES,
    MAX_RUN_DURATION_MS,
    QUESTIONS_PER_RUN,
    RUN_RULES_VERSION,
    calculateNumbersFinalResult,
    calculateNumbersRoundPoints,
    createNumbersRunQuestions,
    getNumberPool,
    numberToWords
};
