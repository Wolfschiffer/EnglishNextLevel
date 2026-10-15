// Numbers game: tuning, data, scoring, animation, and round flow.

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const MOBILE_CONFIG = {
    eagleAnimationDelay: isMobile ? 45 : 50,
    jumpSpeed: isMobile ? 0.018 : 0.015,
    timerInterval: isMobile ? 300 : 200,
    // Ranked scoring uses one timing rule across devices so the server and
    // every player's result use the same multiplier.
    timeBonusMax: 2.5,
    perfectTime: 2.5,
    reduceAnimations: false,
    disableParticles: isMobile,
    canvasScale: isMobile ? 0.9 : 1.0,
    tapDelay: isMobile ? 80 : 80,
    platformFontSize: isMobile ? '24px' : '32px',
    wordFontSize: isMobile ? '24px' : '32px'
};

// ============================================
// SISTEMA DE PONTUAÇÃO
// ============================================

const SCORE_CONFIG = {
    BASE_POINTS: 100,
    STREAK_MULTIPLIER: 0.35,
    MAX_STREAK: 5,
    TIME_BONUS_MIN: 1.0,
    MAX_TIME: 12
};

// ============================================
// 2. GAME DATA
// ============================================

const numbersData = window.EnglishNextLevelNumbersData;
if (!numbersData?.gameData) {
    throw new Error('numbers-data.js must load before numbers-game.js');
}
const gameData = numbersData.gameData;
const numbersScoring = window.EnglishNextLevelNumbersScoring;
if (!numbersScoring?.calculateRoundScore || !numbersScoring?.calculateFinalResult) {
    throw new Error('numbers-scoring.js must load before numbers-game.js');
}
const numbersHighScoreStorage = window.EnglishNextLevelNumbersHighScoreStorage;
if (!numbersHighScoreStorage?.loadScores || !numbersHighScoreStorage?.saveScores) {
    throw new Error('numbers-high-score-storage.js must load before numbers-game.js');
}

// ============================================
// 3. VARIÁVEIS DE ESTADO
// ============================================

let currentGame = 'numbers';
let currentNumbers = [];
let currentNumber = null;
let score = 0;
const NUMBERS_HIGH_SCORE_STORAGE_PREFIX = 'englishNextLevel.numbersHighScores.v1';
const NUMBERS_MODE_IDS = [
    'numbers', 'numbers11-20', 'tens', 'random21_99', 'hundreds',
    'random101_999', 'thousands', 'random1001_9999', 'mixedAdvanced'
];

function createEmptyNumbersHighScores() {
    return numbersHighScoreStorage.createEmptyScores(NUMBERS_MODE_IDS);
}

let highScores = createEmptyNumbersHighScores();
let loadedNumbersHighScoreStorageKey = null;

// NUMBERS scoring source of truth. During a round, `score` is the base score.
// Bonuses are applied only once when the round ends.
let lastNumbersResult = null;
let activeNumbersRun = null;
let numbersRunStartSequence = 0;
let numbersRunStarting = false;
let pendingNumbersResultModalTimer = null;
let numbersResultModalGeneration = 0;

function getNumbersMonotonicTime() {
    return typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();
}

let lives = 3, streak = 0, multiplier = 1, answered = false, availableNumbers = [];
let gameActive = false, gameEnded = false;
let isWaiting = false;

const numbersRunSessionModule = window.EnglishNextLevelNumbersRunSession;
if (!numbersRunSessionModule?.create) {
    throw new Error('numbers-run-session.js must load before numbers-game.js');
}
const numbersRunSession = numbersRunSessionModule.create({
    getClient: () => window.EnglishNextLevelNumbersRunClient,
    getCurrentRun: () => activeNumbersRun,
    getCurrentMode: () => currentGame,
    isGameActive: () => gameActive,
    findNumberByWord: word => Object.values(gameData).flat().find(number => number.word === word),
    logger: console
});

// Keep the correct answer position random, but never let it repeat
// in the same slot more than twice in a row.
let lastCorrectPlatformIndex = null;
let consecutiveCorrectPlatformCount = 0;

// ============================================
// 5. TIMER
// ============================================

let startTime = null, endTime = null, timerInterval = null, currentTime = 0;
let roundStartTime = 0;

// ============================================
// 6. DOM ELEMENTS
// ============================================

const DOM = {
    menu: document.getElementById('menu-container'),
    game: document.getElementById('game-container'),
    canvas: document.getElementById('stickman-canvas'),
    ctx: document.getElementById('stickman-canvas')?.getContext('2d'),
    wordDisplay: document.getElementById('wordDisplay'),
    score: document.getElementById('score'),
    highScore: document.getElementById('highScore'),
    multiplier: document.getElementById('multiplier'),
    timer: document.getElementById('timer'),
    lives: document.getElementById('lives'),
    platforms: document.querySelectorAll('#game-platforms .platform'),
    menuButton: document.getElementById('menu-button'),
    gameSubtitle: document.getElementById('game-subtitle'),
    startButton: document.getElementById('start-game-btn'),
    instructions: document.getElementById('main-instructions'),
    gameStats: document.getElementById('game-stats')
};

// ============================================
// 7. IMAGENS
// ============================================

