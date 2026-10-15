const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
    calculateNumbersFinalResult: calculateServerFinalResult,
    calculateNumbersRoundPoints: calculateServerRoundPoints
} = require('../functions/numbers-run');

const root = path.join(__dirname, '..');
const scoreConfig = {
    BASE_POINTS: 100,
    STREAK_MULTIPLIER: 0.35,
    MAX_STREAK: 5,
    TIME_BONUS_MIN: 1.0,
    MAX_TIME: 12
};

function loadScoring() {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const scriptPaths = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
    const scoringIndex = scriptPaths.indexOf('js/numbers-scoring.js');
    const gameIndex = scriptPaths.indexOf('js/numbers-game.js');

    assert.notEqual(scoringIndex, -1, 'index should load the Numbers scoring module');
    assert.ok(scoringIndex < gameIndex, 'Numbers scoring must load before the Numbers game');

    const context = vm.createContext({ window: {} });
    const source = fs.readFileSync(path.join(root, 'js/numbers-scoring.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'numbers-scoring.js' });
    return context.window.EnglishNextLevelNumbersScoring;
}

test('Numbers round scoring preserves the server streak and timing curve', () => {
    const { calculateRoundScore } = loadScoring();

    for (const [streak, roundTime] of [
        [0, 2.5],
        [1, 12],
        [5, 12],
        [10, 13]
    ]) {
        const result = calculateRoundScore({
            streak,
            roundTime,
            config: scoreConfig,
            timeBonusMax: 2.5,
            perfectTime: 2.5
        });
        const serverResult = calculateServerRoundPoints(streak, roundTime * 1000);

        assert.equal(result.base, serverResult.base);
        assert.equal(result.streakBonus, serverResult.streakBonus);
        assert.equal(result.timeBonus, serverResult.timeBonus);
        assert.equal(result.total, serverResult.points);
        assert.equal(result.time, serverResult.roundTime);
    }
});

test('Numbers round score retains the client display fields and capped streak', () => {
    const { calculateRoundScore } = loadScoring();
    const result = calculateRoundScore({
        streak: 10,
        roundTime: 2.5,
        config: scoreConfig,
        timeBonusMax: 2.5,
        perfectTime: 2.5
    });

    assert.deepEqual({ ...result }, {
        base: 100,
        streakBonus: 1.75,
        streakMultiplier: 2.75,
        timeBonus: 2.5,
        total: 687,
        time: 2.5
    });
});

test('Numbers final scoring preserves server time and lives bonuses', () => {
    const { calculateFinalResult } = loadScoring();

    for (const [baseScore, totalGameTime, livesRemaining] of [
        [1000, 22, 3],
        [1000, 30, 2],
        [1000, 45, 1],
        [1000, 65, 0],
        [1000, 90, 3],
        [1000, 91, 0]
    ]) {
        assert.deepEqual(
            { ...calculateFinalResult({ baseScore, totalGameTime, livesRemaining }) },
            calculateServerFinalResult(baseScore, totalGameTime, livesRemaining)
        );
    }
});
