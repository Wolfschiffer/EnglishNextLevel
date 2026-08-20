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
// SISTEMA DE NAVEGAÇÃO + BOTÃO VOLTAR DO NAVEGADOR/CELULAR
// ============================================

let navigationStack = []; // Telas anteriores dentro do jogo
let currentScreen = null;

const APP_HISTORY_MARKER = 'english-next-level-navigation';

const SCREENS = {
    LOGIN: 'login',
    CATEGORIES: 'categories',
    NUMBERS_MENU: 'numbersMenu',
    NUMBERS_GAME: 'numbersGame',
    WORDS_MENU: 'wordsMenu',
    WORDS_SUBMENU: 'wordsSubmenu',
    WORDS_SUBMENU_PAST: 'wordsSubmenuPast',
    WORDS_GAME: 'wordsGame',
    TOPICS_MENU: 'topicsMenu',
    TOPIC_LEVEL: 'topicLevel',
    TOPIC_GAME_MENU: 'topicGameMenu',
    TOPIC_MATCH: 'topicMatch',
    TOPIC_SPEAK: 'topicSpeak'
};

function isAppHistoryState(state) {
    return Boolean(state && state.__app === APP_HISTORY_MARKER && state.screen);
}

function buildAppHistoryState(screen) {
    return {
        __app: APP_HISTORY_MARKER,
        screen,
        stack: [...navigationStack]
    };
}

function replaceCurrentBrowserState(screen = currentScreen) {
    if (!screen || !window.history?.replaceState) return;
    window.history.replaceState(buildAppHistoryState(screen), '', window.location.href);
}

function pushBrowserState(screen) {
    if (!screen || !window.history?.pushState) return;

    // Garante que a entrada a partir da qual estamos navegando também pertence ao app.
    if (!isAppHistoryState(window.history.state)) {
        replaceCurrentBrowserState(currentScreen || screen);
    }

    window.history.pushState(buildAppHistoryState(screen), '', window.location.href);
}

// Função para mostrar a tela
function showScreen(screen, options = {}) {
    if (![SCREENS.WORDS_MENU, SCREENS.WORDS_SUBMENU, SCREENS.WORDS_SUBMENU_PAST, SCREENS.WORDS_GAME].includes(screen)) {
        closeWordsSettings();
    }

    // Se o jogador sair do Vocabulary Match antes de terminar, encerra o cronômetro.
    if (currentScreen === SCREENS.WORDS_GAME && screen !== SCREENS.WORDS_GAME) {
        stopVocabularyTimer();
        hideVocabularyStartModal();
    }

    // Clean up TOPICS game interactions when leaving their screens.
    if (currentScreen === SCREENS.TOPIC_MATCH && screen !== SCREENS.TOPIC_MATCH) {
        window.TopicMatchPairs?.leaveGame?.();
    }
    if (currentScreen === SCREENS.TOPIC_SPEAK && screen !== SCREENS.TOPIC_SPEAK) {
        window.TopicSpeakGame?.leaveGame?.();
    }

    // Só esconde o auth-container se não for a tela de login
    if (!window.currentUser && !window.isGuest && screen !== SCREENS.LOGIN) {
        screen = SCREENS.LOGIN;
    }
    
    ScreenManager.setScreen(screen);

    const categoryHomeRoot = document.getElementById('category-container');
    categoryHomeRoot?.classList.remove('category-home-active');

    console.log(`📱 Mostrando tela: ${screen}`);
    
    const auth = document.getElementById('auth-container');
    const category = document.getElementById('category-container');
    const numbersMenu = document.getElementById('numbers-menu-container');
    const game = document.getElementById('game-container');
    const vocab = document.getElementById('vocab-game-container');
    const wordsMenu = document.getElementById('words-menu-container');
    const simpleVerbsSubmenu = document.getElementById('simple-verbs-submenu');
    const simpleVerbsPastSubmenu = document.getElementById('simple-verbs-past-submenu');
    const topicsMenu = document.getElementById('topics-menu-container');
    const topicLevel = document.getElementById('topic-level-container');
    const topicGameMenu = document.getElementById('topic-game-menu-container');
    const topicMatch = document.getElementById('topic-match-container');
    const topicSpeak = document.getElementById('topic-speak-container');
    const simpleVerbsBtn = document.getElementById('simple-verbs-btn');
    const simpleVerbsPastBtn = document.getElementById('simple-verbs-past-btn');
    
    // Esconde todas
    if (auth) auth.style.display = 'none';
    if (category) category.style.display = 'none';
    if (numbersMenu) numbersMenu.style.display = 'none';
    if (game) game.style.display = 'none';
    if (vocab) vocab.style.display = 'none';
    if (wordsMenu) wordsMenu.style.display = 'none';
    if (simpleVerbsSubmenu) simpleVerbsSubmenu.style.display = 'none';
    if (simpleVerbsPastSubmenu) simpleVerbsPastSubmenu.style.display = 'none';
    if (topicsMenu) topicsMenu.style.display = 'none';
    if (topicLevel) topicLevel.style.display = 'none';
    if (topicGameMenu) topicGameMenu.style.display = 'none';
    if (topicMatch) topicMatch.style.display = 'none';
    if (topicSpeak) topicSpeak.style.display = 'none';
    
    // Mostra a tela escolhida
    switch(screen) {
        case SCREENS.LOGIN:
            if (auth) auth.style.display = 'block';
            break;
            
        case SCREENS.CATEGORIES:
            if (category) {
                category.style.display = 'block';
                category.classList.add('category-home-active');
            }
            const catBtns = document.querySelector('.category-buttons');
            if (catBtns) catBtns.style.display = 'grid';
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

        case SCREENS.TOPICS_MENU:
            if (topicsMenu) topicsMenu.style.display = 'block';
            if (window.TopicApp && typeof window.TopicApp.syncUserInfo === 'function') {
                window.TopicApp.syncUserInfo();
            }
            break;

        case SCREENS.TOPIC_LEVEL:
            if (topicLevel) topicLevel.style.display = 'block';
            break;

        case SCREENS.TOPIC_GAME_MENU:
            if (topicGameMenu) topicGameMenu.style.display = 'block';
            break;

        case SCREENS.TOPIC_MATCH:
            if (topicMatch) topicMatch.style.display = 'block';
            break;

        case SCREENS.TOPIC_SPEAK:
            if (topicSpeak) topicSpeak.style.display = 'block';
            break;
    }
    
    currentScreen = screen;
}

// Navegar para uma tela: atualiza a pilha interna e o histórico real do navegador.
// Isso faz o botão/gesto VOLTAR do Android/iPhone percorrer as telas do jogo.
function navigateTo(screen, options = {}) {
    console.log(`📍 Navegando para: ${screen}`);

    // Firebase/Guest pode exibir Categories diretamente sem passar pelo navegador interno.
    // Normaliza esse caso antes de criar a próxima entrada do histórico.
    if (
        currentScreen === SCREENS.LOGIN &&
        (window.currentUser || window.isGuest) &&
        screen !== SCREENS.LOGIN
    ) {
        navigationStack = [];
        currentScreen = SCREENS.CATEGORIES;
        ScreenManager.setScreen(SCREENS.CATEGORIES);
        replaceCurrentBrowserState(SCREENS.CATEGORIES);
    }
    
    if (currentScreen === screen) {
        console.log(`⚠️ Já está na tela ${screen}, ignorando`);
        return;
    }
    
    if (currentScreen && currentScreen !== screen) {
        navigationStack.push(currentScreen);
        console.log(`➕ Adicionado ao histórico: ${currentScreen}`);
    }
    
    showScreen(screen, options);
    pushBrowserState(currentScreen);
}

function cleanBeforeBack() {
    const simpleSubmenu = document.getElementById('simple-verbs-submenu');
    const pastSubmenu = document.getElementById('simple-verbs-past-submenu');
    const vocabContainer = document.getElementById('vocab-game-container');
    
    if (simpleSubmenu) simpleSubmenu.style.display = 'none';
    if (pastSubmenu) pastSubmenu.style.display = 'none';
    if (vocabContainer) vocabContainer.style.display = 'none';
}

// Voltar uma ou mais telas.
// Botões internos usam a MESMA pilha do botão físico/gesto do aparelho.
function goBack(steps = 1) {
    const requestedSteps = Math.max(1, Number.parseInt(steps, 10) || 1);
    console.log(`◀ goBack chamado (${requestedSteps})`);
    console.log("📚 Pilha atual:", navigationStack);

    if (navigationStack.length === 0) {
        // Na raiz do jogo, deixa o navegador voltar normalmente para a página anterior.
        if (currentScreen === SCREENS.CATEGORIES || currentScreen === SCREENS.LOGIN) {
            window.history.back();
            return;
        }

        // Segurança para algum estado antigo/sem histórico.
        showScreen(SCREENS.CATEGORIES);
        navigationStack = [];
        replaceCurrentBrowserState(SCREENS.CATEGORIES);
        return;
    }

    const actualSteps = Math.min(requestedSteps, navigationStack.length);

    if (isAppHistoryState(window.history.state)) {
        // O popstate fará a troca visual quando o histórico terminar de voltar.
        window.history.go(-actualSteps);
        return;
    }

    // Fallback para navegadores muito antigos ou histórico não inicializado.
    cleanBeforeBack();
    let previousScreen = currentScreen;
    for (let i = 0; i < actualSteps; i += 1) {
        previousScreen = navigationStack.pop() || SCREENS.CATEGORIES;
    }
    showScreen(previousScreen);
    replaceCurrentBrowserState(previousScreen);
}