let eagleImages = { idle: null, flap: [], celebrate: [], wrong: [] };
let menuEagleImage = null;
let eagleSpritesLoaded = false;
const eagleAnimationFactory = window.EnglishNextLevelNumbersEagle;
if (!eagleAnimationFactory?.create) {
    throw new Error('numbers-eagle.js must load before numbers-game.js');
}
const eagleAnimation = eagleAnimationFactory.create({
    canvas: DOM.canvas,
    context: DOM.ctx,
    platforms: DOM.platforms,
    images: eagleImages,
    animationDelay: MOBILE_CONFIG.eagleAnimationDelay,
    jumpSpeed: MOBILE_CONFIG.jumpSpeed,
    getGameActive: () => gameActive,
    getAnswered: () => answered,
    setWaiting(value) { isWaiting = value; },
    nextRound,
    debug: (...args) => window.enlDebug?.(...args)
});

function loadMenuImages() {
    window.enlDebug?.('Loading menu images...');

    eagleImages.idle = new Image();
    eagleImages.idle.src = 'images/flap_01.png';
    eagleImages.idle.onload = () => window.enlDebug?.('✅ Idle image loaded');
    eagleImages.idle.onerror = () => console.error('❌ Failed: images/flap_01.png');

    menuEagleImage = new Image();
    menuEagleImage.src = 'images/flap_01.png';

    menuEagleImage.onload = () => {
        const menuEagle = document.querySelector('#numbers-menu-container .eagle-menu-icon');
        if (menuEagle) {
            menuEagle.innerHTML = '';
            const img = document.createElement('img');
            img.src = menuEagleImage.src;
            img.style.width = '144px';
            img.style.height = '120px';
            img.style.objectFit = 'contain';
            menuEagle.appendChild(img);
        }

        const wordsEagle = document.querySelector('#words-menu-container .eagle-menu-icon');
        if (wordsEagle) {
            wordsEagle.innerHTML = '';
            const img2 = document.createElement('img');
            img2.src = menuEagleImage.src;
            img2.style.width = '144px';
            img2.style.height = '120px';
            img2.style.objectFit = 'contain';
            wordsEagle.appendChild(img2);
        }

        window.enlDebug?.('✅ Menu eagle images loaded');
    };

    menuEagleImage.onerror = () => console.error('❌ Failed to load menu eagle');
}

function loadEagleSprites() {
    if (eagleSpritesLoaded) return;

    window.enlDebug?.('Loading eagle sprites...');

    eagleImages.flap = [];
    eagleImages.celebrate = [];
    eagleImages.wrong = [];

    for (let i = 1; i <= 18; i++) {
        const img = new Image();
        const num = i.toString().padStart(2, '0');
        img.src = `images/flap_${num}.png`;
        img.onerror = () => console.error(`❌ Failed: images/flap_${num}.png`);
        eagleImages.flap.push(img);
    }

    for (let i = 1; i <= 11; i++) {
        const img = new Image();
        const num = i.toString().padStart(2, '0');
        img.src = `images/eagle_center_${num}.png`;
        img.onerror = () => console.error(`❌ Failed: images/eagle_center_${num}.png`);
        eagleImages.celebrate.push(img);
    }

    for (let i = 1; i <= 19; i++) {
        const img = new Image();
        const num = i.toString().padStart(2, '0');
        img.src = `images/eagle_wrong_${num}.png`;
        img.onerror = () => console.error(`❌ Failed: images/eagle_wrong_${num}.png`);
        eagleImages.wrong.push(img);
    }

    eagleSpritesLoaded = true;
    window.enlDebug?.('✅ Eagle sprites loading started');
}


// ============================================
// 7.5. SISTEMA DE PONTUAÇÃO
// ============================================

function calculateRoundScore() {
    const roundTime = (getNumbersMonotonicTime() - roundStartTime) / 1000;
    return numbersScoring.calculateRoundScore({
        streak,
        roundTime,
        config: SCORE_CONFIG,
        timeBonusMax: MOBILE_CONFIG.timeBonusMax,
        perfectTime: MOBILE_CONFIG.perfectTime
    });
}

const numbersRoundFeedbackModule = window.EnglishNextLevelNumbersRoundFeedback;
if (!numbersRoundFeedbackModule?.create) {
    throw new Error('numbers-round-feedback.js must load before numbers-game.js');
}
const numbersRoundFeedback = numbersRoundFeedbackModule.create({ document });

function showNumbersRoundFeedback(type, title, copy) {
    numbersRoundFeedback.show(type, title, copy);
}

function clearNumbersRoundFeedback() {
    numbersRoundFeedback.clear();
}

function showScorePopup(points, timeBonus) {
    numbersRoundFeedback.showScore(points, timeBonus);
}

function showWrongPopup() {
    numbersRoundFeedback.showWrong();
}

// ============================================
// 8. ÁUDIO
// ============================================

// Audio engines are loaded from js/audio-engines.js before this file.

// IMPORTANTE: Chrome recomenda "click" para user activation de áudio.
// Usamos capture para liberar o contexto antes dos handlers do jogo executarem.
function primeSfxOnRealUserGesture() {
    ProgrammaticSfxEngine.primeFromUserGesture();
}

document.addEventListener('click', primeSfxOnRealUserGesture, { capture: true });
document.addEventListener('touchend', primeSfxOnRealUserGesture, { capture: true, passive: true });

function playSound(type) {
    const volume = getGlobalSfxVolume() / 100;
    if (volume <= 0) return;
    ProgrammaticSfxEngine.play(type, volume);
}

