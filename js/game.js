// ============================================
// 1. CONFIGURAÇÕES GLOBAIS
// ============================================

const ScreenManager = {
  setScreen(screenName) {
    document.body.setAttribute('data-screen', screenName);
    console.log(`🖥️ Tela alterada para: ${screenName}`);
  }
};

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const MOBILE_CONFIG = {
    eagleAnimationDelay: isMobile ? 45 : 50,
    jumpSpeed: isMobile ? 0.018 : 0.015,
    horizontalEasing: isMobile ? 0.15 : 0.15,
    timerInterval: isMobile ? 300 : 200,
    timeBonusMax: isMobile ? 2.3 : 2.5,
    perfectTime: isMobile ? 3.0 : 2.5,
    reduceAnimations: false,
    disableParticles: isMobile,
    canvasScale: isMobile ? 0.9 : 1.0,
    tapDelay: isMobile ? 80 : 80,
    platformFontSize: isMobile ? '24px' : '32px',
    wordFontSize: isMobile ? '24px' : '32px'
};

const JUMP_SPEED = MOBILE_CONFIG.jumpSpeed;
const HORIZONTAL_EASING = MOBILE_CONFIG.horizontalEasing;
let lastAnimationFrame = 0;
const EAGLE_ANIMATION_DELAY = MOBILE_CONFIG.eagleAnimationDelay;

// ============================================
// SISTEMA DE NAVEGAÇÃO EM PILHA
// ============================================

let navigationStack = []; // Pilha de telas visitadas
let currentScreen = null;

const SCREENS = {
    LOGIN: 'login',
    CATEGORIES: 'categories',
    NUMBERS_MENU: 'numbersMenu',
    NUMBERS_GAME: 'numbersGame',
    WORDS_MENU: 'wordsMenu',
    WORDS_SUBMENU: 'wordsSubmenu',
    WORDS_SUBMENU_PAST: 'wordsSubmenuPast',
    WORDS_GAME: 'wordsGame'
};


// Função para mostrar a tela
// Função para mostrar a tela

function showScreen(screen, options = {}) {
    // Só esconde o auth-container se não for a tela de login
    if (!window.currentUser && !window.isGuest && screen !== SCREENS.LOGIN) {
        screen = SCREENS.LOGIN;
    }
    
    ScreenManager.setScreen(screen);
    ScreenManager.setScreen(screen);

    console.log(`📱 Mostrando tela: ${screen}`);
    
    const auth = document.getElementById('auth-container');
    const category = document.getElementById('category-container');
    const numbersMenu = document.getElementById('numbers-menu-container');
    const game = document.getElementById('game-container');
    const vocab = document.getElementById('vocab-game-container');
    const wordsMenu = document.getElementById('words-menu-container');
    const simpleVerbsSubmenu = document.getElementById('simple-verbs-submenu');
    const simpleVerbsPastSubmenu = document.getElementById('simple-verbs-past-submenu'); // ADICIONE ESTA LINHA
    const simpleVerbsBtn = document.getElementById('simple-verbs-btn');
    const simpleVerbsPastBtn = document.getElementById('simple-verbs-past-btn'); // ADICIONE ESTA LINHA
    
    // Esconde todas
    if (auth) auth.style.display = 'none';
    if (category) category.style.display = 'none';
    if (numbersMenu) numbersMenu.style.display = 'none';
    if (game) game.style.display = 'none';
    if (vocab) vocab.style.display = 'none';
    if (wordsMenu) wordsMenu.style.display = 'none';
    if (simpleVerbsSubmenu) simpleVerbsSubmenu.style.display = 'none';
    if (simpleVerbsPastSubmenu) simpleVerbsPastSubmenu.style.display = 'none'; // ADICIONE ESTA LINHA
    
    // Mostra a tela escolhida
    switch(screen) {
        case SCREENS.LOGIN:
            if (auth) auth.style.display = 'block';
            break;
            
        case SCREENS.CATEGORIES:
            if (category) category.style.display = 'block';
            const catBtns = document.querySelector('.category-buttons');
            if (catBtns) catBtns.style.display = 'flex';
            break;
            
        case SCREENS.NUMBERS_MENU:
            if (numbersMenu) numbersMenu.style.display = 'block';
            break;
            
        case SCREENS.NUMBERS_GAME:
            if (game) game.style.display = 'block';
            if (options.gameType) window.selectGame(options.gameType);
            break;
            
        case SCREENS.WORDS_MENU:
            if (wordsMenu) wordsMenu.style.display = 'block';
            if (simpleVerbsBtn) simpleVerbsBtn.style.display = 'block';
            if (simpleVerbsPastBtn) simpleVerbsPastBtn.style.display = 'block';
            if (simpleVerbsSubmenu) simpleVerbsSubmenu.style.display = 'none';
            if (simpleVerbsPastSubmenu) simpleVerbsPastSubmenu.style.display = 'none';
            ScreenManager.setScreen('words');
            break;

        case SCREENS.WORDS_SUBMENU:
            if (wordsMenu) wordsMenu.style.display = 'block';
            if (simpleVerbsBtn) simpleVerbsBtn.style.display = 'none';
            if (simpleVerbsPastBtn) simpleVerbsPastBtn.style.display = 'block';
            if (simpleVerbsSubmenu) simpleVerbsSubmenu.style.display = 'block';
            if (simpleVerbsPastSubmenu) simpleVerbsPastSubmenu.style.display = 'none';
            break;

        case SCREENS.WORDS_SUBMENU_PAST:
            if (wordsMenu) wordsMenu.style.display = 'block';
            if (simpleVerbsBtn) simpleVerbsBtn.style.display = 'block';
            if (simpleVerbsPastBtn) simpleVerbsPastBtn.style.display = 'none';
            if (simpleVerbsSubmenu) simpleVerbsSubmenu.style.display = 'none';
            if (simpleVerbsPastSubmenu) simpleVerbsPastSubmenu.style.display = 'block';
            break;
            
        case SCREENS.WORDS_GAME:
            if (vocab) {
                vocab.style.display = 'block';
                vocab.style.visibility = 'visible';
                vocab.style.opacity = '1';
                console.log("✅ vocab-container exibido pelo showScreen");
            }
            const btns = document.querySelector('.category-buttons');
            if (btns) btns.style.display = 'none';
            
            const categoryContainer = document.getElementById('category-container');
            if (categoryContainer) categoryContainer.style.display = 'block';
            break;
    }
    
    currentScreen = screen;
}

// Navegar para uma tela (adiciona ao histórico)
function navigateTo(screen, options = {}) {
    console.log(`📍 Navegando para: ${screen}`);
    
    // NÃO adiciona se já está na mesma tela
    if (currentScreen === screen) {
        console.log(`⚠️ Já está na tela ${screen}, ignorando`);
        return;
    }
    
    // Adiciona a tela atual ao histórico (se não for a primeira)
    if (currentScreen && currentScreen !== screen) {
        navigationStack.push(currentScreen);
        console.log(`➕ Adicionado ao histórico: ${currentScreen}`);
    }
    
    showScreen(screen, options);
}


// Voltar para a tela anterior
// Voltar para a tela anterior
function goBack() {
    console.log("◀ goBack chamado");
    console.log("📚 Pilha atual:", navigationStack);
    
    if (navigationStack.length === 0) {
        console.log("⚠️ Pilha vazia, voltando para categorias");
        showScreen(SCREENS.CATEGORIES);
        currentScreen = SCREENS.CATEGORIES;
        return;
    }
    
    const previousScreen = navigationStack.pop();
    console.log(`◀ Voltando para: ${previousScreen}`);
    
    // LIMPA o estado atual antes de voltar
    // Esconde submenus específicos
    const simpleSubmenu = document.getElementById('simple-verbs-submenu');
    const pastSubmenu = document.getElementById('simple-verbs-past-submenu');
    const vocabContainer = document.getElementById('vocab-game-container');
    
    if (simpleSubmenu) simpleSubmenu.style.display = 'none';
    if (pastSubmenu) pastSubmenu.style.display = 'none';
    if (vocabContainer) vocabContainer.style.display = 'none';
    
    showScreen(previousScreen);
    currentScreen = previousScreen;
}

function startNumberGame(gameType) {
    navigateTo(SCREENS.NUMBERS_GAME);
    window.selectGame(gameType);
    updateGameUserName();
}

// Inicializar
function initNavigation() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (window.currentUser || window.isGuest) {
                    showScreen(SCREENS.CATEGORIES);
                } else {
                    showScreen(SCREENS.LOGIN);
                }
            }, 100);
        });
    } else {
        setTimeout(() => {
            if (window.currentUser || window.isGuest) {
                showScreen(SCREENS.CATEGORIES);
            } else {
                showScreen(SCREENS.LOGIN);
            }
        }, 100);
    }
}

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

const SOUND_EFFECTS = {
    correct: 'sfx/CorrectAnswer.mp3',
    wrong: 'sfx/IncorrectAnswer.mp3',
    win: 'sfx/Win.mp3',
    gameOver: 'sfx/GameOver.mp3'
};

const PLATFORM_POSITIONS = [100, 250, 400];

// ============================================
// 2. GAME DATA
// ============================================