// Recebe tanto o botão físico/gesto de voltar quanto history.back()/history.go()
// disparados pelos botões do próprio jogo.
window.addEventListener('popstate', (event) => {
    if (!isAppHistoryState(event.state)) {
        return;
    }

    console.log('📱 Voltar do navegador/celular:', event.state.screen);
    cleanBeforeBack();

    navigationStack = Array.isArray(event.state.stack)
        ? [...event.state.stack]
        : [];

    showScreen(event.state.screen);
});

function startNumberGame(gameType) {
    loadEagleSprites();
    navigateTo(SCREENS.NUMBERS_GAME);
    window.selectGame(gameType);
    updateGameUserName();
}


// Inicializar
function initNavigation() {
    const initialize = () => {
        setTimeout(() => {
            const initialScreen = (window.currentUser || window.isGuest)
                ? SCREENS.CATEGORIES
                : SCREENS.LOGIN;

            navigationStack = [];
            showScreen(initialScreen);
            replaceCurrentBrowserState(initialScreen);
        }, 100);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
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

// ============================================
// CONFIGURAÇÕES GLOBAIS DE ÁUDIO
// ============================================
// Voz e SFX usam os mesmos volumes em NUMBERS, WORDS e TOPICS.
// Mantemos os IDs CSS/HTML "words-*" do modal existente por compatibilidade,
// mas o controle agora é global.
const GLOBAL_SFX_STORAGE_KEY = 'englishNextLevel.sfxVolume';
const LEGACY_WORDS_SFX_STORAGE_KEY = 'englishNextLevel.wordsSfxVolume';
const VOICE_VOLUME_STORAGE_KEY = 'englishNextLevel.voiceVolume';

let globalSfxVolume = 100;
let globalVoiceVolume = 100;

function clampAudioVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 100;
    return Math.max(0, Math.min(100, Math.round(numeric)));
}

function readSessionVolume(key, fallback = 100) {
    try {
        const saved = window.sessionStorage.getItem(key);
        return saved === null ? fallback : clampAudioVolume(saved);
    } catch (error) {
        return fallback;
    }
}

function writeSessionVolume(key, value) {
    try {
        window.sessionStorage.setItem(key, String(clampAudioVolume(value)));
    } catch (error) {
        // Mantém o valor em memória quando sessionStorage não estiver disponível.
    }
}

function loadGlobalAudioVolumes() {
    globalVoiceVolume = readSessionVolume(VOICE_VOLUME_STORAGE_KEY, 100);

    try {
        const globalSaved = window.sessionStorage.getItem(GLOBAL_SFX_STORAGE_KEY);
        if (globalSaved !== null) {
            globalSfxVolume = clampAudioVolume(globalSaved);
        } else {
            // Migra automaticamente o volume antigo do WORDS, se existir.
            const legacySaved = window.sessionStorage.getItem(LEGACY_WORDS_SFX_STORAGE_KEY);
            globalSfxVolume = legacySaved === null ? 100 : clampAudioVolume(legacySaved);
            window.sessionStorage.setItem(GLOBAL_SFX_STORAGE_KEY, String(globalSfxVolume));
        }
    } catch (error) {
        globalSfxVolume = 100;
    }
}

function getGlobalVoiceVolume() {
    globalVoiceVolume = readSessionVolume(VOICE_VOLUME_STORAGE_KEY, globalVoiceVolume);
    return globalVoiceVolume;
}

function getGlobalSfxVolume() {
    globalSfxVolume = readSessionVolume(GLOBAL_SFX_STORAGE_KEY, globalSfxVolume);
    return globalSfxVolume;
}

function getAudioVolumeIcon(volume) {
    const level = clampAudioVolume(volume);
    if (level === 0) return '🔇';
    if (level <= 33) return '🔈';
    if (level <= 66) return '🔉';
    return '🔊';
}

function updateGlobalAudioSettingsUI() {
    const sfxVolume = getGlobalSfxVolume();
    const voiceVolume = getGlobalVoiceVolume();

    const sfxSlider = document.getElementById('words-sfx-volume');
    const sfxValue = document.getElementById('words-sfx-volume-value');
    const sfxIcon = document.getElementById('words-sfx-volume-icon');

    if (sfxSlider) {
        sfxSlider.value = String(sfxVolume);
        sfxSlider.setAttribute('aria-valuenow', String(sfxVolume));
        sfxSlider.style.setProperty('--words-volume-percent', `${sfxVolume}%`);
    }
    if (sfxValue) sfxValue.textContent = `${sfxVolume}%`;
    if (sfxIcon) sfxIcon.textContent = getAudioVolumeIcon(sfxVolume);

    const voiceSlider = document.getElementById('words-voice-volume');
    const voiceValue = document.getElementById('words-voice-volume-value');
    const voiceIcon = document.getElementById('words-voice-volume-icon');

    if (voiceSlider) {
        voiceSlider.value = String(voiceVolume);
        voiceSlider.setAttribute('aria-valuenow', String(voiceVolume));
        voiceSlider.style.setProperty('--words-volume-percent', `${voiceVolume}%`);
    }
    if (voiceValue) voiceValue.textContent = `${voiceVolume}%`;
    if (voiceIcon) voiceIcon.textContent = getAudioVolumeIcon(voiceVolume);

    window.dispatchEvent(new CustomEvent('english-next-level-audio-volume-change', {
        detail: { voiceVolume, sfxVolume }
    }));
}

function setGlobalSfxVolume(value) {
    globalSfxVolume = clampAudioVolume(value);
    writeSessionVolume(GLOBAL_SFX_STORAGE_KEY, globalSfxVolume);
    updateGlobalAudioSettingsUI();
}

function setGlobalVoiceVolume(value) {
    globalVoiceVolume = clampAudioVolume(value);
    writeSessionVolume(VOICE_VOLUME_STORAGE_KEY, globalVoiceVolume);

    if (globalVoiceVolume === 0) {
        EnglishSpeechEngine?.stop?.();
        stopWordsPronunciation?.();
    }

    updateGlobalAudioSettingsUI();
}

function getAudioSettingsLabel() {
    if (currentScreen === SCREENS.NUMBERS_GAME || currentScreen === SCREENS.NUMBERS_MENU) return 'NUMBERS';
    if (currentScreen === SCREENS.WORDS_GAME || currentScreen === SCREENS.WORDS_MENU ||
        currentScreen === SCREENS.WORDS_SUBMENU || currentScreen === SCREENS.WORDS_SUBMENU_PAST) return 'WORDS';
    if (currentScreen === SCREENS.TOPIC_MATCH) return 'MATCH PAIRS';
    if (currentScreen === SCREENS.TOPICS_MENU || currentScreen === SCREENS.TOPIC_LEVEL ||
        currentScreen === SCREENS.TOPIC_GAME_MENU) return 'TOPICS';
    return 'AUDIO';
}

function openWordsSettings() {
    const overlay = document.getElementById('words-settings-overlay');
    if (!overlay) return;

    loadGlobalAudioVolumes();
    updateGlobalAudioSettingsUI();

    const kicker = document.getElementById('audio-settings-kicker');
    if (kicker) kicker.textContent = getAudioSettingsLabel();

    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('words-settings-open');
    requestAnimationFrame(() => document.getElementById('words-sfx-volume')?.focus({ preventScroll: true }));
}

function closeWordsSettings() {
    const overlay = document.getElementById('words-settings-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('words-settings-open');
}

function initWordsSettings() {
    loadGlobalAudioVolumes();
    updateGlobalAudioSettingsUI();

    [
        'category-settings-btn',
        'words-menu-settings-btn',
        'words-game-settings-btn',
        'numbers-menu-settings-btn',
        'numbers-game-settings-btn',
        'topics-menu-settings-btn',
        'topic-match-settings-btn'
    ].forEach((id) => {
        document.getElementById(id)?.addEventListener('click', openWordsSettings);
    });

    document.getElementById('words-settings-close')?.addEventListener('click', closeWordsSettings);
    document.getElementById('words-settings-overlay')?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) closeWordsSettings();
    });
    document.getElementById('words-sfx-volume')?.addEventListener('input', (event) => {
        setGlobalSfxVolume(event.target.value);
    });
    document.getElementById('words-sfx-volume')?.addEventListener('change', () => {
        ProgrammaticSfxEngine.primeFromUserGesture();
        if (getGlobalSfxVolume() > 0) playSound('correct');
    });
    document.getElementById('words-voice-volume')?.addEventListener('input', (event) => {
        setGlobalVoiceVolume(event.target.value);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.getElementById('words-settings-overlay')?.classList.contains('visible')) {
            closeWordsSettings();
        }
    });
}