// API compartilhada consumida pelos módulos de TOPICS.
window.EnglishNextLevelAudio = {
    getVoiceVolume: getGlobalVoiceVolume,
    setVoiceVolume: setGlobalVoiceVolume,
    getVoiceRate: getGlobalVoiceRate,
    setVoiceRate: setGlobalVoiceRate,
    getSfxVolume: getGlobalSfxVolume,
    setSfxVolume: setGlobalSfxVolume,
    getVolumeIcon: getAudioVolumeIcon,
    playSfx: playSound,
    // Chamado pelos botões START. Como START é um clique/toque real, executamos
    // start() de um source node imediatamente, em vez de depender só de resume().
    unlockSfx: () => ProgrammaticSfxEngine.primeFromUserGesture(),
    syncSettingsUI: updateGlobalAudioSettingsUI,
    getSfxEngineState: () => ProgrammaticSfxEngine.getState()
};

function playAudio() {
    if (!currentNumber || !gameActive) return;

    const voiceVolume = getGlobalVoiceVolume();
    if (voiceVolume <= 0) return;

    // NUMBERS usa o mesmo volume global de voz usado por WORDS e TOPICS.
    EnglishSpeechEngine.speak(currentNumber.word, {
        lang: 'en-US',
        volume: voiceVolume / 100
    });
}

// ============================================
// 9. FUNÇÕES DO LEADERBOARD
// ============================================

const numbersLeaderboardModule = window.EnglishNextLevelNumbersLeaderboard;
if (!numbersLeaderboardModule?.create) {
    throw new Error('numbers-leaderboard.js must load before numbers-game.js');
}
const numbersLeaderboard = numbersLeaderboardModule.create({ document, logger: console });
const escapeHtml = numbersLeaderboard.escapeHtml;
const saveToLeaderboard = numbersLeaderboard.saveToLeaderboard;

function showLeaderboardModal() {
    return numbersLeaderboard.showModal();
}

// ============================================
// 10. ANIMAÇÃO DA ÁGUIA
// ============================================

function startAnimation(type) {
    eagleAnimation.startAnimation(type);
}

function stopAnimation() {
    eagleAnimation.stopAnimation();
}

function jumpToPlatform(idx) {
    eagleAnimation.jumpToPlatform(idx);
}

function resetEagle() {
    eagleAnimation.reset();
}

// ============================================
// 11. GAME MECÂNICAS
// ============================================

function handlePlatformClick(e) {
    const btn = e.currentTarget, idx = parseInt(btn.dataset.index);
    if (!gameActive || answered || !currentNumber || isWaiting) return;

    const selectedValue = parseInt(btn.dataset.value);
    const wasCorrect = selectedValue === currentNumber.value;
    const run = activeNumbersRun?.valid ? activeNumbersRun : null;
    const runQuestionIndex = run?.questionIndex;
    if (run) {
        numbersRunSession.queueAnswer(run, runQuestionIndex, selectedValue, wasCorrect);
        if (wasCorrect) run.questionIndex++;
    }

    if (wasCorrect) {
        const roundScore = calculateRoundScore();
        streak++;
        multiplier = Math.min(streak, SCORE_CONFIG.MAX_STREAK);
        score += roundScore.total;

        btn.classList.add('correct');
        updateScore();
        updateMultiplier();
        playSound('correct');
        showScorePopup(roundScore.total, roundScore.timeBonus);

        answered = true;
        DOM.platforms.forEach(p => p.disabled = true);

        // Always animate the answer, including a vertical jump when the
        // correct platform is the center one.
        jumpToPlatform(idx);
    } else {
        btn.classList.add('wrong');
        streak = 0;
        multiplier = 1;
        updateMultiplier();
        playSound('wrong');
        startAnimation('wrong');
        loseLife();
        showWrongPopup();
        setTimeout(() => btn.classList.remove('wrong'), 300);
    }
}

function startTimer() {
    startTime = getNumbersMonotonicTime();
    timerInterval = setInterval(() => {
        if (gameActive) {
            currentTime = Math.floor((getNumbersMonotonicTime() - startTime) / 1000);
            if (DOM.timer) {
                let mins = Math.floor(currentTime / 60);
                let secs = currentTime % 60;
                DOM.timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
        }
    }, MOBILE_CONFIG.timerInterval);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    endTime = currentTime;
}

function updateMultiplier() { if (DOM.multiplier) DOM.multiplier.textContent = `${multiplier}x`; }
function updateScore() { if (DOM.score) DOM.score.textContent = score; }

function updateLives() {
    if (!DOM.lives) return;
    DOM.lives.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        let circle = document.createElement('span');
        circle.className = `life-circle ${i < lives ? 'full' : 'empty'}`;
        DOM.lives.appendChild(circle);
    }
}

function getNumbersHighScoreStorageKey() {
    if (!window.isGuest && window.currentUser?.uid) {
        return `${NUMBERS_HIGH_SCORE_STORAGE_PREFIX}.user.${window.currentUser.uid}`;
    }
    if (window.isGuest) {
        return `${NUMBERS_HIGH_SCORE_STORAGE_PREFIX}.guest`;
    }
    return `${NUMBERS_HIGH_SCORE_STORAGE_PREFIX}.local`;
}

