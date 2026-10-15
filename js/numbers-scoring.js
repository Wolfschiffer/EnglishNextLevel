// Pure scoring calculations shared by the Numbers game flow.

window.EnglishNextLevelNumbersScoring = (() => {
    function calculateRoundScore({ streak, roundTime, config, timeBonusMax, perfectTime }) {
        let points = config.BASE_POINTS;
        const streakBonus = Math.min(streak, config.MAX_STREAK) * config.STREAK_MULTIPLIER;
        points = Math.floor(points * (1 + streakBonus));

        let timeBonus = 1.0;
        if (roundTime <= perfectTime) {
            timeBonus = timeBonusMax;
        } else if (roundTime <= config.MAX_TIME) {
            const timeFactor = (config.MAX_TIME - roundTime) / (config.MAX_TIME - perfectTime);
            timeBonus = 1.0 + (timeFactor * (timeBonusMax - 1.0));
            timeBonus = Math.min(timeBonusMax, Math.max(config.TIME_BONUS_MIN, timeBonus));
        }

        points = Math.floor(points * timeBonus);

        return {
            base: config.BASE_POINTS,
            streakBonus,
            streakMultiplier: 1 + streakBonus,
            timeBonus,
            total: points,
            time: roundTime
        };
    }

    function calculateFinalResult({ baseScore, totalGameTime, livesRemaining }) {
        let speedBonus = 1.0;
        if (totalGameTime <= 22) speedBonus = 2.4;
        else if (totalGameTime <= 30) speedBonus = 2.2;
        else if (totalGameTime <= 45) speedBonus = 1.8;
        else if (totalGameTime <= 65) speedBonus = 1.5;
        else if (totalGameTime <= 90) speedBonus = 1.2;

        const lifeBonus = 1 + (livesRemaining * 0.2);
        return {
            baseScore,
            speedBonus,
            lifeBonus,
            finalScore: Math.floor(baseScore * speedBonus * lifeBonus),
            totalGameTime,
            livesRemaining
        };
    }

    return Object.freeze({ calculateRoundScore, calculateFinalResult });
})();