// Aliases temporários para código legado que ainda use os nomes antigos.
function getWordsVoiceVolume() { return getGlobalVoiceVolume(); }
function setWordsVoiceVolume(value) { setGlobalVoiceVolume(value); }
function setWordsSfxVolume(value) { setGlobalSfxVolume(value); }
function getWordsVolumeIcon(volume) { return getAudioVolumeIcon(volume); }

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
let gameActive = false, gameEnded = false;
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

function loadMenuImages() {
    console.log('Loading menu images...');

    eagleImages.idle = new Image();
    eagleImages.idle.src = 'images/flap_01.png';
    eagleImages.idle.onload = () => console.log('✅ Idle image loaded');
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

        console.log('✅ Menu eagle images loaded');
    };

    menuEagleImage.onerror = () => console.error('❌ Failed to load menu eagle');
}

function loadEagleSprites() {
    if (eagleSpritesLoaded) return;

    console.log('Loading eagle sprites...');

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
    console.log('✅ Eagle sprites loading started');
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

const sfxCache = {};

// ============================================
// MOTOR COMPARTILHADO DE VOZ (AMERICAN ENGLISH)
// ============================================
// A pronúncia falada deve usar um único caminho baseado na Web Speech API.
// NUMBERS e WORDS usam este mesmo motor. TOPICS permanece congelado
// durante a estabilização, embora também use a Web Speech API.
const EnglishSpeechEngine = (() => {
    const DEFAULT_LANG = 'en-US';
    const DEFAULT_RATE = 0.9;
    let activeUtterance = null;
    let primed = false;

    function supported() {
        return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
    }

    function getAmericanVoice(lang = DEFAULT_LANG) {
        if (!supported()) return null;
        const voices = window.speechSynthesis.getVoices?.() || [];
        const target = String(lang || DEFAULT_LANG).toLowerCase();

        return voices.find((voice) => voice.lang?.toLowerCase() === target) ||
            voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-us')) ||
            voices.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
            null;
    }

    function stop() {
        if (!supported()) return;
        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            console.warn('Speech engine: could not stop the current utterance.', error);
        }
        activeUtterance = null;
    }

    function prime(lang = DEFAULT_LANG) {
        if (primed || !supported()) return supported();

        try {
            const utterance = new SpeechSynthesisUtterance(' ');
            utterance.lang = lang;
            utterance.volume = 0;
            utterance.rate = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
            window.speechSynthesis.resume?.();
            primed = true;
            return true;
        } catch (error) {
            console.warn('Speech engine: could not prime speech output.', error);
            return false;
        }
    }

    function speak(text, options = {}) {
        const cleanText = String(text || '').trim();
        if (!cleanText || !supported()) return false;

        const lang = options.lang || DEFAULT_LANG;
        const rate = Number.isFinite(Number(options.rate)) ? Number(options.rate) : DEFAULT_RATE;
        const volume = Math.max(0, Math.min(1, Number.isFinite(Number(options.volume)) ? Number(options.volume) : 1));
        if (volume <= 0) {
            stop();
            return true;
        }

        stop();

        try {
            const utterance = new SpeechSynthesisUtterance(cleanText);
            const voice = getAmericanVoice(lang);
            utterance.lang = lang;
            utterance.rate = Math.max(0.5, Math.min(1.5, rate));
            utterance.volume = volume;
            if (voice) utterance.voice = voice;

            activeUtterance = utterance;
            const cleanup = () => {
                if (activeUtterance === utterance) activeUtterance = null;
                options.onEnd?.();
            };
            utterance.onend = cleanup;
            utterance.onerror = (event) => {
                if (activeUtterance === utterance) activeUtterance = null;
                console.warn('Speech engine: utterance failed.', event?.error || event);
                options.onError?.(event);
            };

            // Alguns navegadores móveis deixam o sintetizador em pausa após
            // troca de aba, microfone ou suspensão do sistema.
            window.speechSynthesis.resume?.();
            window.speechSynthesis.speak(utterance);
            window.speechSynthesis.resume?.();
            return true;
        } catch (error) {
            activeUtterance = null;
            console.warn('Speech engine: playback failed.', error);
            options.onError?.(error);
            return false;
        }
    }

    return { supported, getAmericanVoice, prime, speak, stop };
})();

// Exposto para os módulos que precisarem compartilhar a mesma voz/configuração.
window.EnglishNextLevelSpeech = EnglishSpeechEngine;

// ============================================
// MOTOR COMPARTILHADO DE SFX — SEM ARQUIVOS MP3
// ============================================
// Gera efeitos curtos diretamente com Web Audio API. Isso elimina a dependência
// dos MP3 de SFX e evita o problema de HTMLAudio silencioso observado no mobile.
const ProgrammaticSfxEngine = (() => {
    let context = null;

    function supported() {
        return Boolean(window.AudioContext || window.webkitAudioContext);
    }

    function getContext() {
        if (!supported()) return null;
        if (!context || context.state === 'closed') {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            try {
                context = new AudioContextCtor({ latencyHint: 'interactive' });
            } catch (error) {
                // Alguns navegadores antigos não aceitam options no construtor.
                context = new AudioContextCtor();
            }
        }
        return context;
    }

    function tone(ctx, { frequency, start, duration, gain, type = 'sine' }) {
        const oscillator = ctx.createOscillator();
        const envelope = ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);

        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.012);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.connect(envelope);
        envelope.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    }

    // Chrome mobile é mais confiável quando o AudioContext e um source node são
    // efetivamente usados dentro de um CLICK/TOQUE real. Apenas chamar resume()
    // em um evento anterior não garante que o contexto saia de "suspended".
    function primeFromUserGesture() {
        const ctx = getContext();
        if (!ctx) return false;

        try {
            // Source node quase inaudível: start() ocorre SINCRONAMENTE dentro
            // do gesto do usuário e serve apenas para liberar o output do Web Audio.
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const now = ctx.currentTime;

            oscillator.frequency.setValueAtTime(440, now);
            gain.gain.setValueAtTime(0.00001, now);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(now);
            oscillator.stop(now + 0.025);

            if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
                const resumePromise = ctx.resume();
                if (resumePromise && typeof resumePromise.catch === 'function') {
                    resumePromise.catch((error) => {
                        console.warn('SFX engine: resume after user gesture failed.', error);
                    });
                }
            }

            return true;
        } catch (error) {
            console.warn('SFX engine: could not prime audio from user gesture.', error);
            return false;
        }
    }

    async function unlock() {
        const ctx = getContext();
        if (!ctx) return false;
        try {
            if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
                await ctx.resume();
            }
            return ctx.state === 'running';
        } catch (error) {
            console.warn('SFX engine: could not unlock audio context.', error);
            return false;
        }
    }

    function scheduleEffect(ctx, effectType, level) {
        const now = ctx.currentTime + 0.008;
        // Um pouco mais forte que a primeira versão; ainda deixa headroom.
        const master = 0.28 * level;

        switch (effectType) {
            case 'correct':
                tone(ctx, { frequency: 660, start: now, duration: 0.12, gain: master, type: 'sine' });
                tone(ctx, { frequency: 880, start: now + 0.095, duration: 0.16, gain: master, type: 'sine' });
                break;

            case 'wrong':
                tone(ctx, { frequency: 220, start: now, duration: 0.19, gain: master * 0.9, type: 'square' });
                tone(ctx, { frequency: 165, start: now + 0.105, duration: 0.20, gain: master * 0.78, type: 'square' });
                break;

            case 'win':
                [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
                    tone(ctx, {
                        frequency,
                        start: now + index * 0.085,
                        duration: 0.21,
                        gain: master,
                        type: 'triangle'
                    });
                });
                break;

            case 'gameOver':
                [392, 293.66, 220].forEach((frequency, index) => {
                    tone(ctx, {
                        frequency,
                        start: now + index * 0.11,
                        duration: 0.21,
                        gain: master * 0.92,
                        type: 'triangle'
                    });
                });
                break;

            default:
                return false;
        }

        return true;
    }

    async function play(type, volume = getGlobalSfxVolume() / 100) {
        const level = Math.max(0, Math.min(1, Number(volume) || 0));
        if (level <= 0) return false;

        const ctx = getContext();
        if (!ctx) return false;

        try {
            if (ctx.state !== 'running') {
                await ctx.resume();
            }
            if (ctx.state !== 'running') {
                console.warn(`SFX engine: AudioContext is ${ctx.state}; sound was not scheduled.`);
                return false;
            }

            return scheduleEffect(ctx, type, level);
        } catch (error) {
            console.warn('SFX engine: playback failed.', error);
            return false;
        }
    }

    function getState() {
        return context?.state || 'not-created';
    }

    return { supported, unlock, primeFromUserGesture, play, getState };
})();

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
        rate: 0.9,
        volume: voiceVolume / 100
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
    // START é uma interação explícita do usuário e é o melhor ponto para
    // preparar a saída de voz em navegadores móveis.
    // WORDS TTS is activated directly by the user's tap on the pronunciation button.
    ProgrammaticSfxEngine.primeFromUserGesture();

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