function loadNumbersHighScoresForCurrentProfile(force = false) {
    const storageKey = getNumbersHighScoreStorageKey();
    if (!force && loadedNumbersHighScoreStorageKey === storageKey) return highScores;

    highScores = numbersHighScoreStorage.loadScores(() => localStorage, storageKey, NUMBERS_MODE_IDS);
    loadedNumbersHighScoreStorageKey = storageKey;
    return highScores;
}

function loadNumbersHighScoresForStorageKey(storageKey) {
    return numbersHighScoreStorage.loadScores(() => localStorage, storageKey, NUMBERS_MODE_IDS);
}

function saveNumbersHighScoreForStorageKey(storageKey, gameMode, finalScoreCandidate) {
    if (!NUMBERS_MODE_IDS.includes(gameMode) || !Number.isFinite(finalScoreCandidate)) return false;
    const profileScores = loadNumbersHighScoresForStorageKey(storageKey);
    const nextBest = Math.max(0, Math.floor(finalScoreCandidate));
    if (nextBest <= (profileScores[gameMode] || 0)) return true;
    profileScores[gameMode] = nextBest;
    return numbersHighScoreStorage.saveScores(() => localStorage, storageKey, profileScores);
}

function persistNumbersHighScores() {
    const storageKey = getNumbersHighScoreStorageKey();
    loadedNumbersHighScoreStorageKey = storageKey;
    return numbersHighScoreStorage.saveScores(() => localStorage, storageKey, highScores);
}

function syncNumbersMenuBestScores() {
    loadNumbersHighScoresForCurrentProfile();
    document.querySelectorAll('#numbers-menu-container [data-numbers-mode]').forEach(card => {
        const modeId = card.dataset.numbersMode;
        const value = card.querySelector('.best-score-value');
        if (!modeId || !value) return;
        value.textContent = formatNumbersScore(highScores[modeId] || 0);
    });
}

function invalidateUnconfirmedNumbersResult() {
    if (!lastNumbersResult?.isNewBest) return;
    lastNumbersResult.isNewBest = false;
    document.querySelector('.numbers-result-best')?.remove();
}

function setNumbersHighScoresFromProgress(scores = {}, { invalidateUnconfirmedResult: invalidateResult = false } = {}) {
    NUMBERS_MODE_IDS.forEach(modeId => {
        highScores[modeId] = Math.max(0, Math.floor(Number(scores[modeId]) || 0));
    });
    loadedNumbersHighScoreStorageKey = getNumbersHighScoreStorageKey();
    if (invalidateResult) invalidateUnconfirmedNumbersResult();
    syncNumbersMenuBestScores();
    if (DOM.highScore) DOM.highScore.textContent = formatNumbersScore(highScores[currentGame] || 0);
}

function updateHighScore(finalScoreCandidate = null, gameMode = currentGame) {
    loadNumbersHighScoresForCurrentProfile();

    if (Number.isFinite(finalScoreCandidate) && finalScoreCandidate > (highScores[gameMode] || 0)) {
        const previousBest = highScores[gameMode] || 0;
        highScores[gameMode] = Math.max(0, Math.floor(finalScoreCandidate));
        const savedLocally = persistNumbersHighScores();
        syncNumbersMenuBestScores();
        const savedToProgress = window.EnglishNextLevelProgress?.recordNumbersBest?.(
            gameMode,
            highScores[gameMode]
        );
        if (!savedLocally && savedToProgress !== true) {
            highScores[gameMode] = previousBest;
            persistNumbersHighScores();
            syncNumbersMenuBestScores();
            invalidateUnconfirmedNumbersResult();
        }
    }

    if (DOM.highScore && gameMode === currentGame) {
        DOM.highScore.textContent = formatNumbersScore(highScores[currentGame] || 0);
    }

    return highScores[gameMode] || 0;
}

function calculateNumbersFinalResult() {
    const totalGameTime = Math.max(0, endTime ?? currentTime ?? 0);
    return numbersScoring.calculateFinalResult({
        baseScore: score,
        totalGameTime,
        livesRemaining: lives
    });
}

function gameOver() {
    if (gameEnded) return;

    gameActive = false;
    gameEnded = true;
    numbersRunSession.invalidate(activeNumbersRun);
    activeNumbersRun = null;
    stopTimer();
    playSound('gameOver');
    DOM.platforms.forEach(p => p.disabled = true);

    const completedResult = calculateNumbersFinalResult();
    lastNumbersResult = {
        ...completedResult,
        isNewBest: false,
        completedMode: currentGame,
        won: false
    };

    if (DOM.wordDisplay) DOM.wordDisplay.textContent = 'GAME OVER';

    scheduleNumbersResultModal(lastNumbersResult, { won: false });
}