const gameData = {
    numbers: [
        { value: 1, word: 'one' }, { value: 2, word: 'two' }, { value: 3, word: 'three' },
        { value: 4, word: 'four' }, { value: 5, word: 'five' }, { value: 6, word: 'six' },
        { value: 7, word: 'seven' }, { value: 8, word: 'eight' }, { value: 9, word: 'nine' },
        { value: 10, word: 'ten' }
    ],
    numbers11_20: [
        { value: 11, word: 'eleven' }, { value: 12, word: 'twelve' }, { value: 13, word: 'thirteen' },
        { value: 14, word: 'fourteen' }, { value: 15, word: 'fifteen' }, { value: 16, word: 'sixteen' },
        { value: 17, word: 'seventeen' }, { value: 18, word: 'eighteen' }, { value: 19, word: 'nineteen' },
        { value: 20, word: 'twenty' }
    ],
    tens: [
        { value: 20, word: 'twenty' }, { value: 30, word: 'thirty' }, { value: 40, word: 'forty' },
        { value: 50, word: 'fifty' }, { value: 60, word: 'sixty' }, { value: 70, word: 'seventy' },
        { value: 80, word: 'eighty' }, { value: 90, word: 'ninety' }
    ],
    hundreds: [
        { value: 100, word: 'one hundred' }, { value: 200, word: 'two hundred' },
        { value: 300, word: 'three hundred' }, { value: 400, word: 'four hundred' },
        { value: 500, word: 'five hundred' }, { value: 600, word: 'six hundred' },
        { value: 700, word: 'seven hundred' }, { value: 800, word: 'eight hundred' },
        { value: 900, word: 'nine hundred' }
    ],
    thousands: [
        { value: 1000, word: 'one thousand' }, { value: 2000, word: 'two thousand' },
        { value: 3000, word: 'three thousand' }, { value: 4000, word: 'four thousand' },
        { value: 5000, word: 'five thousand' }, { value: 6000, word: 'six thousand' },
        { value: 7000, word: 'seven thousand' }, { value: 8000, word: 'eight thousand' },
        { value: 9000, word: 'nine thousand' }
    ],
    random21_99: [],
    random101_999: [],
    random1001_9999: [],
    mixedAdvanced: []
};

// ============================================
// FUNÇÕES GERADORAS DE NÚMEROS
// ============================================

function generateNumbers_21_99() {
    const numbers = [];
    const units = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const tens = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    for (let t = 0; t < tens.length; t++) {
        for (let u = 0; u < units.length; u++) {
            numbers.push({
                value: (t + 2) * 10 + (u + 1),
                word: `${tens[t]}-${units[u]}`
            });
        }
    }
    return numbers;
}

function generateNumbers_101_999() {
    const numbers = [];
    const hundreds = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const units = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const tensList = ['ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 
                   'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    
    for (let h = 0; h < hundreds.length; h++) {
        const hundredWord = `${hundreds[h]} hundred`;
        numbers.push({ value: (h + 1) * 100, word: hundredWord });
        
        for (let u = 0; u < units.length; u++) {
            numbers.push({ value: (h + 1) * 100 + (u + 1), word: `${hundredWord} ${units[u]}` });
        }
        
        for (let s = 0; s < teens.length; s++) {
            numbers.push({ value: (h + 1) * 100 + 10 + s, word: `${hundredWord} ${teens[s]}` });
        }
        
        for (let t = 0; t < tensList.length; t++) {
            const tenWord = tensList[t];
            const tenValue = (t + 1) * 10;
            if (tenValue >= 20) {
                numbers.push({ value: (h + 1) * 100 + tenValue, word: `${hundredWord} ${tenWord}` });
            }
            for (let u = 0; u < units.length; u++) {
                numbers.push({ value: (h + 1) * 100 + tenValue + (u + 1), word: `${hundredWord} ${tenWord}-${units[u]}` });
            }
        }
    }
    
    const unique = [];
    const seen = new Set();
    for (const num of numbers) {
        if (!seen.has(num.value)) {
            seen.add(num.value);
            unique.push(num);
        }
    }
    return unique;
}

function generateNumbers_1001_9999() {
    const numbers = [];
    const thousands = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const hundreds = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const tensList = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const units = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 
                   'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    
    for (let th = 0; th < thousands.length; th++) {
        const thousandWord = `${thousands[th]} thousand`;
        const thousandValue = (th + 1) * 1000;
        
        numbers.push({ value: thousandValue, word: thousandWord });
        
        for (let u = 0; u < units.length; u++) {
            numbers.push({ value: thousandValue + (u + 1), word: `${thousandWord} ${units[u]}` });
        }
        
        for (let s = 0; s < teens.length; s++) {
            numbers.push({ value: thousandValue + 10 + s, word: `${thousandWord} ${teens[s]}` });
        }
        
        for (let t = 0; t < tensList.length; t++) {
            const tenWord = tensList[t];
            const tenValue = (t + 2) * 10;
            numbers.push({ value: thousandValue + tenValue, word: `${thousandWord} ${tenWord}` });
            for (let u = 0; u < units.length; u++) {
                numbers.push({ value: thousandValue + tenValue + (u + 1), word: `${thousandWord} ${tenWord}-${units[u]}` });
            }
        }
        
        for (let h = 0; h < hundreds.length; h++) {
            const hundredWord = `${hundreds[h]} hundred`;
            const hundredValue = (h + 1) * 100;
            numbers.push({ value: thousandValue + hundredValue, word: `${thousandWord} ${hundredWord}` });
            
            for (let u = 0; u < units.length; u++) {
                numbers.push({ value: thousandValue + hundredValue + (u + 1), word: `${thousandWord} ${hundredWord} ${units[u]}` });
            }
            
            for (let s = 0; s < teens.length; s++) {
                numbers.push({ value: thousandValue + hundredValue + 10 + s, word: `${thousandWord} ${hundredWord} ${teens[s]}` });
            }
            
            for (let t = 0; t < tensList.length; t++) {
                const tenWord = tensList[t];
                const tenValue = (t + 2) * 10;
                numbers.push({ value: thousandValue + hundredValue + tenValue, word: `${thousandWord} ${hundredWord} ${tenWord}` });
                for (let u = 0; u < units.length; u++) {
                    numbers.push({ value: thousandValue + hundredValue + tenValue + (u + 1), word: `${thousandWord} ${hundredWord} ${tenWord}-${units[u]}` });
                }
            }
        }
    }
    
    const unique = [];
    const seen = new Set();
    for (const num of numbers) {
        if (!seen.has(num.value)) {
            seen.add(num.value);
            unique.push(num);
        }
    }
    return unique;
}

function generateMixedAdvanced() {
    const allNumbers = [
        ...gameData.numbers,
        ...gameData.numbers11_20,
        ...gameData.tens,
        ...gameData.hundreds,
        ...gameData.thousands,
        ...gameData.random21_99,
        ...gameData.random101_999,
        ...gameData.random1001_9999
    ];
    
    for (let i = allNumbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allNumbers[i], allNumbers[j]] = [allNumbers[j], allNumbers[i]];
    }
    
    return allNumbers.slice(0, 50);
}

// ============================================
// PREENCHER OS DADOS GERADOS
// ============================================

gameData.random21_99 = generateNumbers_21_99();
gameData.random101_999 = generateNumbers_101_999();
gameData.random1001_9999 = generateNumbers_1001_9999();
gameData.mixedAdvanced = generateMixedAdvanced();

console.log('Game data loaded:');
console.log('21-99:', gameData.random21_99.length, 'numbers');
console.log('101-999:', gameData.random101_999.length, 'numbers');
console.log('1001-9999:', gameData.random1001_9999.length, 'numbers');
console.log('Mixed Advanced:', gameData.mixedAdvanced.length, 'numbers');

// ============================================
// 3. VARIÁVEIS DE ESTADO
// ============================================

let currentGame = 'numbers';
let currentNumbers = [];
let currentNumber = null;
let score = 0;
let highScores = {
    numbers: 0, numbers11_20: 0, tens: 0, hundreds: 0, thousands: 0,
    random21_99: 0, random101_999: 0, random1001_9999: 0, mixedAdvanced: 0
};

let lives = 3, streak = 0, multiplier = 1, answered = false, availableNumbers = [];
let audioPlayer = null, isAudioMuted = false, gameActive = false, gameEnded = false;
let isWaiting = false;

// ============================================
// 4. EAGLE ANIMAÇÃO
// ============================================

let eagleX = 250, eagleY = 200, eagleTargetX = 250, isJumping = false, jumpProgress = 0, eagleDirection = -1;
let currentAnimation = 'idle', animationFrame = 0, isAnimating = false;

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
    speakerToggle: document.getElementById('speaker-toggle'),
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

function loadImages() {
    console.log('Loading images...');
    
    eagleImages.idle = new Image();
    eagleImages.idle.src = 'images/flap_01.png';
    eagleImages.idle.onload = () => console.log('✅ Idle image loaded');
    eagleImages.idle.onerror = () => console.error('❌ Failed: images/flap_01.png');
    
    menuEagleImage = new Image();
    menuEagleImage.src = 'images/flap_01.png';

    menuEagleImage.onload = () => {
    // Menu de números (numbers-menu-container)
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
    
    // Menu de WORDS (words-menu-container)
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
    
    console.log('✅ Menu eagle images loaded');
};

    menuEagleImage.onerror = () => console.error('❌ Failed to load menu eagle');
    
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
    
    console.log('All images loading started...');
}

// ============================================
// 7.5. SISTEMA DE PONTUAÇÃO
// ============================================