// ============================================
// ÁUDIO DO JOGO VERBS
// ============================================

// WORDS usa a mesma abordagem TTS comprovadamente funcional em TOPICS/SPEAK:
// SpeechSynthesisUtterance criado diretamente no toque do botão de áudio.
// O motor compartilhado EnglishSpeechEngine continua sendo usado pelo NUMBERS.
const WORDS_TTS_OVERRIDES = {
    past: {
        // Mantém "read" escrito na tela, mas pronuncia o passado como "red".
        'read': 'red',
        'was / were': 'was, were'
    }
};

let activeWordsUtterance = null;

function getVerbSpeechText(text, context) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return '';
    return WORDS_TTS_OVERRIDES[context]?.[cleanText] || cleanText;
}

function getWordsAmericanVoice(locale = 'en-US') {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const target = String(locale || 'en-US').toLowerCase();

    return voices.find((voice) => voice.lang?.toLowerCase() === target) ||
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-us')) ||
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('en')) ||
        null;
}

function stopWordsPronunciation() {
    if ('speechSynthesis' in window) {
        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            console.warn('WORDS TTS: could not stop speech.', error);
        }
    }
    activeWordsUtterance = null;
}

function playVerbAudio(text, context) {
    const speechText = getVerbSpeechText(text, context);
    if (!speechText || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
        return;
    }

    const voiceVolume = getWordsVoiceVolume();
    stopWordsPronunciation();
    if (voiceVolume <= 0) return;

    try {
        // Deliberadamente espelha TOPICS/SPEAK, que já foi validado no mobile.
        const utterance = new SpeechSynthesisUtterance(speechText);
        const voice = getWordsAmericanVoice('en-US');
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.volume = voiceVolume / 100;
        if (voice) utterance.voice = voice;

        activeWordsUtterance = utterance;
        const cleanup = () => {
            if (activeWordsUtterance === utterance) activeWordsUtterance = null;
        };
        utterance.onend = cleanup;
        utterance.onerror = cleanup;

        window.speechSynthesis.speak(utterance);
    } catch (error) {
        activeWordsUtterance = null;
        console.warn('WORDS TTS: pronunciation failed.', error);
    }
}

function preloadCurrentGameAudios() {
    // WORDS não usa mais arquivos MP3 de pronúncia. Apenas força a leitura da
    // lista de vozes, sem iniciar uma fala silenciosa que alguns mobiles tratam mal.
    getWordsAmericanVoice('en-US');
}