async function winGame() {
    if (gameEnded) return;

    const resultUiSequence = numbersRunStartSequence;
    gameActive = false;
    gameEnded = true;
    stopTimer();

    let completedResult = calculateNumbersFinalResult();
    let completedGameMode = currentGame;
    let leaderboardRunId = null;
    const run = activeNumbersRun?.valid ? activeNumbersRun : null;
    const resultOwnerStorageKey = run?.profileStorageKey || getNumbersHighScoreStorageKey();

    if (run) {
        if (DOM.instructions) DOM.instructions.textContent = 'Checking your final score...';
        try {
            const finishedRun = await numbersRunSession.finish(run);
            if (!finishedRun) return;
            completedResult = finishedRun.result;
            completedGameMode = finishedRun.mode;
            leaderboardRunId = finishedRun.runId;
        } catch (error) {
            if (activeNumbersRun !== run) return;
            if (resultUiSequence !== numbersRunStartSequence) {
                numbersRunSession.invalidate(run);
                activeNumbersRun = null;
                return;
            }
            console.warn('Numbers run final score could not be verified; keeping this score on this device.', error);
        }
        if (activeNumbersRun === run) activeNumbersRun = null;
    } else {
        activeNumbersRun = null;
    }

    const isResultOwnerCurrentProfile = resultOwnerStorageKey === getNumbersHighScoreStorageKey();
    let ownerHighScores;
    if (isResultOwnerCurrentProfile) {
        loadNumbersHighScoresForCurrentProfile();
        ownerHighScores = highScores;
    } else {
        ownerHighScores = loadNumbersHighScoresForStorageKey(resultOwnerStorageKey);
    }
    const previousHighScore = ownerHighScores[completedGameMode] || 0;
    const isNewBest = completedResult.finalScore > previousHighScore;

    lastNumbersResult = {
        ...completedResult,
        isNewBest,
        previousHighScore,
        completedMode: completedGameMode,
        leaderboardRunId,
        won: true
    };

    if (isResultOwnerCurrentProfile) {
        updateHighScore(completedResult.finalScore, completedGameMode);
    } else {
        saveNumbersHighScoreForStorageKey(resultOwnerStorageKey, completedGameMode, completedResult.finalScore);
    }
    window.enlDebug?.('🏆 NUMBERS final result:', lastNumbersResult);

    if (resultUiSequence !== numbersRunStartSequence || !isResultOwnerCurrentProfile) return;

    playSound('win');
    DOM.platforms.forEach(p => p.disabled = true);

    scheduleNumbersResultModal(lastNumbersResult, { won: true });
}

function loseLife() {
    if (lives > 0) {
        lives--;
        updateLives();
        if (lives === 0) gameOver();
    }
}

async function nextRound() {
    if (!gameActive) return;
    const run = activeNumbersRun?.valid ? activeNumbersRun : null;
    if ((run && run.questionIndex >= run.questionCount) || (!run && availableNumbers.length === 0)) {
        winGame();
        return;
    }

    // Keep the eagle on the platform of the previous correct answer.
    // It moves again only after the player gets another answer right.
    // resetEagle() is reserved for a new game / leaving the gameplay.
    clearNumbersRoundFeedback();

    const runQuestionIndex = run?.questionIndex;
    let rand = run ? -1 : Math.floor(Math.random() * availableNumbers.length);
    let nextNumber = run ? null : availableNumbers[rand];

    isWaiting = true;
    DOM.platforms.forEach(platform => { platform.disabled = true; });
    if (run) {
        await numbersRunSession.startQuestion(run, runQuestionIndex);
        if (!gameActive || activeNumbersRun !== run) return;
        if (run.valid) {
            nextNumber = run.questions[runQuestionIndex];
            run.shownQuestionValues.add(nextNumber.value);
            const matchingLocalIndex = availableNumbers.findIndex(number => number.value === nextNumber.value);
            if (matchingLocalIndex >= 0) availableNumbers.splice(matchingLocalIndex, 1);
        } else {
            const shownValues = run.shownQuestionValues;
            const remainingQuestionCount = Math.max(0, run.questionCount - run.questionIndex);
            const fallbackNumbers = availableNumbers.filter(number => !shownValues.has(number.value));
            const fallbackValues = new Set(fallbackNumbers.map(number => number.value));

            // If the local sample is exhausted by questions already shown remotely,
            // fill only the remaining slots with other unseen numbers from this mode.
            for (const number of currentNumbers) {
                if (fallbackNumbers.length >= remainingQuestionCount) break;
                if (shownValues.has(number.value) || fallbackValues.has(number.value)) continue;
                fallbackNumbers.push(number);
                fallbackValues.add(number.value);
            }

            availableNumbers = fallbackNumbers.slice(0, remainingQuestionCount);
            rand = availableNumbers.length > 0
                ? Math.floor(Math.random() * availableNumbers.length)
                : -1;
            nextNumber = availableNumbers[rand] || null;
        }
    }
    if (!gameActive || (run && activeNumbersRun !== run)) return;
    if (!nextNumber) {
        winGame();
        return;
    }

    currentNumber = nextNumber;
    if (!run || !run.valid) availableNumbers.splice(rand, 1);
    if (DOM.wordDisplay) DOM.wordDisplay.textContent = currentNumber.word;
    setupPlatforms();
    answered = false;
    isWaiting = false;
    stopAnimation();
    DOM.platforms.forEach(p => {
        p.classList.remove('correct', 'wrong');
        p.disabled = false;
    });

    roundStartTime = getNumbersMonotonicTime();
    if (startTime === null) startTimer();
    setTimeout(playAudio, MOBILE_CONFIG.tapDelay);
}