function calculateRoundScore() {
    let points = SCORE_CONFIG.BASE_POINTS;
    
    const streakBonus = Math.min(streak, SCORE_CONFIG.MAX_STREAK) * SCORE_CONFIG.STREAK_MULTIPLIER;
    points = Math.floor(points * (1 + streakBonus));
    
    const roundTime = (Date.now() - roundStartTime) / 1000;
    let timeBonus = 1.0;
    
    const timeBonusMax = MOBILE_CONFIG.timeBonusMax;
    const perfectTime = MOBILE_CONFIG.perfectTime;
    
    if (roundTime <= perfectTime) {
        timeBonus = timeBonusMax;
    } else if (roundTime <= SCORE_CONFIG.MAX_TIME) {
        const timeFactor = (SCORE_CONFIG.MAX_TIME - roundTime) / (SCORE_CONFIG.MAX_TIME - perfectTime);
        timeBonus = 1.0 + (timeFactor * (timeBonusMax - 1.0));
        timeBonus = Math.min(timeBonusMax, Math.max(SCORE_CONFIG.TIME_BONUS_MIN, timeBonus));
    }
    
    points = Math.floor(points * timeBonus);
    
    return {
        base: SCORE_CONFIG.BASE_POINTS,
        streakBonus: streakBonus,
        streakMultiplier: (1 + streakBonus),
        timeBonus: timeBonus,
        total: points,
        time: roundTime
    };
}

function showScorePopup(points, timeBonus) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    
    let bonusText = '';
    if (timeBonus > 1.8) bonusText = '✨ EXCELLENT! ✨';
    else if (timeBonus > 1.5) bonusText = '🎯 GREAT! 🎯';
    else if (timeBonus > 1.2) bonusText = '👍 GOOD! 👍';
    else bonusText = '💪 KEEP GOING! 💪';
    
    const fontSize = isMobile ? '1.1rem' : '1.3rem';
    const padding = isMobile ? '8px 16px' : '12px 24px';
    
    popup.innerHTML = `<span class="points" style="font-size: ${fontSize}">+${points}</span>
        <span class="bonus-message" style="font-size: ${fontSize}">${bonusText}</span>`;
    
    popup.style.position = 'fixed';
    popup.style.top = '40%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.background = '#c9a13b';
    popup.style.color = '#1e3c5c';
    popup.style.padding = padding;
    popup.style.borderRadius = '50px';
    popup.style.fontWeight = 'bold';
    popup.style.zIndex = '1000';
    popup.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    popup.style.border = '2px solid white';
    popup.style.display = 'flex';
    popup.style.flexDirection = 'column';
    popup.style.alignItems = 'center';
    popup.style.gap = '3px';
    popup.style.animation = 'floatUp 0.8s ease-out forwards';
    
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
}

function showWrongPopup() {
    const popup = document.createElement('div');
    popup.innerHTML = `❌ WRONG!`;
    popup.style.position = 'fixed';
    popup.style.top = '40%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.background = '#ef4444';
    popup.style.color = 'white';
    popup.style.padding = '12px 24px';
    popup.style.borderRadius = '50px';
    popup.style.fontWeight = 'bold';
    popup.style.fontSize = '1.3rem';
    popup.style.zIndex = '1000';
    popup.style.animation = 'floatUp 0.8s ease-out forwards';
    
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
}

// ============================================
// 8. ÁUDIO
// ============================================

function playSound(type) { 
    if (isAudioMuted) return;
    const audio = new Audio(SOUND_EFFECTS[type]);
    audio.play().catch(e => console.log('Sound error:', e));
}

function playAudio() {
    if (!currentNumber || isAudioMuted || !gameActive) return;
    
    if (audioPlayer) { 
        audioPlayer.pause(); 
        audioPlayer.currentTime = 0; 
    }
    
    let nomeArquivo = currentNumber.word.toLowerCase();
    nomeArquivo = nomeArquivo.replace(/ /g, '_').replace(/-/g, '_');
    
    console.log(`📁 Tentando: audio/${nomeArquivo}.mp3`);
    
    audioPlayer = new Audio(`audio/${nomeArquivo}.mp3`);
    
    audioPlayer.play().catch(err => {
        console.log(`❌ Erro: ${nomeArquivo}.mp3 -`, err.message);
        const nomeComEspaco = currentNumber.word.toLowerCase();
        console.log(`📁 Tentando fallback: audio/${nomeComEspaco}.mp3`);
        const fallbackAudio = new Audio(`audio/${nomeComEspaco}.mp3`);
        fallbackAudio.play().catch(e => console.log(`❌ Fallback também falhou`));
    });
}

// ============================================
// 9. FUNÇÕES DO LEADERBOARD
// ============================================

async function showLeaderboardModal() {
    const existingModal = document.querySelector('.leaderboard-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'leaderboard-modal';
    modal.innerHTML = `
        <div class="leaderboard-content">
            <div class="leaderboard-header">
                <h2>🏆 GLOBAL LEADERBOARDS</h2>
                <button class="close-modal">&times;</button>
            </div>
            <div class="leaderboard-tabs" id="leaderboard-tabs"></div>
            <div id="leaderboard-list" class="leaderboard-list">
                <div class="leaderboard-empty">Loading...</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const gameModes = [
        { id: 'numbers', name: '1-10' }, { id: 'numbers11-20', name: '11-20' },
        { id: 'tens', name: 'Tens' }, { id: 'hundreds', name: '100s' },
        { id: 'thousands', name: '1,000s' }, { id: 'random21_99', name: '21-99' },
        { id: 'random101_999', name: '101-999' }, { id: 'random1001_9999', name: '1K-9K' },
        { id: 'mixedAdvanced', name: 'Mixed' }
    ];
    
    const tabsContainer = document.getElementById('leaderboard-tabs');
    gameModes.forEach((mode, index) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (index === 0 ? ' active' : '');
        btn.textContent = mode.name;
        btn.dataset.mode = mode.id;
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadLeaderboardForMode(mode.id);
        };
        tabsContainer.appendChild(btn);
    });
    
    async function loadLeaderboardForMode(modeId) {
        const listContainer = document.getElementById('leaderboard-list');
        listContainer.innerHTML = '<div class="leaderboard-empty">Loading...</div>';
        
        let scores = [];
        
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            try {
                const db = firebase.firestore();
                const snapshot = await db.collection('leaderboards').doc(modeId).collection('scores')
                    .orderBy('score', 'desc')
                    .limit(20)
                    .get();
                snapshot.forEach(doc => scores.push(doc.data()));
                console.log(`✅ Loaded ${scores.length} scores from Firebase for ${modeId}`);
            } catch (err) {
                console.error("❌ Error loading from Firebase:", err);
                const leaderboardKey = `leaderboard_${modeId}`;
                scores = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
            }
        } else {
            const leaderboardKey = `leaderboard_${modeId}`;
            scores = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
        }
        
        if (scores.length === 0) {
            listContainer.innerHTML = '<div class="leaderboard-empty">No scores yet. Be the first!</div>';
            return;
        }
        
        scores.sort((a, b) => b.score - a.score);
        
        listContainer.innerHTML = '';
        scores.slice(0, 20).forEach((score, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `<div class="leaderboard-rank">${index + 1}º</div>
                <div class="leaderboard-name">${escapeHtml(score.name)}</div>
                <div class="leaderboard-score">${score.score}</div>`;
            listContainer.appendChild(item);
        });
    }
    
    await loadLeaderboardForMode('numbers');
    modal.querySelector('.close-modal').onclick = () => modal.remove();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNameEntryModal(score, gameMode) {
    console.log("🎯 Vitória! Score:", score, "GameMode:", gameMode);
    
    const existingModal = document.querySelector('.name-entry-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'name-entry-modal';
    modal.innerHTML = `
        <div class="name-entry-content">
            <h3>🏆 YOU WIN! 🏆</h3>
            <p>You scored <strong style="color:#c9a13b; font-size:1.8rem;">${score}</strong> points</p>
            <p>Enter your name for the global leaderboard:</p>
            <input type="text" id="player-name-input" class="name-input" placeholder="Your name" maxlength="20">
            <div class="name-entry-buttons">
                <button id="submit-name-btn" class="name-entry-btn submit">SUBMIT</button>
                <button id="skip-name-btn" class="name-entry-btn skip">SKIP</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        const nameInput = document.getElementById('player-name-input');
        if (nameInput) nameInput.focus();
    }, 100);
    
    const submitBtn = document.getElementById('submit-name-btn');
    if (submitBtn) {
        submitBtn.onclick = () => {
            const name = document.getElementById('player-name-input')?.value;
            const finalName = (name && name.trim()) ? name.trim() : "Anonymous";
            console.log("💾 Salvando no leaderboard:", finalName, score, gameMode);
            saveToLeaderboard(gameMode, score, finalName);
            modal.remove();
        };
    }
    
    const skipBtn = document.getElementById('skip-name-btn');
    if (skipBtn) {
        skipBtn.onclick = () => {
            console.log("Usuário pulou o leaderboard");
            modal.remove();
        };
    }
    
    const nameInput = document.getElementById('player-name-input');
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const name = e.target.value;
                const finalName = (name && name.trim()) ? name.trim() : "Anonymous";
                console.log("💾 Salvando no leaderboard (Enter):", finalName, score, gameMode);
                saveToLeaderboard(gameMode, score, finalName);
                modal.remove();
            }
        });
    }
}

function saveToLeaderboard(gameMode, score, playerName) {
    if (!playerName || playerName.trim() === "") return;
    
    console.log(`🏆 Saving to leaderboard: ${playerName} - ${score} points in ${gameMode}`);
    
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        const db = firebase.firestore();
        const leaderboardRef = db.collection('leaderboards').doc(gameMode).collection('scores');
        
        leaderboardRef.add({
            name: playerName.trim(),
            score: score,
            date: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log(`✅ Score saved to Firebase: ${gameMode}`);
        }).catch(err => {
            console.error("❌ Error saving to Firebase:", err);
            saveToLocalLeaderboard(gameMode, score, playerName);
        });
    } else {
        saveToLocalLeaderboard(gameMode, score, playerName);
    }
}

function saveToLocalLeaderboard(gameMode, score, playerName) {
    const leaderboardKey = `leaderboard_${gameMode}`;
    let leaderboard = JSON.parse(localStorage.getItem(leaderboardKey)) || [];
    
    leaderboard.push({
        name: playerName,
        score: score,
        date: new Date().toISOString()
    });
    
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > 50) leaderboard = leaderboard.slice(0, 50);
    localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
}