function createAudioButton(text, context, position = 'left') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `vocab-audio-btn ${position}`;
    btn.setAttribute('aria-label', `Ouvir ${text}`);
    btn.setAttribute('draggable', 'false');
    btn.style.touchAction = 'manipulation';

    btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M3 9v6h4l5 5V4L7 9H3z" stroke="currentColor" fill="none" stroke-width="2"/>
            <path d="M16 8a5 5 0 0 1 0 8" stroke="currentColor" fill="none" stroke-width="2"/>
            <path d="M19 5a9 9 0 0 1 0 14" stroke="currentColor" fill="none" stroke-width="2"/>
        </svg>
    `;

    btn.addEventListener('dragstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playVerbAudio(text, context);
    });

    return btn;
}


// Pronúncia ao tocar diretamente em um card de WORDS.
// pointerdown acontece no primeiro contato (mouse, caneta ou toque) e não
// impede o drag-and-drop que começa logo depois.
function addVocabularyCardPronunciation(element, text, context) {
    if (!element || !text) return;

    element.addEventListener('pointerdown', (event) => {
        // Ignora botões secundários do mouse e evita duplicar a fala quando
        // o usuário toca no botão de áudio explícito de um par já resolvido.
        if (typeof event.button === 'number' && event.button !== 0) return;
        if (event.target.closest('.vocab-audio-btn')) return;
        playVerbAudio(text, context);
    });
}

function getVocabularyItemTextById(items, id) {
    const item = items.find((candidate) => Number(candidate.id) === Number(id));
    return item?.text || '';
}

function playMatchedPastPronunciation(portugueseId) {
    if (currentVerbGameType !== 'past') return;
    const pastText = getVocabularyItemTextById(currentPortugueseWords, portugueseId);
    if (pastText) playVerbAudio(pastText, 'past');
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
    
    loadMenuImages();

    if (DOM.menuButton) {
        DOM.menuButton.removeEventListener('click', showMenu);
        DOM.menuButton.addEventListener('click', () => {
            console.log("🏠 Botão voltar clicado no jogo");
            
            gameActive = false;
            EnglishSpeechEngine.stop();
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
let currentVerbGameType = 'present';

// Estado independente de pontuação/tempo dos jogos de vocabulário.
// Não reutiliza as variáveis do jogo de números para evitar interferência entre modos.
let vocabScore = 0;
let vocabStartTime = null;
let vocabLastMatchTime = null;
let vocabElapsedSeconds = 0;
let vocabTimerInterval = null;
let vocabGameFinished = false;
let vocabGameStarted = false;

const englishList = document.getElementById('english-words-list');
const portugueseList = document.getElementById('portuguese-words-list');
const vocabMatchesSpan = document.getElementById('vocab-matches');
const vocabTotalSpan = document.getElementById('vocab-total');
const vocabScoreSpan = document.getElementById('vocab-score');
const vocabTimerSpan = document.getElementById('vocab-timer');
const vocabMessage = document.getElementById('vocab-message');
const vocabLeftHeading = document.getElementById('vocab-left-heading');
const vocabRightHeading = document.getElementById('vocab-right-heading');
const vocabStartOverlay = document.getElementById('vocab-start-overlay');
const vocabStartBtn = document.getElementById('vocab-start-btn');

function showVocabularyStartModal() {
    if (!vocabStartOverlay) return;
    vocabStartOverlay.classList.add('active');
    vocabStartOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('vocab-modal-open');

    // Move o foco para o botão sem iniciar o jogo automaticamente.
    requestAnimationFrame(() => vocabStartBtn?.focus());
}

function hideVocabularyStartModal() {
    if (!vocabStartOverlay) return;
    vocabStartOverlay.classList.remove('active');
    vocabStartOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('vocab-modal-open');
}

function beginVocabularyGame() {
    if (vocabGameStarted) return;

    // START é uma ativação explícita do usuário: libera os SFX legados e,
    // principalmente, prepara o mesmo sintetizador de voz usado pelo NUMBERS.
    ProgrammaticSfxEngine.primeFromUserGesture();
    EnglishSpeechEngine.prime('en-US');

    vocabGameStarted = true;
    hideVocabularyStartModal();
    startVocabularyTimer();
}

vocabStartBtn?.addEventListener('click', beginVocabularyGame);

function formatVocabularyTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateVocabularyStats() {
    if (vocabScoreSpan) vocabScoreSpan.textContent = vocabScore;
    if (vocabTimerSpan) vocabTimerSpan.textContent = formatVocabularyTime(vocabElapsedSeconds);
}

function stopVocabularyTimer() {
    if (vocabTimerInterval) {
        clearInterval(vocabTimerInterval);
        vocabTimerInterval = null;
    }

    if (vocabStartTime && !vocabGameFinished) {
        vocabElapsedSeconds = Math.floor((Date.now() - vocabStartTime) / 1000);
    }
    updateVocabularyStats();
}

function startVocabularyTimer() {
    if (vocabTimerInterval) clearInterval(vocabTimerInterval);

    vocabGameStarted = true;
    vocabStartTime = Date.now();
    vocabLastMatchTime = vocabStartTime;
    vocabElapsedSeconds = 0;
    vocabGameFinished = false;
    updateVocabularyStats();

    vocabTimerInterval = setInterval(() => {
        if (vocabGameFinished || !vocabStartTime) return;
        vocabElapsedSeconds = Math.floor((Date.now() - vocabStartTime) / 1000);
        updateVocabularyStats();
    }, 250);
}

function calculateVocabularyMatchPoints() {
    const now = Date.now();
    const referenceTime = vocabLastMatchTime || vocabStartTime || now;
    const secondsSinceLastMatch = (now - referenceTime) / 1000;
    vocabLastMatchTime = now;

    // 100 pontos fixos por acerto + bônus de velocidade.
    // No celular damos um pouco mais de margem porque o gesto de arrastar é naturalmente mais lento.
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

function awardVocabularyMatchPoints() {
    if (vocabGameFinished || !vocabGameStarted) return;
    vocabScore += calculateVocabularyMatchPoints();
    updateVocabularyStats();
}

function finishVocabularyGameStats() {
    if (vocabGameFinished) return;
    vocabElapsedSeconds = vocabStartTime
        ? Math.floor((Date.now() - vocabStartTime) / 1000)
        : vocabElapsedSeconds;
    vocabGameFinished = true;
    vocabGameStarted = false;

    if (vocabTimerInterval) {
        clearInterval(vocabTimerInterval);
        vocabTimerInterval = null;
    }
    updateVocabularyStats();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startVocabularyGame(vocabularyDataParam = null, gameType = 'present') {
    console.log("🎮 Iniciando jogo de vocabulário");
    
    // Usar dados específicos do jogo ou o padrão
    const activeData = vocabularyDataParam || vocabularyDataVerbs1;
    
    console.log(`📊 Tipo de jogo: ${gameType}`);
    console.log(`📊 Usando ${activeData.length} verbos para este jogo`);
    
    currentEnglishWords = activeData.map(item => ({
        id: item.id, text: item.english, matched: false, locked: false
    }));
    
    currentPortugueseWords = activeData.map(item => ({
        id: item.id, text: item.portuguese, matched: false, locked: false
    }));
    
    currentEnglishWords = shuffleArray([...currentEnglishWords]);
    
    // Garante que nenhum cronômetro de uma partida anterior continue rodando.
    if (vocabTimerInterval) {
        clearInterval(vocabTimerInterval);
        vocabTimerInterval = null;
    }

    matchesCount = 0;
    vocabScore = 0;
    vocabStartTime = null;
    vocabLastMatchTime = null;
    vocabElapsedSeconds = 0;
    vocabGameFinished = false;
    vocabGameStarted = false;
    if (vocabMatchesSpan) vocabMatchesSpan.textContent = matchesCount;
    if (vocabTotalSpan) vocabTotalSpan.textContent = activeData.length;
    updateVocabularyStats();
    
    // Armazena o tipo do jogo para uso na renderização dos áudios
    currentVerbGameType = gameType;

    // Os dois modos compartilham o mesmo layout; os títulos mudam conforme o jogo.
    if (gameType === 'past') {
        if (vocabLeftHeading) vocabLeftHeading.textContent = 'SIMPLE PRESENT';
        if (vocabRightHeading) vocabRightHeading.textContent = 'SIMPLE PAST';
    } else {
        if (vocabLeftHeading) vocabLeftHeading.textContent = 'ENGLISH';
        if (vocabRightHeading) vocabRightHeading.textContent = 'PORTUGUÊS';
    }
    
    renderVocabularyLists();
    if (vocabMessage) vocabMessage.innerHTML = '';
    currentScreen = SCREENS.WORDS_GAME;

    // Prepara a voz disponível enquanto o modal está aberto, mas só inicia
    // tempo, pontuação e ativação efetiva do TTS depois do clique em START.
    preloadCurrentGameAudios();
    showVocabularyStartModal();
}


// ============================================
// DRAG AND DROP PARA DESKTOP (REORGANIZAR)
// ============================================

let draggedElement = null;
let draggedIndex = null;

function handleDragStart(e) {
    draggedElement = e.target.closest('.english-item');
    if (!draggedElement) return;
    
    draggedIndex = parseInt(draggedElement.getAttribute('data-index'));
    draggedElement.style.opacity = '0.5';
    
    const englishId = draggedElement.getAttribute('data-id');
    e.dataTransfer.setData('text/plain', englishId);
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
    
    if (!draggedElement || draggedElement.classList.contains('locked')) {
        if (draggedElement) draggedElement.style.opacity = '1';
        draggedElement = null;
        draggedIndex = null;
        return;
    }
    
    let targetPortuguese = e.target.closest('.portuguese-item');
    
    if (!targetPortuguese) {
        if (draggedElement) draggedElement.style.opacity = '1';
        draggedElement = null;
        draggedIndex = null;
        return;
    }
    
    if (targetPortuguese.classList.contains('locked')) {
        if (draggedElement) draggedElement.style.opacity = '1';
        draggedElement = null;
        draggedIndex = null;
        return;
    }
    
    const englishId = parseInt(draggedElement.getAttribute('data-id'));
    const portugueseId = parseInt(targetPortuguese.getAttribute('data-id'));
    
   if (englishId === portugueseId) {
    lockAndMoveToTop(englishId, portugueseId);

    // No Simple Past, o alvo correto é uma palavra em inglês. Ao completar
    // o par, pronuncia automaticamente a forma no passado antes do rerender.
    playMatchedPastPronunciation(portugueseId);

    showVocabMessage('✓ Correct match!', 'success');
    renderVocabularyLists();

    if (matchesCount === currentEnglishWords.length) {
        playSound('win');
        showVocabMessage('🎉 PERFECT! You matched all verbs! 🎉', 'win');
    } else {
        playSound('correct');
    }
} else {
    playSound('wrong');
    showVocabMessage('✗ Wrong match! Try again!', 'error');
}
    
    if (draggedElement) draggedElement.style.opacity = '1';
    
    document.querySelectorAll('.english-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    draggedElement = null;
    draggedIndex = null;
}


// ============================================
// MOSTRA MENSAGEM NO JOGO DE VOCABULÁRIO
// ============================================

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
// VERIFICA E TRAVA OS MATCHES
// ============================================

function checkAndLockMatches() {
    let anyMatch = false;
    
    for (let i = 0; i < currentEnglishWords.length; i++) {
        const englishItem = currentEnglishWords[i];
        const portugueseItem = currentPortugueseWords[i];
        
        if (!englishItem.locked && !portugueseItem.locked && englishItem.id === portugueseItem.id) {
            englishItem.locked = true;
            portugueseItem.locked = true;
            matchesCount++;
            anyMatch = true;
        }
    }
    
    if (anyMatch) {
        if (vocabMatchesSpan) vocabMatchesSpan.textContent = matchesCount;
        showVocabMessage('✓ Correct match! Pair locked!', 'success');
        renderVocabularyLists();
    }
}

// ============================================
// TRAVA O PAR E MOVE PARA O TOPO (MANTENDO ORDEM)
// ============================================

function lockAndMoveToTop(englishId, portugueseId) {
    // Encontra os índices dos itens
    const englishIndex = currentEnglishWords.findIndex(item => item.id === englishId && !item.locked);
    const portugueseIndex = currentPortugueseWords.findIndex(item => item.id === portugueseId && !item.locked);
    
    if (englishIndex === -1 || portugueseIndex === -1) return false;
    
    // Trava os itens
    currentEnglishWords[englishIndex].locked = true;
    currentPortugueseWords[portugueseIndex].locked = true;
    
    // Remove o par da posição atual
    const [movedEnglish] = currentEnglishWords.splice(englishIndex, 1);
    const [movedPortuguese] = currentPortugueseWords.splice(portugueseIndex, 1);
    
    // Conta quantos itens já estão locked (para inserir após eles)
    const lockedCount = currentEnglishWords.filter(item => item.locked).length;
    
    // Insere o novo par na posição correta (após os locked existentes)
    // Se lockedCount = 0, insere na posição 0
    // Se lockedCount = 1, insere na posição 1
    // Se lockedCount = 2, insere na posição 2, etc.
    currentEnglishWords.splice(lockedCount, 0, movedEnglish);
    currentPortugueseWords.splice(lockedCount, 0, movedPortuguese);
    
    matchesCount++;
    if (vocabMatchesSpan) vocabMatchesSpan.textContent = matchesCount;

    // Cada par correto pontua uma única vez. Como esta função só chega aqui
    // quando encontrou dois itens ainda não travados, chamadas duplicadas não somam pontos.
    awardVocabularyMatchPoints();

    if (matchesCount === currentEnglishWords.length) {
        finishVocabularyGameStats();
    }
    
    return true;
}

// ============================================
// RENDERIZA AS LISTAS (SUA VERSÃO)
// ============================================

function renderVocabularyLists() {
    if (!englishList || !portugueseList) return;
    
    // Ordena: locked primeiro, depois unlocked
    const lockedEnglish = currentEnglishWords.filter(item => item.locked);
    const unlockedEnglish = currentEnglishWords.filter(item => !item.locked);
    const sortedEnglish = [...lockedEnglish, ...unlockedEnglish];
    
    const lockedPortuguese = currentPortugueseWords.filter(item => item.locked);
    const unlockedPortuguese = currentPortugueseWords.filter(item => !item.locked);
    const sortedPortuguese = [...lockedPortuguese, ...unlockedPortuguese];
    
    // ============================================
    // COLUNA INGLESA (ESQUERDA)
    // ============================================
    englishList.innerHTML = '';
    sortedEnglish.forEach((item, idx) => {
        const div = document.createElement('div');
        
        if (item.locked) {
            div.className = 'vocab-item english-item locked';
            div.setAttribute('draggable', 'false');
        } else {
            div.className = 'vocab-item english-item';
            div.setAttribute('data-id', item.id);
            div.setAttribute('data-index', idx);
            div.setAttribute('draggable', 'true');
            
            div.addEventListener('dragstart', handleDragStart);
            div.addEventListener('dragend', handleDragEnd);
            div.addEventListener('dragover', handleDragOver);
            div.addEventListener('drop', handleDrop);
            
            div.addEventListener('touchstart', handleTouchStart, { passive: false });
            div.addEventListener('touchmove', handleTouchMove, { passive: false });
            div.addEventListener('touchend', handleTouchEnd);
        }
        
        // Texto do item (sempre presente)
        const textSpan = document.createElement('span');
        textSpan.className = 'vocab-text';
        textSpan.textContent = item.text || item.english || item.word || '?';
        div.appendChild(textSpan);

        // Toda palavra da coluna esquerda está em inglês. A pronúncia começa
        // já no primeiro toque/clique, inclusive quando o gesto vira um drag.
        addVocabularyCardPronunciation(div, item.text, 'english');
        
        // 🔥 BOTÃO DE ÁUDIO: APENAS SE LOCKED
        // ESQUERDA: texto + botão à direita
        if (item.locked) {
            div.classList.add('has-audio');
            const audioBtn = createAudioButton(item.text, 'english', 'right');
            div.appendChild(audioBtn);
        }
        
        englishList.appendChild(div);
    });
    
    // ============================================
    // COLUNA PORTUGUESA (DIREITA)
    // ============================================
    portugueseList.innerHTML = '';
    sortedPortuguese.forEach((item, idx) => {
        const div = document.createElement('div');
        
        if (item.locked) {
            div.className = 'vocab-item portuguese-item locked';
        } else {
            div.className = 'vocab-item portuguese-item';
            div.setAttribute('data-id', item.id);
            
            div.setAttribute('draggable', 'false');
            div.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            div.addEventListener('drop', handleDrop);
        }
        
        // Áudio na coluna da direita somente no Past Tense, pois ali a palavra
        // continua sendo inglês. No Simple Verbs, traduções em português não usam áudio.
        if (item.locked && currentVerbGameType === 'past') {
            div.classList.add('has-audio');
            const audioBtn = createAudioButton(item.text, 'past', 'left');
            div.appendChild(audioBtn);
        } else if (item.locked) {
            div.classList.add('no-audio');
        }
        
        // Texto do item (sempre presente)
        const textSpan = document.createElement('span');
        textSpan.className = 'vocab-text';
        textSpan.textContent = item.text || item.portuguese || item.translation || '?';
        div.appendChild(textSpan);

        // No Simple Past a coluna direita também contém inglês, portanto o
        // card inteiro pode ser tocado para ouvir a forma no passado.
        if (currentVerbGameType === 'past') {
            addVocabularyCardPronunciation(div, item.text, 'past');
        }
        
        portugueseList.appendChild(div);
    });
    
    // Limpa estilos visuais
    document.querySelectorAll('.english-item').forEach(item => {
        item.classList.remove('drag-over', 'dragging-source');
        item.style.opacity = '';
        item.style.transform = '';
        item.style.backgroundColor = '';
        item.style.color = '';
    });
}


// ============================================
// SUPORTE A TOQUE (MOBILE) - MESMO COMPORTAMENTO DO DESKTOP
// ============================================

let touchActive = false;
let touchSourceElement = null;
let touchSourceIndex = null;
let touchClone = null;
let touchStartY = 0;

function handleTouchStart(e) {
    // Verifica se o evento pode ser cancelado
    if (e.cancelable) {
        e.preventDefault();
    }
    
    const target = e.target.closest('.english-item');
    if (!target || target.classList.contains('locked')) return;
    
    touchActive = true;
    touchSourceElement = target;
    touchSourceIndex = parseInt(target.getAttribute('data-index'));
    touchStartY = e.touches[0].clientY;
    
    // === FEEDBACK VISUAL ===
    target.style.opacity = '0.5';
    target.style.transform = 'scale(0.98)';
    target.style.transition = 'all 0.2s ease';
    target.classList.add('dragging-source');
    
    // Cria um clone para seguir o dedo
    touchClone = target.cloneNode(true);
    touchClone.style.position = 'fixed';
    touchClone.style.top = `${e.touches[0].clientY - 20}px`;
    touchClone.style.left = `${e.touches[0].clientX - 50}px`;
    touchClone.style.width = `${target.offsetWidth}px`;
    touchClone.style.opacity = '0.7';
    touchClone.style.pointerEvents = 'none';
    touchClone.style.zIndex = '9999';
    touchClone.style.transform = 'scale(1.05)';
    touchClone.style.transition = 'transform 0.1s ease';
    document.body.appendChild(touchClone);
    
    document.body.classList.add('dragging');
}

function handleTouchMove(e) {
    if (!touchActive || !touchClone) return;
    
    if (e.cancelable) {
        e.preventDefault();
    }
    
    const touchY = e.touches[0].clientY;
    const touchX = e.touches[0].clientX;
    
    // Move o clone
    touchClone.style.top = `${touchY - 20}px`;
    touchClone.style.left = `${touchX - 50}px`;
    
    // Encontra o elemento abaixo do dedo na lista de inglês
    const elemUnderTouch = document.elementsFromPoint(touchX, touchY);
    let targetItem = null;
    
    for (let elem of elemUnderTouch) {
        if (elem.classList && elem.classList.contains('english-item') && !elem.classList.contains('locked')) {
            targetItem = elem;
            break;
        }
    }
    
    // Remove highlight de todos
    document.querySelectorAll('.english-item').forEach(item => {
        item.classList.remove('drag-over');
        item.style.transform = '';
        item.style.backgroundColor = '';
    });
    
    // === FEEDBACK VISUAL NO ALVO ===
    if (targetItem && targetItem !== touchSourceElement) {
        targetItem.classList.add('drag-over');
        targetItem.style.backgroundColor = '#c9a13b';
        targetItem.style.color = 'white';
        targetItem.style.transform = 'scale(1.02)';
        targetItem.style.transition = 'all 0.1s ease';
    }
}

function handleTouchEnd(e) {
    if (!touchActive) {
        document.querySelectorAll('.english-item').forEach(item => {
            item.classList.remove('drag-over', 'dragging-source');
            item.style.opacity = '';
            item.style.transform = '';
            item.style.backgroundColor = '';
            item.style.color = '';
        });
        return;
    }
    
    if (e.cancelable) {
        e.preventDefault();
    }
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    // Restaura o elemento fonte
    if (touchSourceElement) {
        touchSourceElement.style.opacity = '1';
        touchSourceElement.style.transform = '';
        touchSourceElement.classList.remove('dragging-source');
    }
    
    // Remove o clone
    if (touchClone) {
        touchClone.remove();
        touchClone = null;
    }
    
    // Se o elemento fonte está locked, cancela
    if (touchSourceElement && touchSourceElement.classList.contains('locked')) {
        touchActive = false;
        touchSourceElement = null;
        touchSourceIndex = null;
        document.body.classList.remove('dragging');
        return;
    }
    
    // Encontra o alvo abaixo do dedo (prioriza português)
    const elemUnderTouch = document.elementsFromPoint(touchEndX, touchEndY);
    let targetPortuguese = null;
    
    for (let elem of elemUnderTouch) {
        if (elem.classList && elem.classList.contains('portuguese-item') && !elem.classList.contains('locked')) {
            targetPortuguese = elem;
            break;
        }
    }
    
    // Se não caiu em português, cancela
    if (!targetPortuguese || !touchSourceElement) {
        // Limpa estilos
        document.querySelectorAll('.english-item').forEach(item => {
            item.classList.remove('drag-over', 'dragging-source');
            item.style.opacity = '';
            item.style.transform = '';
            item.style.backgroundColor = '';
            item.style.color = '';
        });
        touchActive = false;
        touchSourceElement = null;
        touchSourceIndex = null;
        document.body.classList.remove('dragging');
        return;
    }
    
    const englishId = parseInt(touchSourceElement.getAttribute('data-id'));
    const portugueseId = parseInt(targetPortuguese.getAttribute('data-id'));
    
    if (englishId === portugueseId) {
        lockAndMoveToTop(englishId, portugueseId);

        // Em Simple Past, pronuncia o passado assim que o usuário solta o
        // presente sobre a resposta correta.
        playMatchedPastPronunciation(portugueseId);

        showVocabMessage('✓ Correct match!', 'success');
        renderVocabularyLists();

        if (matchesCount === currentEnglishWords.length) {
            playSound('win');
            showVocabMessage('🎉 PERFECT! You matched all verbs! 🎉', 'win');
        } else {
            playSound('correct');
        }
    } else {
        playSound('wrong');
        showVocabMessage('✗ Wrong match! Try again!', 'error');
    }
    
    // Limpa todos os estilos visuais
    document.querySelectorAll('.english-item').forEach(item => {
        item.classList.remove('drag-over', 'dragging-source');
        item.style.opacity = '';
        item.style.transform = '';
        item.style.backgroundColor = '';
        item.style.color = '';
    });
    
    touchActive = false;
    touchSourceElement = null;
    touchSourceIndex = null;
    document.body.classList.remove('dragging');
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
        'verbs1': { data: vocabularyDataVerbs1, type: 'present' },
        'verbs2': { data: vocabularyDataVerbs2, type: 'present' },
        'verbs3': { data: vocabularyDataVerbs3, type: 'present' },
        'verbs4': { data: vocabularyDataVerbs4, type: 'present' },
        'verbs5': { data: vocabularyDataVerbs5, type: 'present' },
        'verbs6': { data: vocabularyDataVerbs6, type: 'present' },
        'verbs7': { data: vocabularyDataVerbs7, type: 'present' },
        'verbs8': { data: vocabularyDataVerbs8, type: 'present' },
        'verbs9': { data: vocabularyDataVerbs9, type: 'present' },
        'verbs10': { data: vocabularyDataVerbs10, type: 'present' },
        
        // Simple Past
        'past1': { data: vocabularyDataPast1, type: 'past' },
        'past2': { data: vocabularyDataPast2, type: 'past' },
        'past3': { data: vocabularyDataPast3, type: 'past' },
        'past4': { data: vocabularyDataPast4, type: 'past' },
        'past5': { data: vocabularyDataPast5, type: 'past' },
        'past6': { data: vocabularyDataPast6, type: 'past' },
        'past7': { data: vocabularyDataPast7, type: 'past' },
        'past8': { data: vocabularyDataPast8, type: 'past' },
        'past9': { data: vocabularyDataPast9, type: 'past' },
        'past10': { data: vocabularyDataPast10, type: 'past' }
    };
    
    const selected = gameDataMap[gameType];
    
    if (selected) {
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
        
        // Iniciar o jogo com tipo explícito
        startVocabularyGame(selected.data, selected.type);
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
// VERBS — SIMPLE VERBS (ENGLISH -> PORTUGUESE)
// ============================================

const vocabularyDataVerbs1 = [
    { id: 0, english: "to work", portuguese: "trabalhar" },
    { id: 1, english: "to ask", portuguese: "perguntar" },
    { id: 2, english: "to play", portuguese: "jogar" },
    { id: 3, english: "to open", portuguese: "abrir" },
    { id: 4, english: "to help", portuguese: "ajudar" },
    { id: 5, english: "to look", portuguese: "olhar" },
    { id: 6, english: "to want", portuguese: "querer" },
    { id: 7, english: "to seem", portuguese: "parecer" },
    { id: 8, english: "to call", portuguese: "chamar / ligar" },
    { id: 9, english: "to talk", portuguese: "conversar / falar" }
];

const vocabularyDataVerbs2 = [
    { id: 0, english: "to turn", portuguese: "virar" },
    { id: 1, english: "to start", portuguese: "começar" },
    { id: 2, english: "to show", portuguese: "mostrar" },
    { id: 3, english: "to happen", portuguese: "acontecer" },
    { id: 4, english: "to learn", portuguese: "aprender" },
    { id: 5, english: "to watch", portuguese: "assistir / observar" },
    { id: 6, english: "to follow", portuguese: "seguir" },
    { id: 7, english: "to allow", portuguese: "permitir" },
    { id: 8, english: "to add", portuguese: "adicionar" },
    { id: 9, english: "to walk", portuguese: "caminhar" }
];

const vocabularyDataVerbs3 = [
    { id: 0, english: "to offer", portuguese: "oferecer" },
    { id: 1, english: "to remember", portuguese: "lembrar" },
    { id: 2, english: "to consider", portuguese: "considerar" },
    { id: 3, english: "to appear", portuguese: "aparecer" },
    { id: 4, english: "to wait", portuguese: "esperar / aguardar" },
    { id: 5, english: "to serve", portuguese: "servir" },
    { id: 6, english: "to expect", portuguese: "esperar" },
    { id: 7, english: "to stay", portuguese: "ficar / permanecer" },
    { id: 8, english: "to reach", portuguese: "alcançar" },
    { id: 9, english: "to kill", portuguese: "matar" }
];

const vocabularyDataVerbs4 = [
    { id: 0, english: "to use", portuguese: "usar" },
    { id: 1, english: "to move", portuguese: "mover" },
    { id: 2, english: "to live", portuguese: "viver / morar" },
    { id: 3, english: "to believe", portuguese: "acreditar" },
    { id: 4, english: "to provide", portuguese: "fornecer" },
    { id: 5, english: "to include", portuguese: "incluir" },
    { id: 6, english: "to continue", portuguese: "continuar" },
    { id: 7, english: "to change", portuguese: "mudar" },
    { id: 8, english: "to create", portuguese: "criar" },
    { id: 9, english: "to love", portuguese: "amar" }
];

const vocabularyDataVerbs5 = [
    { id: 0, english: "to try", portuguese: "tentar" },
    { id: 1, english: "to carry", portuguese: "carregar / levar" },
    { id: 2, english: "to study", portuguese: "estudar" },
    { id: 3, english: "to worry", portuguese: "preocupar-se" },
    { id: 4, english: "to cry", portuguese: "chorar" },
    { id: 5, english: "to copy", portuguese: "copiar" },
    { id: 6, english: "to marry", portuguese: "casar" },
    { id: 7, english: "to hurry", portuguese: "apressar-se" },
    { id: 8, english: "to dry", portuguese: "secar" },
    { id: 9, english: "to reply", portuguese: "responder" }
];

const vocabularyDataVerbs6 = [
    { id: 0, english: "to stop", portuguese: "parar" },
    { id: 1, english: "to plan", portuguese: "planejar" },
    { id: 2, english: "to drop", portuguese: "derrubar / deixar cair" },
    { id: 3, english: "to chat", portuguese: "conversar" },
    { id: 4, english: "to rob", portuguese: "roubar" },
    { id: 5, english: "to clap", portuguese: "aplaudir" },
    { id: 6, english: "to hug", portuguese: "abraçar" },
    { id: 7, english: "to grab", portuguese: "agarrar" },
    { id: 8, english: "to nod", portuguese: "acenar" },
    { id: 9, english: "to skip", portuguese: "pular" }
];

const vocabularyDataVerbs7 = [
    { id: 0, english: "to go", portuguese: "ir" },
    { id: 1, english: "to read", portuguese: "ler" },
    { id: 2, english: "to tell", portuguese: "contar / dizer" },
    { id: 3, english: "to run", portuguese: "correr" },
    { id: 4, english: "to be", portuguese: "ser / estar" },
    { id: 5, english: "to have", portuguese: "ter" },
    { id: 6, english: "to do", portuguese: "fazer" },
    { id: 7, english: "to say", portuguese: "dizer" },
    { id: 8, english: "to get", portuguese: "conseguir / obter" },
    { id: 9, english: "to make", portuguese: "fazer / criar" }
];

const vocabularyDataVerbs8 = [
    { id: 0, english: "to know", portuguese: "saber / conhecer" },
    { id: 1, english: "to take", portuguese: "pegar / levar" },
    { id: 2, english: "to see", portuguese: "ver" },
    { id: 3, english: "to come", portuguese: "vir" },
    { id: 4, english: "to think", portuguese: "pensar" },
    { id: 5, english: "to give", portuguese: "dar" },
    { id: 6, english: "to find", portuguese: "encontrar" },
    { id: 7, english: "to feel", portuguese: "sentir" },
    { id: 8, english: "to leave", portuguese: "deixar / sair" },
    { id: 9, english: "to put", portuguese: "colocar" }
];

const vocabularyDataVerbs9 = [
    { id: 0, english: "to keep", portuguese: "manter" },
    { id: 1, english: "to let", portuguese: "deixar / permitir" },
    { id: 2, english: "to begin", portuguese: "começar" },
    { id: 3, english: "to hear", portuguese: "ouvir" },
    { id: 4, english: "to bring", portuguese: "trazer" },
    { id: 5, english: "to write", portuguese: "escrever" },
    { id: 6, english: "to sit", portuguese: "sentar" },
    { id: 7, english: "to stand", portuguese: "ficar em pé" },
    { id: 8, english: "to lose", portuguese: "perder" },
    { id: 9, english: "to pay", portuguese: "pagar" }
];

const vocabularyDataVerbs10 = [
    { id: 0, english: "to meet", portuguese: "encontrar / conhecer" },
    { id: 1, english: "to set", portuguese: "definir / colocar" },
    { id: 2, english: "to lead", portuguese: "liderar" },
    { id: 3, english: "to understand", portuguese: "entender" },
    { id: 4, english: "to speak", portuguese: "falar" },
    { id: 5, english: "to spend", portuguese: "gastar" },
    { id: 6, english: "to grow", portuguese: "crescer" },
    { id: 7, english: "to win", portuguese: "ganhar / vencer" },
    { id: 8, english: "to buy", portuguese: "comprar" },
    { id: 9, english: "to send", portuguese: "enviar" }
];

// ============================================
// VERBS — SIMPLE PAST (ENGLISH -> PAST)
// ============================================

const vocabularyDataPast1 = [
    { id: 0, english: "to work", portuguese: "worked" },
    { id: 1, english: "to ask", portuguese: "asked" },
    { id: 2, english: "to play", portuguese: "played" },
    { id: 3, english: "to open", portuguese: "opened" },
    { id: 4, english: "to help", portuguese: "helped" },
    { id: 5, english: "to look", portuguese: "looked" },
    { id: 6, english: "to want", portuguese: "wanted" },
    { id: 7, english: "to seem", portuguese: "seemed" },
    { id: 8, english: "to call", portuguese: "called" },
    { id: 9, english: "to talk", portuguese: "talked" }
];

const vocabularyDataPast2 = [
    { id: 0, english: "to turn", portuguese: "turned" },
    { id: 1, english: "to start", portuguese: "started" },
    { id: 2, english: "to show", portuguese: "showed" },
    { id: 3, english: "to happen", portuguese: "happened" },
    { id: 4, english: "to learn", portuguese: "learned" },
    { id: 5, english: "to watch", portuguese: "watched" },
    { id: 6, english: "to follow", portuguese: "followed" },
    { id: 7, english: "to allow", portuguese: "allowed" },
    { id: 8, english: "to add", portuguese: "added" },
    { id: 9, english: "to walk", portuguese: "walked" }
];

const vocabularyDataPast3 = [
    { id: 0, english: "to offer", portuguese: "offered" },
    { id: 1, english: "to remember", portuguese: "remembered" },
    { id: 2, english: "to consider", portuguese: "considered" },
    { id: 3, english: "to appear", portuguese: "appeared" },
    { id: 4, english: "to wait", portuguese: "waited" },
    { id: 5, english: "to serve", portuguese: "served" },
    { id: 6, english: "to expect", portuguese: "expected" },
    { id: 7, english: "to stay", portuguese: "stayed" },
    { id: 8, english: "to reach", portuguese: "reached" },
    { id: 9, english: "to kill", portuguese: "killed" }
];

const vocabularyDataPast4 = [
    { id: 0, english: "to use", portuguese: "used" },
    { id: 1, english: "to move", portuguese: "moved" },
    { id: 2, english: "to live", portuguese: "lived" },
    { id: 3, english: "to believe", portuguese: "believed" },
    { id: 4, english: "to provide", portuguese: "provided" },
    { id: 5, english: "to include", portuguese: "included" },
    { id: 6, english: "to continue", portuguese: "continued" },
    { id: 7, english: "to change", portuguese: "changed" },
    { id: 8, english: "to create", portuguese: "created" },
    { id: 9, english: "to love", portuguese: "loved" }
];

const vocabularyDataPast5 = [
    { id: 0, english: "to try", portuguese: "tried" },
    { id: 1, english: "to carry", portuguese: "carried" },
    { id: 2, english: "to study", portuguese: "studied" },
    { id: 3, english: "to worry", portuguese: "worried" },
    { id: 4, english: "to cry", portuguese: "cried" },
    { id: 5, english: "to copy", portuguese: "copied" },
    { id: 6, english: "to marry", portuguese: "married" },
    { id: 7, english: "to hurry", portuguese: "hurried" },
    { id: 8, english: "to dry", portuguese: "dried" },
    { id: 9, english: "to reply", portuguese: "replied" }
];

const vocabularyDataPast6 = [
    { id: 0, english: "to stop", portuguese: "stopped" },
    { id: 1, english: "to plan", portuguese: "planned" },
    { id: 2, english: "to drop", portuguese: "dropped" },
    { id: 3, english: "to chat", portuguese: "chatted" },
    { id: 4, english: "to rob", portuguese: "robbed" },
    { id: 5, english: "to clap", portuguese: "clapped" },
    { id: 6, english: "to hug", portuguese: "hugged" },
    { id: 7, english: "to grab", portuguese: "grabbed" },
    { id: 8, english: "to nod", portuguese: "nodded" },
    { id: 9, english: "to skip", portuguese: "skipped" }
];

const vocabularyDataPast7 = [
    { id: 0, english: "to go", portuguese: "went" },
    { id: 1, english: "to read", portuguese: "read" },
    { id: 2, english: "to tell", portuguese: "told" },
    { id: 3, english: "to run", portuguese: "ran" },
    { id: 4, english: "to be", portuguese: "was / were" },
    { id: 5, english: "to have", portuguese: "had" },
    { id: 6, english: "to do", portuguese: "did" },
    { id: 7, english: "to say", portuguese: "said" },
    { id: 8, english: "to get", portuguese: "got" },
    { id: 9, english: "to make", portuguese: "made" }
];

const vocabularyDataPast8 = [
    { id: 0, english: "to know", portuguese: "knew" },
    { id: 1, english: "to take", portuguese: "took" },
    { id: 2, english: "to see", portuguese: "saw" },
    { id: 3, english: "to come", portuguese: "came" },
    { id: 4, english: "to think", portuguese: "thought" },
    { id: 5, english: "to give", portuguese: "gave" },
    { id: 6, english: "to find", portuguese: "found" },
    { id: 7, english: "to feel", portuguese: "felt" },
    { id: 8, english: "to leave", portuguese: "left" },
    { id: 9, english: "to put", portuguese: "put" }
];

const vocabularyDataPast9 = [
    { id: 0, english: "to keep", portuguese: "kept" },
    { id: 1, english: "to let", portuguese: "let" },
    { id: 2, english: "to begin", portuguese: "began" },
    { id: 3, english: "to hear", portuguese: "heard" },
    { id: 4, english: "to bring", portuguese: "brought" },
    { id: 5, english: "to write", portuguese: "wrote" },
    { id: 6, english: "to sit", portuguese: "sat" },
    { id: 7, english: "to stand", portuguese: "stood" },
    { id: 8, english: "to lose", portuguese: "lost" },
    { id: 9, english: "to pay", portuguese: "paid" }
];

const vocabularyDataPast10 = [
    { id: 0, english: "to meet", portuguese: "met" },
    { id: 1, english: "to set", portuguese: "set" },
    { id: 2, english: "to lead", portuguese: "led" },
    { id: 3, english: "to understand", portuguese: "understood" },
    { id: 4, english: "to speak", portuguese: "spoke" },
    { id: 5, english: "to spend", portuguese: "spent" },
    { id: 6, english: "to grow", portuguese: "grew" },
    { id: 7, english: "to win", portuguese: "won" },
    { id: 8, english: "to buy", portuguese: "bought" },
    { id: 9, english: "to send", portuguese: "sent" }
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
    initWordsSettings();
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
    categoryTopicsBtn: document.getElementById('category-topics'),
    backToCategoryBtn: document.getElementById('back-to-category-btn'),
    categoryUserInfo: document.getElementById('category-user-info'),
    categoryUserName: document.getElementById('category-user-name'),
    categoryLogoutBtn: document.getElementById('category-logout-btn')
};

[DOMcat.categoryNumbersBtn, DOMcat.categoryWordsBtn, DOMcat.categoryTopicsBtn].forEach((card) => {
    card?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            card.click();
        }
    });
});

function showCategoryScreen() {
    ScreenManager.setScreen('categories');
    currentScreen = 'categories'; 
    if (DOMcat.categoryContainer) {
        DOMcat.categoryContainer.style.display = 'block';
        DOMcat.categoryContainer.classList.add('category-home-active');
    }
    if (DOM.menu) DOM.menu.style.display = 'none';
    if (DOMcat.numbersMenuContainer) DOMcat.numbersMenuContainer.style.display = 'none';
    if (DOM.game) DOM.game.style.display = 'none';
    document.getElementById('topics-menu-container')?.style.setProperty('display', 'none');
    document.getElementById('topic-level-container')?.style.setProperty('display', 'none');
    document.getElementById('topic-game-menu-container')?.style.setProperty('display', 'none');
    
    // Exibir os modos; o layout responsivo fica sob responsabilidade do CSS.
    const catBtns = document.querySelector('.category-buttons');
    if (catBtns) {
        catBtns.style.display = 'grid';
        catBtns.style.removeProperty('flex-direction');
        catBtns.style.removeProperty('gap');
        catBtns.style.removeProperty('margin');
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

if (DOMcat.categoryTopicsBtn) {
    DOMcat.categoryTopicsBtn.addEventListener('click', () => {
        navigateTo(SCREENS.TOPICS_MENU);
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