function setupPlatforms() {
    const correctValue = currentNumber.value;

    const runQuestion = activeNumbersRun?.valid
        ? activeNumbersRun.questions[activeNumbersRun.questionIndex]
        : null;
    if (runQuestion && runQuestion.value === correctValue) {
        DOM.platforms.forEach((platform, index) => {
            platform.textContent = runQuestion.options[index];
            platform.dataset.value = runQuestion.options[index];
        });
        return;
    }

    const possibleValues = currentNumbers
        .map(n => n.value)
        .filter(value => value !== correctValue);

    // Choose the slot for the correct answer. All three positions remain
    // equally eligible unless one has already been used twice in a row.
    let allowedCorrectIndexes = [0, 1, 2];
    if (lastCorrectPlatformIndex !== null && consecutiveCorrectPlatformCount >= 2) {
        allowedCorrectIndexes = allowedCorrectIndexes.filter(index => index !== lastCorrectPlatformIndex);
    }

    const correctIndex = allowedCorrectIndexes[
        Math.floor(Math.random() * allowedCorrectIndexes.length)
    ];

    if (correctIndex === lastCorrectPlatformIndex) {
        consecutiveCorrectPlatformCount++;
    } else {
        lastCorrectPlatformIndex = correctIndex;
        consecutiveCorrectPlatformCount = 1;
    }

    // Pick two unique distractors, then place the correct answer directly
    // in its selected slot instead of shuffling all three afterward.
    const distractors = [];
    while (distractors.length < 2 && possibleValues.length > 0) {
        const randomIndex = Math.floor(Math.random() * possibleValues.length);
        const [randomValue] = possibleValues.splice(randomIndex, 1);
        if (!distractors.includes(randomValue)) distractors.push(randomValue);
    }

    const options = new Array(3);
    options[correctIndex] = correctValue;
    let distractorIndex = 0;
    for (let i = 0; i < options.length; i++) {
        if (i !== correctIndex) {
            options[i] = distractors[distractorIndex++];
        }
    }

    DOM.platforms.forEach((p, i) => {
        p.textContent = options[i];
        p.dataset.value = options[i];
    });
}