// ============================================
// 10. ANIMAÇÃO DA ÁGUIA
// ============================================

function animate() {
    requestAnimationFrame(animate);
    updateEagleMovement();
    drawEagle();
}

function updateEagleMovement() {
    const now = Date.now();
    
    if (isJumping) {
        jumpProgress += JUMP_SPEED;
        
        if (jumpProgress >= 1) {
            eagleX = eagleTargetX;
            eagleY = 200;
            isJumping = false;
            jumpProgress = 0;
            
            if (gameActive && answered) {
                isWaiting = true;
                DOM.platforms.forEach(p => p.disabled = true);
                startAnimation('celebrate');
                setTimeout(() => {
                    stopAnimation();
                    isWaiting = false;
                    nextRound();
                }, 300);
            }
        } else {
            eagleX += (eagleTargetX - eagleX) * HORIZONTAL_EASING;
            eagleY = 200 - 35 * Math.sin(jumpProgress * Math.PI);
            if (!isAnimating || currentAnimation !== 'flap') {
                startAnimation('flap');
            }
        }
    }
    
    if (now - lastAnimationFrame >= EAGLE_ANIMATION_DELAY) {
        lastAnimationFrame = now;
        
        if (isAnimating) {
            animationFrame++;
            
            if (currentAnimation === 'flap') {
                if (animationFrame >= eagleImages.flap.length) animationFrame = 0;
                console.log("🎬 Flap frame:", animationFrame);
            }
            else if (currentAnimation === 'celebrate') {
                if (animationFrame >= eagleImages.celebrate.length) {}
                console.log("🎬 Celebrate frame:", animationFrame);
            }
            else if (currentAnimation === 'wrong') {
                if (animationFrame >= eagleImages.wrong.length) stopAnimation();
            }
        }
    }
}

function drawEagle() {
    if (!DOM.ctx) return;
    
    DOM.ctx.clearRect(0, 0, 500, 250);
    
    let img = eagleImages.idle;
    if (currentAnimation === 'flap' && eagleImages.flap[animationFrame]) img = eagleImages.flap[animationFrame];
    else if (currentAnimation === 'celebrate' && eagleImages.celebrate[animationFrame]) img = eagleImages.celebrate[animationFrame];
    else if (currentAnimation === 'wrong' && eagleImages.wrong[animationFrame]) img = eagleImages.wrong[animationFrame];
    
    if (img && img.complete && img.naturalHeight > 0) {
        DOM.ctx.save();
        DOM.ctx.translate(eagleX, eagleY);
        if (eagleDirection === 1) DOM.ctx.scale(-1, 1);
        DOM.ctx.scale(1.2, 1);
        
        let size = currentAnimation === 'flap' ? 165 : 150;
        DOM.ctx.drawImage(img, -size/2, -size, size, size);
        DOM.ctx.restore();
    }
}

function startAnimation(type) { 
    console.log('🎬 Starting animation:', type, 'frame:', animationFrame);
    currentAnimation = type; 
    animationFrame = 0; 
    isAnimating = true; 
    lastAnimationFrame = Date.now();
}

function stopAnimation() { 
    currentAnimation = 'idle'; 
    animationFrame = 0; 
    isAnimating = false; 
}

function jumpToPlatform(idx) { 
    eagleTargetX = PLATFORM_POSITIONS[idx]; 
    isJumping = true; 
    jumpProgress = 0; 
    eagleDirection = eagleTargetX > eagleX ? 1 : -1; 
    startAnimation('flap');
}

function resetEagle() { 
    eagleX = 250; 
    eagleY = 200; 
    isJumping = false; 
    jumpProgress = 0; 
    currentAnimation = 'idle'; 
    animationFrame = 0; 
    isAnimating = false; 
    eagleDirection = -1; 
    isWaiting = false;
}

// ============================================
// 11. GAME MECÂNICAS
// ============================================

function handlePlatformClick(e) {
    const btn = e.currentTarget, idx = parseInt(btn.dataset.index);
    if (!gameActive || answered || !currentNumber || isWaiting) return;
    
    if (parseInt(btn.dataset.value) === currentNumber.value) {
        const roundScore = calculateRoundScore();
        streak++;
        multiplier = Math.min(streak, SCORE_CONFIG.MAX_STREAK);
        score += roundScore.total;
        
        btn.classList.add('correct');
        updateScore();
        updateMultiplier();
        updateHighScore();
        playSound('correct');
        showScorePopup(roundScore.total, roundScore.timeBonus);
        
        answered = true;
        DOM.platforms.forEach(p => p.disabled = true);
        
        if (PLATFORM_POSITIONS[idx] === eagleX) {
            isWaiting = true;
            startAnimation('celebrate');
            setTimeout(() => {
                stopAnimation();
                isWaiting = false;
                nextRound();
            }, 300);
        } else {
            jumpToPlatform(idx);
        }
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
    startTime = Date.now();
    timerInterval = setInterval(() => {
        if (gameActive) {
            currentTime = Math.floor((Date.now() - startTime) / 1000);
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

function updateHighScore() {
    if (score > highScores[currentGame]) {
        highScores[currentGame] = score;
        if (DOM.highScore) DOM.highScore.textContent = score;
    }
}

function gameOver() {
    if (gameEnded) return;
    gameActive = false; 
    gameEnded = true; 
    stopTimer();
    playSound('gameOver');
    DOM.platforms.forEach(p => p.disabled = true);
    setTimeout(() => { 
        if (DOM.wordDisplay) DOM.wordDisplay.textContent = 'GAME OVER'; 
        addRestartButton(); 
    }, 1000);
}

function winGame() {
    if (gameEnded) return;
    
    const totalGameTime = endTime || currentTime;
    let speedBonus = 1.0;
    if (totalGameTime <= 22) speedBonus = 2.4;
    else if (totalGameTime <= 30) speedBonus = 2.2;
    else if (totalGameTime <= 45) speedBonus = 1.8;
    else if (totalGameTime <= 65) speedBonus = 1.5;
    else if (totalGameTime <= 90) speedBonus = 1.2;
    else speedBonus = 1.0;
    
    const lifeBonus = 1 + (lives * 0.2);
    const finalScore = Math.floor(score * speedBonus * lifeBonus);
    
    gameActive = false;
    gameEnded = true;
    stopTimer();
    playSound('win');
    DOM.platforms.forEach(p => p.disabled = true);
    
    setTimeout(() => {
        showNameEntryModal(finalScore, currentGame);
    }, 500);
    
    showWinWithBonus();
}

function loseLife() { 
    if (lives > 0) { 
        lives--; 
        updateLives(); 
        if (lives === 0) gameOver(); 
    } 
}

function nextRound() {
    if (!gameActive) return;
    if (availableNumbers.length === 0) { 
        winGame(); 
        return; 
    }
    
    const rand = Math.floor(Math.random() * availableNumbers.length);
    currentNumber = availableNumbers[rand];
    availableNumbers.splice(rand, 1);
    if (DOM.wordDisplay) DOM.wordDisplay.textContent = currentNumber.word;
    setupPlatforms();
    answered = false;
    isWaiting = false;
    currentAnimation = 'idle'; 
    animationFrame = 0; 
    isAnimating = false;
    DOM.platforms.forEach(p => { 
        p.classList.remove('correct', 'wrong'); 
        p.disabled = false; 
    });
    
    roundStartTime = Date.now();
    setTimeout(playAudio, MOBILE_CONFIG.tapDelay);
}

function setupPlatforms() {
    const correctValue = currentNumber.value;
    let options = [correctValue];
    let possibleValues = currentNumbers.map(n => n.value);
    
    while (options.length < 3) {
        const randomIndex = Math.floor(Math.random() * possibleValues.length);
        const randomValue = possibleValues[randomIndex];
        if (!options.includes(randomValue) && randomValue !== correctValue) {
            options.push(randomValue);
        }
    }
    
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }
    
    DOM.platforms.forEach((p, i) => {
        p.textContent = options[i];
        p.dataset.value = options[i];
    });
}

function showWinWithBonus() {
    let winScreen = document.createElement('div');
    winScreen.className = 'win-screen';
    winScreen.innerHTML = `
        <h2>🎉 YOU WIN! 🎉</h2>
        <div class="win-stats">
            <p>⏱️ Time: ${DOM.timer.textContent}</p>
            <p>💰 Score: ${score}</p>
            <button class="restart-btn" id="win-restart-btn">PLAY AGAIN</button>
            <button class="restart-btn" id="win-menu-btn">BACK TO MENU</button>
        </div>
    `;
    
    DOM.game.appendChild(winScreen);
    
    document.getElementById('win-restart-btn')?.addEventListener('click', () => { 
        winScreen.remove(); 
        removeRestartButton(); 
        resetGame();
        startGame();
    });
    
    document.getElementById('win-menu-btn')?.addEventListener('click', () => { 
        winScreen.remove(); 
        removeRestartButton(); 
        showMenu(); 
    });
}


function showMenu() {
    gameActive = false; 
    stopTimer(); 
    removeWinScreen(); 
    removeRestartButton(); 
    resetEagle();
    DOM.platforms.forEach(p => { 
        p.textContent = '?'; 
        p.disabled = true; 
        p.classList.remove('correct', 'wrong'); 
    });
    if (DOM.wordDisplay) DOM.wordDisplay.textContent = 'Ready?';
    if (DOM.instructions) DOM.instructions.textContent = '👆 Click START to begin';
    if (DOM.gameStats) DOM.gameStats.style.display = 'none';
    if (DOM.startButton) { 
        DOM.startButton.style.display = 'block'; 
        DOM.startButton.disabled = false; 
    }
    DOM.game.classList.remove('game-active');
    
    if (DOM.game) DOM.game.style.display = 'none';
    if (DOMcat && DOMcat.numbersMenuContainer) {
        DOMcat.numbersMenuContainer.style.display = 'block';
    }
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
    const shuffled = [...currentNumbers];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const questionsCount = Math.min(10, shuffled.length);
    availableNumbers = shuffled.slice(0, questionsCount);
    
    console.log(`🔄 Reset game: ${currentGame}`);
    console.log(`   Total numbers available: ${currentNumbers.length}`);
    console.log(`   Questions in this game: ${availableNumbers.length}`);
    if (availableNumbers.length > 0) {
        console.log(`   First question: ${availableNumbers[0].value} - ${availableNumbers[0].word}`);
    }
    
    score = 0;
    lives = 3;
    streak = 0;
    multiplier = 1;
    gameEnded = false;
    answered = false;
    
    updateScore();
    updateMultiplier();
    updateLives();
    
    removeRestartButton();
    removeWinScreen();
    resetEagle();
    
    nextRound();
}

function startGame() {
    if (!DOM.game) {
        console.error("DOM.game não encontrado!");
        return;
    }
    
    gameActive = true;
    DOM.game.classList.add('game-active');
    if (DOM.startButton) DOM.startButton.style.display = 'none';
    if (DOM.gameStats) DOM.gameStats.style.display = 'flex';
    if (DOM.instructions) DOM.instructions.textContent = '👆 Click the number';
    resetGame();
    startTimer();
}


function toggleAudio() {
    isAudioMuted = !isAudioMuted;
    if (DOM.speakerToggle) DOM.speakerToggle.textContent = isAudioMuted ? '🔇' : '🔊';
}

// ============================================
// 12. SELEÇÃO DE JOGO
// ============================================

window.selectGame = function(gameType) {
    currentGame = gameType;
    
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
    
    console.log(`📊 Game mode: ${gameType} - ${currentNumbers.length} numbers available`);
    
    const currentHighScore = highScores[gameType] || 0;
    if (DOM.highScore) DOM.highScore.textContent = currentHighScore;
    
    gameActive = false;
    stopTimer();
    removeWinScreen();
    removeRestartButton();
    resetEagle();
    
    if (DOM.platforms) {
        DOM.platforms.forEach(p => { 
            p.textContent = '?'; 
            p.disabled = true; 
            p.classList.remove('correct', 'wrong'); 
        });
    }
    
    if (DOM.wordDisplay) DOM.wordDisplay.textContent = 'Ready?';
    if (DOM.instructions) DOM.instructions.textContent = '👆 Click START to begin';
    if (DOM.gameStats) DOM.gameStats.style.display = 'none';
    if (DOM.startButton) { 
        DOM.startButton.style.display = 'block'; 
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
    console.log('Game starting...');
    
    if (DOM.canvas) {
        DOM.canvas.width = 500;
        DOM.canvas.height = 250;
    }
    
    loadImages();
    audioPlayer = new Audio();


    if (DOM.menuButton) {
        DOM.menuButton.removeEventListener('click', showMenu);
        DOM.menuButton.addEventListener('click', () => {
            console.log("🏠 Botão voltar clicado no jogo");
            
            gameActive = false;
            stopTimer();
            removeWinScreen();
            removeRestartButton();
            resetEagle();
            
            DOM.platforms.forEach(p => { 
                p.textContent = '?'; 
                p.disabled = true; 
                p.classList.remove('correct', 'wrong'); 
            });
            if (DOM.wordDisplay) DOM.wordDisplay.textContent = 'Ready?';
            if (DOM.gameStats) DOM.gameStats.style.display = 'none';
            if (DOM.startButton) { 
                DOM.startButton.style.display = 'block'; 
                DOM.startButton.disabled = false; 
            }
            DOM.game.classList.remove('game-active');
            
            goBack();
        });
    }
    
    DOM.speakerToggle?.addEventListener('click', toggleAudio);
    DOM.startButton?.addEventListener('click', startGame);
    DOM.platforms.forEach(p => p.addEventListener('click', handlePlatformClick));
    
    const leaderboardBtn = document.getElementById('global-rankings-btn');
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', () => {
            console.log("Botão Rankings clicado!");
            showLeaderboardModal();
        });
    }
    
	updateGameUserName();

    initNavigation();
    animate();
}

// ============================================
// JOGO DE VOCABULÁRIO
// ============================================

const vocabularyData = [
    { id: 0, english: "to go", portuguese: "ir" },
    { id: 1, english: "to read", portuguese: "ler" },
    { id: 2, english: "to sleep", portuguese: "dormir" },
    { id: 3, english: "to tell", portuguese: "contar / dizer" },
    { id: 4, english: "to ask", portuguese: "perguntar" },
    { id: 5, english: "to play", portuguese: "jogar" },
    { id: 6, english: "to smile", portuguese: "sorrir" },
    { id: 7, english: "to open", portuguese: "abrir" },
    { id: 8, english: "to eat", portuguese: "comer" },
    { id: 9, english: "to drink", portuguese: "beber" }
];

let currentEnglishWords = [];
let currentPortugueseWords = [];
let matchesCount = 0;
let draggedIndex = null;
let draggedElement = null;

const englishList = document.getElementById('english-words-list');
const portugueseList = document.getElementById('portuguese-words-list');
const vocabMatchesSpan = document.getElementById('vocab-matches');
const vocabTotalSpan = document.getElementById('vocab-total');
const vocabMessage = document.getElementById('vocab-message');

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startVocabularyGame(vocabularyDataParam = null) {
    console.log("🎮 Iniciando jogo de vocabulário");
    
    // Usar dados específicos do jogo ou o padrão
    const activeData = vocabularyDataParam || vocabularyDataVerbs1;
    console.log(`📊 Usando ${activeData.length} verbos para este jogo`);
    
    currentEnglishWords = activeData.map(item => ({
        id: item.id, text: item.english, matched: false, locked: false
    }));
    
    currentPortugueseWords = activeData.map(item => ({
        id: item.id, text: item.portuguese, matched: false, locked: false
    }));
    
    currentEnglishWords = shuffleArray([...currentEnglishWords]);
    
    matchesCount = 0;
    if (vocabMatchesSpan) vocabMatchesSpan.textContent = matchesCount;
    if (vocabTotalSpan) vocabTotalSpan.textContent = activeData.length;
    
    renderVocabularyLists();
    if (vocabMessage) vocabMessage.innerHTML = '';
currentScreen = SCREENS.WORDS_GAME;
}


function renderVocabularyLists() {
    if (!englishList || !portugueseList) return;
    
    englishList.innerHTML = '';
    currentEnglishWords.forEach((item, idx) => {
        const div = document.createElement('div');
        if (item.locked) {
            div.className = 'vocab-item english-item locked';
            div.setAttribute('draggable', 'false');
        } else {
            div.className = 'vocab-item english-item';
            div.setAttribute('draggable', 'true');
            div.setAttribute('data-id', item.id);
            div.setAttribute('data-index', idx);
            
            // Eventos de mouse (desktop)
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragend', handleDragEnd);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);
            
            // Eventos de toque (mobile)
            div.addEventListener('touchstart', handleTouchStart, { passive: false });
            div.addEventListener('touchmove', handleTouchMove, { passive: false });
            div.addEventListener('touchend', handleTouchEnd);
        }
        div.textContent = item.text;
        englishList.appendChild(div);
    });
    
    portugueseList.innerHTML = '';
    currentPortugueseWords.forEach((item) => {
        const div = document.createElement('div');
        if (item.locked) {
            div.className = 'vocab-item portuguese-item locked';
        } else {
            div.className = 'vocab-item portuguese-item';
            // Adiciona evento de toque para os alvos também
            div.addEventListener('touchmove', handleTouchMove, { passive: false });
            div.addEventListener('touchend', handleTouchEnd);
        }
        div.textContent = item.text;
        div.setAttribute('data-id', item.id);
        portugueseList.appendChild(div);
    });
    
    if (matchesCount === vocabularyData.length) {
        showVocabMessage('🎉 PERFECT! You matched all verbs! 🎉', 'win');
    }
}


function handleDragStart(e) {
    draggedElement = e.target;
    draggedIndex = parseInt(draggedElement.getAttribute('data-index'));
    e.target.style.opacity = '0.5';
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    if (draggedElement) draggedElement.style.opacity = '1';
    document.querySelectorAll('.english-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedElement = null;
    draggedIndex = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.english-item');
    if (target && target !== draggedElement && !target.classList.contains('locked')) {
        document.querySelectorAll('.english-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        target.classList.add('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.english-item');
    if (!target || draggedElement === null || draggedIndex === null) return;
    if (target.classList.contains('locked')) return;
    
    const targetIndex = parseInt(target.getAttribute('data-index'));
    if (isNaN(targetIndex) || draggedIndex === targetIndex) return;
    
    const activeEnglish = currentEnglishWords.filter(item => !item.locked);
    
    let realDraggedIndex = -1;
    let realTargetIndex = -1;
    let filteredIndex = 0;
    for (let i = 0; i < currentEnglishWords.length; i++) {
        if (!currentEnglishWords[i].locked) {
            if (i === draggedIndex) realDraggedIndex = filteredIndex;
            if (i === targetIndex) realTargetIndex = filteredIndex;
            filteredIndex++;
        }
    }
    
    if (realDraggedIndex === -1 || realTargetIndex === -1) return;
    
    const [movedItem] = activeEnglish.splice(realDraggedIndex, 1);
    activeEnglish.splice(realTargetIndex, 0, movedItem);
    
    let activePos = 0;
    for (let i = 0; i < currentEnglishWords.length; i++) {
        if (!currentEnglishWords[i].locked) {
            currentEnglishWords[i] = activeEnglish[activePos];
            activePos++;
        }
    }
    
    renderVocabularyLists();
    draggedElement = null;
    draggedIndex = null;
    checkAndLockMatches();
}

// ============================================
// SUPORTE A TOQUE (MOBILE) - VERSÃO SIMPLIFICADA
// ============================================

let touchActive = false;
let touchSourceElement = null;
let touchSourceId = null;

function handleTouchStart(e) {
    // Verifica se o evento pode ser cancelado antes de chamar preventDefault
    if (e.cancelable) {
        e.preventDefault();
    }
    
    const target = e.target.closest('.english-item');
    if (!target || target.classList.contains('locked')) return;
    
    touchActive = true;
    touchSourceElement = target;
    touchSourceId = parseInt(target.getAttribute('data-id'));
    
    target.style.opacity = '0.5';
    target.style.transform = 'scale(0.98)';
    document.body.classList.add('dragging');
}

function handleTouchMove(e) {
    if (!touchActive) return;
    
    // Verifica se o evento pode ser cancelado
    if (e.cancelable) {
        e.preventDefault();
    }
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    
    document.querySelectorAll('.portuguese-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    const elemUnderTouch = document.elementsFromPoint(touchX, touchY);
    for (let elem of elemUnderTouch) {
        if (elem.classList && elem.classList.contains('portuguese-item') && !elem.classList.contains('locked')) {
            elem.classList.add('drag-over');
            break;
        }
    }
}


function handleTouchEnd(e) {
    if (!touchActive) {
        document.querySelectorAll('.portuguese-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        return;
    }
    
    // Verifica se o evento pode ser cancelado
    if (e.cancelable) {
        e.preventDefault();
    }
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    if (touchSourceElement) {
        touchSourceElement.style.opacity = '1';
        touchSourceElement.style.transform = '';
    }
    
    const elemUnderTouch = document.elementsFromPoint(touchEndX, touchEndY);
    let targetPortuguese = null;
    
    for (let elem of elemUnderTouch) {
        if (elem.classList && elem.classList.contains('portuguese-item') && !elem.classList.contains('locked')) {
            targetPortuguese = elem;
            break;
        }
    }
    
    if (targetPortuguese && touchSourceId !== null) {
        const targetId = parseInt(targetPortuguese.getAttribute('data-id'));
        
        if (touchSourceId === targetId) {
            const englishItem = currentEnglishWords.find(item => item.id === touchSourceId && !item.locked);
            const portugueseItem = currentPortugueseWords.find(item => item.id === targetId && !item.locked);
            
            if (englishItem && portugueseItem) {
                englishItem.locked = true;
                portugueseItem.locked = true;
                matchesCount++;
                
                if (vocabMatchesSpan) vocabMatchesSpan.textContent = matchesCount;
                showVocabMessage('✓ Correct match!', 'success');
                renderVocabularyLists();
                
                if (matchesCount === currentEnglishWords.length) {
                    showVocabMessage('🎉 PERFECT! 🎉', 'win');
                }
            }
        } else {
            showVocabMessage('✗ Wrong match! Try again!', 'error');
        }
    }
    
    document.querySelectorAll('.portuguese-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    touchActive = false;
    touchSourceElement = null;
    touchSourceId = null;
    document.body.classList.remove('dragging');
}

function checkAndLockMatches() {
    let anyMatch = false;
    for (let i = 0; i < currentEnglishWords.length; i++) {
        const englishItem = currentEnglishWords[i];
        const portugueseItem = currentPortugueseWords[i];
        if (!englishItem.locked && !portugueseItem.locked && englishItem.id === portugueseItem.id) {
            englishItem.locked = true;
            portugueseItem.locked = true;
            englishItem.matched = true;
            portugueseItem.matched = true;
            matchesCount++;
            anyMatch = true;
        }
    }
    
    if (anyMatch) {
        if (vocabMatchesSpan) vocabMatchesSpan.textContent = matchesCount;
        showVocabMessage('✓ Correct match! Pair locked!', 'success');
        renderVocabularyLists();
        if (matchesCount === vocabularyData.length) {
            showVocabMessage('🎉 PERFECT! You matched all verbs! 🎉', 'win');
        }
    }
}

function showVocabMessage(message, type) {
    if (!vocabMessage) return;
    vocabMessage.innerHTML = message;
    vocabMessage.className = `vocab-message ${type}`;
    setTimeout(() => {
        if (vocabMessage.innerHTML === message) {
            vocabMessage.innerHTML = '';
            vocabMessage.className = 'vocab-message';
        }
    }, 2000);
}

// ============================================
// MENU DE WORDS
// ============================================

const wordsMenuContainer = document.getElementById('words-menu-container');
const backToCategoryFromWords = document.getElementById('back-to-category-from-words');



window.selectWordGame = function(gameType) {
    console.log(`📚 Word game selected: ${gameType}`);
    
    const gameDataMap = {
    // Simple Verbs (presente)
    'verbs1': vocabularyDataVerbs1,
    'verbs2': vocabularyDataVerbs2,
    'verbs3': vocabularyDataVerbs3,
    'verbs4': vocabularyDataVerbs4,
    'verbs5': vocabularyDataVerbs5,
    'verbs6': vocabularyDataVerbs6,
    'verbs7': vocabularyDataVerbs7,
    'verbs8': vocabularyDataVerbs8,
    'verbs9': vocabularyDataVerbs9,
    'verbs10': vocabularyDataVerbs10,
    
    // Simple Past
    'past1': vocabularyDataPast1,
    'past2': vocabularyDataPast2,
    'past3': vocabularyDataPast3,
    'past4': vocabularyDataPast4,
    'past5': vocabularyDataPast5,
    'past6': vocabularyDataPast6,
    'past7': vocabularyDataPast7,
    'past8': vocabularyDataPast8,
    'past9': vocabularyDataPast9,
    'past10': vocabularyDataPast10
};
    
    const selectedData = gameDataMap[gameType];
    
    if (selectedData) {
        // Garantir que o container pai está visível
        const categoryContainer = document.getElementById('category-container');
        if (categoryContainer) categoryContainer.style.display = 'block';
        
        // Esconder o menu de words
        const wordsMenu = document.getElementById('words-menu-container');
        if (wordsMenu) wordsMenu.style.display = 'none';
        
        // Esconder os botões de categoria
        const categoryButtons = document.querySelector('.category-buttons');
        if (categoryButtons) categoryButtons.style.display = 'none';
        
        // Mostrar o container do jogo
        const vocabContainer = document.getElementById('vocab-game-container');
        if (vocabContainer) {
            vocabContainer.style.display = 'block';
            vocabContainer.style.visibility = 'visible';
            vocabContainer.style.opacity = '1';
            console.log("✅ vocab-container exibido");
        }
        
        // Adicionar ao histórico
        navigateTo(SCREENS.WORDS_GAME);
        
        // Iniciar o jogo
        startVocabularyGame(selectedData);
    } else {
        alert(`Game "${gameType}" not found!`);
    }
};


// ============================================
// BOTÃO VOLTAR DO JOGO DE VOCABULÁRIO
// ============================================



function backToCategoryFromVocab() {
    console.log("◀ Botão voltar do vocabulário clicado");
    
    const vocabContainer = document.getElementById('vocab-game-container');
    if (vocabContainer) vocabContainer.style.display = 'none';
    
    matchesCount = 0;
    draggedIndex = null;
    draggedElement = null;
    
    goBack();
}

// ============================================
// ATUALIZAR NOME DO USUÁRIO NO JOGO DE NÚMEROS
// ============================================


function updateGameUserName() {
    const gameUserNameSpan = document.getElementById('game-user-name');
    const gameUserInfo = document.getElementById('game-user-info');
    const categoryUserName = document.getElementById('category-user-name');
    
    if (!gameUserNameSpan || !gameUserInfo) return;
    
    // PRIORIDADE: window.currentUserName (vem do Firestore)
    if (window.currentUserName && window.currentUserName !== 'Guest') {
        gameUserNameSpan.textContent = window.currentUserName;
        gameUserInfo.style.display = 'flex';
        if (categoryUserName) categoryUserName.textContent = window.currentUserName;
        console.log('✅ Nome do Firestore aplicado:', window.currentUserName);
    } 
    else if (window.isGuest === true) {
        gameUserNameSpan.textContent = 'Guest';
        gameUserInfo.style.display = 'flex';
        if (categoryUserName) categoryUserName.textContent = 'Guest';
        console.log('✅ Guest name aplicado');
    } 
    else if (window.currentUser && window.currentUser.email) {
        const name = window.currentUser.email.split('@')[0];
        gameUserNameSpan.textContent = name;
        gameUserInfo.style.display = 'flex';
        if (categoryUserName) categoryUserName.textContent = name;
        console.log('⚠️ Fallback para email:', name);
    } 
    else {
        gameUserInfo.style.display = 'none';
    }
}


// ============================================
// DADOS DOS JOGOS DE VOCABULÁRIO
// ============================================

// Simple Verbs 1 (já existe, mas vamos atualizar)
const vocabularyDataVerbs1 = [
    { id: 0, english: "to go", portuguese: "ir" },
    { id: 1, english: "to read", portuguese: "ler" },
    { id: 2, english: "to work", portuguese: "trabalhar" },
    { id: 3, english: "to tell", portuguese: "contar / dizer" },
    { id: 4, english: "to ask", portuguese: "perguntar" },
    { id: 5, english: "to play", portuguese: "jogar" },
    { id: 6, english: "to try", portuguese: "tentar" },
    { id: 7, english: "to open", portuguese: "abrir" },
    { id: 8, english: "to help", portuguese: "ajudar" },
    { id: 9, english: "to run", portuguese: "correr" }
];

// Simple Verbs 2
const vocabularyDataVerbs2 = [
    { id: 0, english: "to be", portuguese: "ser / estar" },
    { id: 1, english: "to have", portuguese: "ter" },
    { id: 2, english: "to do", portuguese: "fazer" },
    { id: 3, english: "to say", portuguese: "dizer" },
    { id: 4, english: "to get", portuguese: "conseguir / obter" },
    { id: 5, english: "to make", portuguese: "fazer / criar" },
    { id: 6, english: "to know", portuguese: "saber / conhecer" },
    { id: 7, english: "to take", portuguese: "pegar / levar" },
    { id: 8, english: "to see", portuguese: "ver" },
    { id: 9, english: "to come", portuguese: "vir" }
];

// Simple Verbs 3
const vocabularyDataVerbs3 = [
    { id: 0, english: "to think", portuguese: "pensar" },
    { id: 1, english: "to look", portuguese: "olhar" },
    { id: 2, english: "to want", portuguese: "querer" },
    { id: 3, english: "to give", portuguese: "dar" },
    { id: 4, english: "to use", portuguese: "usar" },
    { id: 5, english: "to find", portuguese: "encontrar" },
    { id: 6, english: "to seem", portuguese: "parecer" },
    { id: 7, english: "to feel", portuguese: "sentir" },
    { id: 8, english: "to leave", portuguese: "deixar / sair" },
    { id: 9, english: "to call", portuguese: "chamar / ligar" }
];

// Simple Verbs 4
const vocabularyDataVerbs4 = [
    { id: 0, english: "to put", portuguese: "colocar" },
    { id: 1, english: "to keep", portuguese: "manter" },
    { id: 2, english: "to let", portuguese: "deixar / permitir" },
    { id: 3, english: "to begin", portuguese: "começar" },
    { id: 4, english: "to talk", portuguese: "conversar / falar" },
    { id: 5, english: "to turn", portuguese: "virar" },
    { id: 6, english: "to start", portuguese: "iniciar" },
    { id: 7, english: "to show", portuguese: "mostrar" },
    { id: 8, english: "to hear", portuguese: "ouvir" },
    { id: 9, english: "to move", portuguese: "mover" }
];

// Simple Verbs 5
const vocabularyDataVerbs5 = [
    { id: 0, english: "to live", portuguese: "viver / morar" },
    { id: 1, english: "to believe", portuguese: "acreditar" },
    { id: 2, english: "to bring", portuguese: "trazer" },
    { id: 3, english: "to happen", portuguese: "acontecer" },
    { id: 4, english: "to write", portuguese: "escrever" },
    { id: 5, english: "to provide", portuguese: "fornecer" },
    { id: 6, english: "to sit", portuguese: "sentar" },
    { id: 7, english: "to stand", portuguese: "ficar em pé" },
    { id: 8, english: "to lose", portuguese: "perder" },
    { id: 9, english: "to pay", portuguese: "pagar" }
];

// Simple Verbs 6
const vocabularyDataVerbs6 = [
    { id: 0, english: "to meet", portuguese: "encontrar / conhecer" },
    { id: 1, english: "to include", portuguese: "incluir" },
    { id: 2, english: "to continue", portuguese: "continuar" },
    { id: 3, english: "to set", portuguese: "definir / colocar" },
    { id: 4, english: "to learn", portuguese: "aprender" },
    { id: 5, english: "to change", portuguese: "mudar" },
    { id: 6, english: "to lead", portuguese: "liderar" },
    { id: 7, english: "to understand", portuguese: "entender" },
    { id: 8, english: "to watch", portuguese: "assistir / observar" },
    { id: 9, english: "to follow", portuguese: "seguir" }
];

// Simple Verbs 7
const vocabularyDataVerbs7 = [
    { id: 0, english: "to stop", portuguese: "parar" },
    { id: 1, english: "to create", portuguese: "criar" },
    { id: 2, english: "to speak", portuguese: "falar" },
    { id: 3, english: "to allow", portuguese: "permitir" },
    { id: 4, english: "to add", portuguese: "adicionar" },
    { id: 5, english: "to spend", portuguese: "gastar" },
    { id: 6, english: "to grow", portuguese: "crescer" },
    { id: 7, english: "to walk", portuguese: "caminhar" },
    { id: 8, english: "to win", portuguese: "ganhar / vencer" },
    { id: 9, english: "to offer", portuguese: "oferecer" }
];

// Simple Verbs 8
const vocabularyDataVerbs8 = [
    { id: 0, english: "to remember", portuguese: "lembrar" },
    { id: 1, english: "to love", portuguese: "amar" },
    { id: 2, english: "to consider", portuguese: "considerar" },
    { id: 3, english: "to appear", portuguese: "aparecer" },
    { id: 4, english: "to buy", portuguese: "comprar" },
    { id: 5, english: "to wait", portuguese: "esperar" },
    { id: 6, english: "to serve", portuguese: "servir" },
    { id: 7, english: "to die", portuguese: "morrer" },
    { id: 8, english: "to send", portuguese: "enviar" },
    { id: 9, english: "to expect", portuguese: "esperar / aguardar" }
];

// Simple Verbs 9
const vocabularyDataVerbs9 = [
    { id: 0, english: "to build", portuguese: "construir" },
    { id: 1, english: "to stay", portuguese: "ficar / permanecer" },
    { id: 2, english: "to fall", portuguese: "cair" },
    { id: 3, english: "to cut", portuguese: "cortar" },
    { id: 4, english: "to reach", portuguese: "alcançar" },
    { id: 5, english: "to kill", portuguese: "matar" },
    { id: 6, english: "to remain", portuguese: "permanecer" },
    { id: 7, english: "to suggest", portuguese: "sugerir" },
    { id: 8, english: "to raise", portuguese: "levantar / aumentar" },
    { id: 9, english: "to pass", portuguese: "passar" }
];

// Simple Verbs 10
const vocabularyDataVerbs10 = [
    { id: 0, english: "to sell", portuguese: "vender" },
    { id: 1, english: "to require", portuguese: "exigir" },
    { id: 2, english: "to report", portuguese: "relatar" },
    { id: 3, english: "to decide", portuguese: "decidir" },
    { id: 4, english: "to pull", portuguese: "puxar" },
    { id: 5, english: "to return", portuguese: "retornar" },
    { id: 6, english: "to explain", portuguese: "explicar" },
    { id: 7, english: "to hope", portuguese: "esperar / ter esperança" },
    { id: 8, english: "to develop", portuguese: "desenvolver" },
    { id: 9, english: "to carry", portuguese: "carregar / levar" }
];


// ============================================
// DADOS DOS JOGOS DE VOCABULÁRIO - PAST TENSE
// ============================================

// Simple Past 1
const vocabularyDataPast1 = [
    { id: 0, english: "to be", portuguese: "was / were" },
    { id: 1, english: "to have", portuguese: "had" },
    { id: 2, english: "to do", portuguese: "did" },
    { id: 3, english: "to say", portuguese: "said" },
    { id: 4, english: "to get", portuguese: "got" },
    { id: 5, english: "to make", portuguese: "made" },
    { id: 6, english: "to know", portuguese: "knew" },
    { id: 7, english: "to take", portuguese: "took" },
    { id: 8, english: "to see", portuguese: "saw" },
    { id: 9, english: "to come", portuguese: "came" }
];

// Simple Past 2
const vocabularyDataPast2 = [
    { id: 0, english: "to go", portuguese: "went" },
    { id: 1, english: "to read", portuguese: "read" },
    { id: 2, english: "to work", portuguese: "worked" },
    { id: 3, english: "to tell", portuguese: "told" },
    { id: 4, english: "to ask", portuguese: "asked" },
    { id: 5, english: "to play", portuguese: "played" },
    { id: 6, english: "to try", portuguese: "tried" },
    { id: 7, english: "to open", portuguese: "opened" },
    { id: 8, english: "to help", portuguese: "helped" },
    { id: 9, english: "to run", portuguese: "ran" }
];

// Simple Past 3
const vocabularyDataPast3 = [
    { id: 0, english: "to think", portuguese: "thought" },
    { id: 1, english: "to look", portuguese: "looked" },
    { id: 2, english: "to want", portuguese: "wanted" },
    { id: 3, english: "to give", portuguese: "gave" },
    { id: 4, english: "to use", portuguese: "used" },
    { id: 5, english: "to find", portuguese: "found" },
    { id: 6, english: "to seem", portuguese: "seemed" },
    { id: 7, english: "to feel", portuguese: "felt" },
    { id: 8, english: "to leave", portuguese: "left" },
    { id: 9, english: "to call", portuguese: "called" }
];

// Simple Past 4
const vocabularyDataPast4 = [
    { id: 0, english: "to put", portuguese: "put" },
    { id: 1, english: "to keep", portuguese: "kept" },
    { id: 2, english: "to let", portuguese: "let" },
    { id: 3, english: "to begin", portuguese: "began" },
    { id: 4, english: "to talk", portuguese: "talked" },
    { id: 5, english: "to turn", portuguese: "turned" },
    { id: 6, english: "to start", portuguese: "started" },
    { id: 7, english: "to show", portuguese: "showed" },
    { id: 8, english: "to hear", portuguese: "heard" },
    { id: 9, english: "to move", portuguese: "moved" }
];

// Simple Past 5
const vocabularyDataPast5 = [
    { id: 0, english: "to live", portuguese: "lived" },
    { id: 1, english: "to believe", portuguese: "believed" },
    { id: 2, english: "to bring", portuguese: "brought" },
    { id: 3, english: "to happen", portuguese: "happened" },
    { id: 4, english: "to write", portuguese: "wrote" },
    { id: 5, english: "to provide", portuguese: "provided" },
    { id: 6, english: "to sit", portuguese: "sat" },
    { id: 7, english: "to stand", portuguese: "stood" },
    { id: 8, english: "to lose", portuguese: "lost" },
    { id: 9, english: "to pay", portuguese: "paid" }
];

// Simple Past 6
const vocabularyDataPast6 = [
    { id: 0, english: "to meet", portuguese: "met" },
    { id: 1, english: "to include", portuguese: "included" },
    { id: 2, english: "to continue", portuguese: "continued" },
    { id: 3, english: "to set", portuguese: "set" },
    { id: 4, english: "to learn", portuguese: "learned" },
    { id: 5, english: "to change", portuguese: "changed" },
    { id: 6, english: "to lead", portuguese: "led" },
    { id: 7, english: "to understand", portuguese: "understood" },
    { id: 8, english: "to watch", portuguese: "watched" },
    { id: 9, english: "to follow", portuguese: "followed" }
];

// Simple Past 7
const vocabularyDataPast7 = [
    { id: 0, english: "to stop", portuguese: "stopped" },
    { id: 1, english: "to create", portuguese: "created" },
    { id: 2, english: "to speak", portuguese: "spoke" },
    { id: 3, english: "to allow", portuguese: "allowed" },
    { id: 4, english: "to add", portuguese: "added" },
    { id: 5, english: "to spend", portuguese: "spent" },
    { id: 6, english: "to grow", portuguese: "grew" },
    { id: 7, english: "to walk", portuguese: "walked" },
    { id: 8, english: "to win", portuguese: "won" },
    { id: 9, english: "to offer", portuguese: "offered" }
];

// Simple Past 8
const vocabularyDataPast8 = [
    { id: 0, english: "to remember", portuguese: "remembered" },
    { id: 1, english: "to love", portuguese: "loved" },
    { id: 2, english: "to consider", portuguese: "considered" },
    { id: 3, english: "to appear", portuguese: "appeared" },
    { id: 4, english: "to buy", portuguese: "bought" },
    { id: 5, english: "to wait", portuguese: "waited" },
    { id: 6, english: "to serve", portuguese: "served" },
    { id: 7, english: "to die", portuguese: "died" },
    { id: 8, english: "to send", portuguese: "sent" },
    { id: 9, english: "to expect", portuguese: "expected" }
];

// Simple Past 9
const vocabularyDataPast9 = [
    { id: 0, english: "to build", portuguese: "built" },
    { id: 1, english: "to stay", portuguese: "stayed" },
    { id: 2, english: "to fall", portuguese: "fell" },
    { id: 3, english: "to cut", portuguese: "cut" },
    { id: 4, english: "to reach", portuguese: "reached" },
    { id: 5, english: "to kill", portuguese: "killed" },
    { id: 6, english: "to remain", portuguese: "remained" },
    { id: 7, english: "to suggest", portuguese: "suggested" },
    { id: 8, english: "to raise", portuguese: "raised" },
    { id: 9, english: "to pass", portuguese: "passed" }
];

// Simple Past 10
const vocabularyDataPast10 = [
    { id: 0, english: "to sell", portuguese: "sold" },
    { id: 1, english: "to require", portuguese: "required" },
    { id: 2, english: "to report", portuguese: "reported" },
    { id: 3, english: "to decide", portuguese: "decided" },
    { id: 4, english: "to pull", portuguese: "pulled" },
    { id: 5, english: "to return", portuguese: "returned" },
    { id: 6, english: "to explain", portuguese: "explained" },
    { id: 7, english: "to hope", portuguese: "hoped" },
    { id: 8, english: "to develop", portuguese: "developed" },
    { id: 9, english: "to carry", portuguese: "carried" }
];



// ============================================
// SUBMENU DOS SIMPLE VERBS
// ============================================

// Botão SIMPLE VERBS (presente)
const simpleVerbsBtn = document.getElementById('simple-verbs-btn');
if (simpleVerbsBtn) {
    const newSimpleBtn = simpleVerbsBtn.cloneNode(true);
    simpleVerbsBtn.parentNode.replaceChild(newSimpleBtn, simpleVerbsBtn);
    
    newSimpleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("📚 SIMPLE VERBS clicado");
        navigateTo(SCREENS.WORDS_SUBMENU);
    });
}

// Botão SIMPLE VERBS PAST TENSE
const simpleVerbsPastBtn = document.getElementById('simple-verbs-past-btn');
if (simpleVerbsPastBtn) {
    const newPastBtn = simpleVerbsPastBtn.cloneNode(true);
    simpleVerbsPastBtn.parentNode.replaceChild(newPastBtn, simpleVerbsPastBtn);
    
    newPastBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("📚 SIMPLE VERBS PAST clicado");
        navigateTo(SCREENS.WORDS_SUBMENU_PAST);
    });
}
// Usar a seta ◀ do header para voltar

// Botão voltar do menu WORDS
const backToWordsMenuBtn = document.getElementById('back-to-category-from-words');
if (backToWordsMenuBtn) {
    // Remove todos os eventos antigos para evitar duplicação
    const newBtn = backToWordsMenuBtn.cloneNode(true);
    backToWordsMenuBtn.parentNode.replaceChild(newBtn, backToWordsMenuBtn);
    
    newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("◀ Botão VOLTAR do WORDS clicado");
        
        const pastSubmenu = document.getElementById('simple-verbs-past-submenu');
        const simpleSubmenu = document.getElementById('simple-verbs-submenu');
        const vocabContainer = document.getElementById('vocab-game-container');
        
        // Esconde submenus e containers do jogo
        if (pastSubmenu) pastSubmenu.style.display = 'none';
        if (simpleSubmenu) simpleSubmenu.style.display = 'none';
        if (vocabContainer) vocabContainer.style.display = 'none';
        
        // Volta para a tela anterior usando goBack()
        goBack();
    });
}

window.addEventListener('load', () => {
    setTimeout(() => {
        initGame();
    }, 100);
});

// ============================================
// TELA DE CATEGORIAS
// ============================================

const DOMcat = {
    categoryContainer: document.getElementById('category-container'),
    numbersMenuContainer: document.getElementById('numbers-menu-container'),
    categoryNumbersBtn: document.getElementById('category-numbers'),
    categoryWordsBtn: document.getElementById('category-words'),
    backToCategoryBtn: document.getElementById('back-to-category-btn'),
    categoryUserInfo: document.getElementById('category-user-info'),
    categoryUserName: document.getElementById('category-user-name'),
    categoryLogoutBtn: document.getElementById('category-logout-btn')
};

function showCategoryScreen() {
    ScreenManager.setScreen('categories');
    currentScreen = 'categories'; 
    if (DOMcat.categoryContainer) DOMcat.categoryContainer.style.display = 'block';
    if (DOM.menu) DOM.menu.style.display = 'none';
    if (DOMcat.numbersMenuContainer) DOMcat.numbersMenuContainer.style.display = 'none';
    if (DOM.game) DOM.game.style.display = 'none';
    
    // FORÇAR O ESTILO DOS BOTÕES DE CATEGORIA
    const catBtns = document.querySelector('.category-buttons');
    if (catBtns) {
        catBtns.style.display = 'flex';
        catBtns.style.flexDirection = 'column';
        catBtns.style.gap = '25px';
        catBtns.style.margin = '30px 0';
    }
    
    const cards = document.querySelectorAll('.category-card');
    cards.forEach(card => {
        card.style.display = 'block';
        card.style.visibility = 'visible';
        card.style.opacity = '1';
    });
    
    // Atualizar nome do usuário
    if (window.currentUser && !window.isGuest) {
        if (DOMcat.categoryUserInfo) DOMcat.categoryUserInfo.style.display = 'flex';
        if (DOMcat.categoryUserName) {
            const email = window.currentUser.email || '';
            const name = email.split('@')[0];
            DOMcat.categoryUserName.textContent = name;
        }
    } else if (window.isGuest) {
        if (DOMcat.categoryUserInfo) DOMcat.categoryUserInfo.style.display = 'flex';
        if (DOMcat.categoryUserName) DOMcat.categoryUserName.textContent = 'Guest';
    } else {
        if (DOMcat.categoryUserInfo) DOMcat.categoryUserInfo.style.display = 'none';
    }
}

function showNumbersMenu() {
    ScreenManager.setScreen('numbersMenu');
    currentScreen = 'numbersMenu';  
    if (DOMcat.categoryContainer) DOMcat.categoryContainer.style.display = 'none';
    if (DOMcat.numbersMenuContainer) DOMcat.numbersMenuContainer.style.display = 'block';
}

// ============================================
// EVENTOS DOS BOTÕES
// ============================================

if (DOMcat.categoryNumbersBtn) {
    DOMcat.categoryNumbersBtn.addEventListener('click', () => {
        navigateTo(SCREENS.NUMBERS_MENU);
    });
}

if (DOMcat.categoryWordsBtn) {
    DOMcat.categoryWordsBtn.addEventListener('click', () => {
        navigateTo(SCREENS.WORDS_MENU);
    });
}

document.getElementById('back-to-category-btn')?.addEventListener('click', goBack);
document.getElementById('back-to-category-from-vocab')?.addEventListener('click', goBack);

if (DOMcat.categoryLogoutBtn) {
    DOMcat.categoryLogoutBtn.addEventListener('click', () => {
        if (typeof signOut === 'function') {
            signOut();
        } else if (firebase && firebase.auth) {
            firebase.auth().signOut().then(() => {
                location.reload();
            });
        }
    });
}