function formatNumbersResultTime(totalSeconds = 0) {
    const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatNumbersScore(value = 0) {
    return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');
}

function getDefaultLeaderboardName() {
    const storedName = String(window.currentUserName || '').trim();
    if (storedName && storedName.toLowerCase() !== 'guest') return storedName.slice(0, 20);

    const displayName = String(window.currentUser?.displayName || '').trim();
    if (displayName) return displayName.slice(0, 20);

    if (!window.isGuest && window.currentUser?.email) {
        return String(window.currentUser.email).split('@')[0].slice(0, 20);
    }

    return '';
}

function createNumbersResultDialog() {
    const dialogModule = window.EnglishNextLevelNumbersResultDialog;
    if (!dialogModule) return null;

    return dialogModule.create({
        document,
        escapeHtml,
        formatTime: formatNumbersResultTime,
        formatScore: formatNumbersScore,
        getPlayerName: getDefaultLeaderboardName,
        getCurrentGame: () => currentGame,
        saveToLeaderboard,
        client: window.EnglishNextLevelLeaderboardClient,
        onRestart: startGame,
        onBack: showMenu,
        removeWinScreen,
        removeRestartButton,
        logger: console
    });
}

function removeNumbersResultModal() {
    cancelPendingNumbersResultModal();
    const dialogModule = window.EnglishNextLevelNumbersResultDialog;
    if (dialogModule) {
        dialogModule.create({ document }).remove();
        return;
    }
    document.querySelector('.numbers-result-modal')?.remove();
}

function leaveNumbersGameScreen() {
    numbersRunStartSequence++;
    numbersRunStarting = false;
    const isFinishingVerifiedRun = gameEnded && activeNumbersRun;
    if (!isFinishingVerifiedRun) {
        numbersRunSession.invalidate(activeNumbersRun);
        activeNumbersRun = null;
    }
    gameActive = false;
    gameEnded = false;
    answered = false;
    isWaiting = false;

    stopTimer();
    EnglishSpeechEngine.stop();
    removeNumbersResultModal();
    removeWinScreen();
    removeRestartButton();
    clearNumbersRoundFeedback();
    resetEagle();

    score = 0;
    lives = 3;
    streak = 0;
    multiplier = 1;
    startTime = null;
    endTime = null;
    currentTime = 0;
    lastNumbersResult = null;
    updateScore();
    updateMultiplier();
    updateLives();

    if (DOM.timer) DOM.timer.textContent = '00:00';
    if (DOM.wordDisplay) DOM.wordDisplay.textContent = 'Ready?';
    if (DOM.instructions) DOM.instructions.textContent = 'Press START to begin';
    if (DOM.gameStats) DOM.gameStats.style.display = 'grid';
    if (DOM.startButton) {
        DOM.startButton.style.display = 'block';
        DOM.startButton.classList.remove('is-running-placeholder');
        DOM.startButton.disabled = false;
    }
    DOM.platforms.forEach(platform => {
        platform.disabled = true;
        platform.classList.remove('correct', 'wrong');
    });
    DOM.game?.classList.remove('game-active');
}

window.EnglishNextLevelNumbersResultLifecycle = Object.freeze({
    leaveScreen: leaveNumbersGameScreen
});

function showNumbersResultModal(result = lastNumbersResult, options = {}) {
    if (!result) return;

    const dialog = createNumbersResultDialog();
    if (!dialog) {
        console.error('NUMBERS: result dialog module is unavailable.');
        return;
    }
    dialog.show(result, options);
}

function cancelPendingNumbersResultModal() {
    numbersResultModalGeneration++;
    if (pendingNumbersResultModalTimer === null) return;
    clearTimeout(pendingNumbersResultModalTimer);
    pendingNumbersResultModalTimer = null;
}

function scheduleNumbersResultModal(result, options) {
    cancelPendingNumbersResultModal();
    const generation = numbersResultModalGeneration;
    pendingNumbersResultModalTimer = setTimeout(() => {
        if (generation !== numbersResultModalGeneration) return;
        pendingNumbersResultModalTimer = null;
        if (lastNumbersResult !== result) return;
        showNumbersResultModal(result, options);
    }, 450);
}

function showMenu() {
    removeNumbersResultModal();
    numbersRunStartSequence++;
    numbersRunStarting = false;
    numbersRunSession.invalidate(activeNumbersRun);
    activeNumbersRun = null;
    gameActive = false;
    EnglishSpeechEngine.stop();
    stopTimer();
    removeWinScreen();
    removeRestartButton();
    resetEagle();
    clearNumbersRoundFeedback();

    DOM.platforms.forEach(p => {
        p.textContent = '?';
        p.disabled = true;
        p.classList.remove('correct', 'wrong');
    });
    if (DOM.wordDisplay) DOM.wordDisplay.textContent = 'Ready?';
    if (DOM.instructions) DOM.instructions.textContent = 'Press START to begin';
    if (DOM.gameStats) DOM.gameStats.style.display = 'grid';
    if (DOM.startButton) {
        DOM.startButton.style.display = 'block';
        DOM.startButton.classList.remove('is-running-placeholder');
        DOM.startButton.disabled = false;
    }
    DOM.game.classList.remove('game-active');

    // Important: return through the same navigation system used by the regular
    // Back button. Manually showing the menu left currentScreen/history on
    // numbersGame, so clicking a game was ignored as "already on this screen".
    if (currentScreen === SCREENS.NUMBERS_GAME) {
        goBack();
        return;
    }

    // Defensive fallback for restored/legacy history states.
    showScreen(SCREENS.NUMBERS_MENU);
    currentScreen = SCREENS.NUMBERS_MENU;
    navigationStack = navigationStack.filter(screen => screen !== SCREENS.NUMBERS_GAME);
    replaceCurrentBrowserState(SCREENS.NUMBERS_MENU);
}

function removeRestartButton() { document.querySelector('.restart-btn')?.remove(); }
function removeWinScreen() { document.querySelector('.win-screen')?.remove(); }

function addRestartButton() {
    removeRestartButton();
    removeWinScreen();
    let btn = document.createElement('button');
    btn.className = 'restart-btn';
    btn.textContent = 'PLAY AGAIN';
    btn.addEventListener('click', () => {
        btn.remove();
        showMenu();
    });
    DOM.game.appendChild(btn);
}

function resetGame() {
    cancelPendingNumbersResultModal();
    clearNumbersRoundFeedback();
    const shuffled = [...currentNumbers];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const questionCount = activeNumbersRun?.valid ? activeNumbersRun.questionCount : 10;
    availableNumbers = shuffled.slice(0, Math.min(questionCount, shuffled.length));
    if (activeNumbersRun?.valid) {
        activeNumbersRun.questionIndex = 0;
        activeNumbersRun.pendingAnswers = Promise.resolve();
        activeNumbersRun.pendingQuestionStart = Promise.resolve();
    }

    window.enlDebug?.(`🔄 Reset game: ${currentGame}`);
    window.enlDebug?.(`   Total numbers available: ${currentNumbers.length}`);
    window.enlDebug?.(`   Questions in this game: ${availableNumbers.length}`);
    if (availableNumbers.length > 0) {
        window.enlDebug?.(`   First question: ${availableNumbers[0].value} - ${availableNumbers[0].word}`);
    }

    score = 0;
    lives = 3;
    streak = 0;
    multiplier = 1;
    gameEnded = false;
    answered = false;
    lastNumbersResult = null;

    // Start each new game with a fresh answer-position history.
    lastCorrectPlatformIndex = null;
    consecutiveCorrectPlatformCount = 0;

    // A new game must never inherit timing data from the previous round.
    startTime = null;
    endTime = null;
    currentTime = 0;
    roundStartTime = 0;
    if (DOM.timer) DOM.timer.textContent = '00:00';

    updateScore();
    updateMultiplier();
    updateLives();

    removeRestartButton();
    removeWinScreen();
    resetEagle();

    nextRound();
}

async function startGame() {
    // START é uma interação explícita do usuário e é o melhor ponto para
    // preparar a saída de voz em navegadores móveis.
    // WORDS TTS is activated directly by the user's tap on the pronunciation button.
    ProgrammaticSfxEngine.primeFromUserGesture();

    if (!DOM.game || gameActive || numbersRunStarting) {
        if (!DOM.game) console.error("DOM.game não encontrado!");
        return;
    }

    numbersRunStarting = true;
    const requestSequence = ++numbersRunStartSequence;
    const profileStorageKey = getNumbersHighScoreStorageKey();
    activeNumbersRun = null;
    gameActive = true;
    DOM.game.classList.add('game-active');
    if (DOM.startButton) {
        DOM.startButton.style.display = 'block';
        DOM.startButton.classList.add('is-running-placeholder');
        DOM.startButton.disabled = true;
    }
    if (DOM.gameStats) DOM.gameStats.style.display = 'grid';
    if (DOM.instructions) DOM.instructions.textContent = 'Preparing your round...';

    try {
        const client = window.EnglishNextLevelNumbersRunClient;
        if (client?.canSubmitGlobally()) {
            try {
                const serverRun = await client.start(currentGame);
                if (requestSequence !== numbersRunStartSequence || !gameActive) return;
                if (profileStorageKey !== getNumbersHighScoreStorageKey()) {
                    leaveNumbersGameScreen();
                    return;
                }
                const preparedRun = numbersRunSession.prepare(serverRun);
                if (!preparedRun) throw new Error('The server questions do not match this Numbers mode.');
                preparedRun.profileStorageKey = profileStorageKey;
                activeNumbersRun = preparedRun;
            } catch (error) {
                console.warn('Could not start a verified Numbers run; this round will be saved on this device.', error);
            }
        }

        if (requestSequence !== numbersRunStartSequence || !gameActive) return;
        if (DOM.instructions) DOM.instructions.textContent = 'Choose the matching number';
        resetGame();
    } finally {
        if (requestSequence === numbersRunStartSequence) numbersRunStarting = false;
    }
}




// ============================================
// 12. SELEÇÃO DE JOGO
// ============================================

window.selectGame = function(gameType) {
    numbersRunStartSequence++;
    numbersRunStarting = false;
    numbersRunSession.invalidate(activeNumbersRun);
    activeNumbersRun = null;
    currentGame = gameType;

    const modeLabelMap = {
        'numbers': 'Numbers 1–10',
        'numbers11-20': 'Numbers 11–20',
        'tens': 'Tens',
        'hundreds': 'Hundreds',
        'thousands': 'Thousands',
        'random21_99': 'Numbers 21–99',
        'random101_999': 'Numbers 101–999',
        'random1001_9999': 'Numbers 1,001–9,999',
        'mixedAdvanced': 'Mixed Advanced'
    };
    const navSubtitle = document.getElementById('game-subtitle');
    if (navSubtitle) navSubtitle.textContent = modeLabelMap[gameType] || 'Numbers';

    const modeMap = {
        'numbers': gameData.numbers,
        'numbers11-20': gameData.numbers11_20,
        'tens': gameData.tens,
        'hundreds': gameData.hundreds,
        'thousands': gameData.thousands,
        'random21_99': gameData.random21_99,
        'random101_999': gameData.random101_999,
        'random1001_9999': gameData.random1001_9999,
        'mixedAdvanced': gameData.mixedAdvanced
    };

    currentNumbers = modeMap[gameType] || gameData.numbers;

    window.enlDebug?.(`📊 Game mode: ${gameType} - ${currentNumbers.length} numbers available`);

    loadNumbersHighScoresForCurrentProfile();
    const currentHighScore = highScores[gameType] || 0;
    if (DOM.highScore) DOM.highScore.textContent = formatNumbersScore(currentHighScore);

    // Stable Ready state: initialize visible HUD values without creating a round.
    score = 0;
    lives = 3;
    streak = 0;
    multiplier = 1;
    startTime = null;
    endTime = null;
    currentTime = 0;
    roundStartTime = 0;
    updateScore();
    updateMultiplier();
    updateLives();
    if (DOM.timer) DOM.timer.textContent = '00:00';

    gameActive = false;
    stopTimer();
    removeWinScreen();
    removeRestartButton();
    removeNumbersResultModal();
    resetEagle();

    if (DOM.platforms) {
        DOM.platforms.forEach(p => {
            p.textContent = '?';
            p.disabled = true;
            p.classList.remove('correct', 'wrong');
        });
    }

    if (DOM.wordDisplay) DOM.wordDisplay.textContent = 'Ready?';
    if (DOM.instructions) DOM.instructions.textContent = 'Press START to begin';
    if (DOM.gameStats) DOM.gameStats.style.display = 'grid';
    if (DOM.startButton) {
        DOM.startButton.style.display = 'block';
        DOM.startButton.classList.remove('is-running-placeholder');
        DOM.startButton.disabled = false;
    }

    if (DOM.game) {
        DOM.game.classList.remove('game-active');
    }
};

// ============================================
// 13. INICIAR O JOGO
// ============================================

function initGame() {
    window.enlDebug?.('Game starting...');

    document.querySelectorAll('#numbers-menu-container [data-numbers-mode]').forEach(card => {
        card.addEventListener('click', () => startNumberGame(card.dataset.numbersMode));
    });

    if (DOM.canvas) {
        DOM.canvas.width = 500;
        DOM.canvas.height = 250;
    }

    loadMenuImages();

    if (DOM.menuButton) {
        DOM.menuButton.removeEventListener('click', showMenu);
        DOM.menuButton.addEventListener('click', () => {
            window.enlDebug?.("🏠 Botão voltar clicado no jogo");
            showMenu();
        });
    }

    DOM.startButton?.addEventListener('click', startGame);
    DOM.platforms.forEach(p => p.addEventListener('click', handlePlatformClick));

    const leaderboardBtn = document.getElementById('global-rankings-btn');
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', () => {
            window.enlDebug?.("Botão Rankings clicado!");
            showLeaderboardModal();
        });
    }

	updateGameUserName();

    initNavigation();
    eagleAnimation.startLoop();
}

window.addEventListener('load', () => {
    initWordsSettings();
    setTimeout(() => {
        initGame();
    }, 100);
});
