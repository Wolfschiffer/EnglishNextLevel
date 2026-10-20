// ============================================
// 1. CONFIGURAÇÕES GLOBAIS
// ============================================

const SCREEN_BODY_STATES = Object.freeze({
    wordsMenu: 'words'
});

const ScreenManager = {
  setScreen(screenName) {
    const bodyScreen = SCREEN_BODY_STATES[screenName] || screenName;
    document.body.setAttribute('data-screen', bodyScreen);
    window.enlDebug?.(`🖥️ Tela alterada para: ${screenName}`);
  }
};

// ============================================
// SISTEMA DE NAVEGAÇÃO + BOTÃO VOLTAR DO NAVEGADOR/CELULAR
// ============================================

let navigationStack = []; // Telas anteriores dentro do jogo
let currentScreen = null;
let pendingRootNavigation = null;

const APP_HISTORY_MARKER = 'english-next-level-navigation';

const SCREENS = {
    LOGIN: 'login',
    CATEGORIES: 'categories',
    PROFILE: 'profile',
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

// Mantém o título do app bar contextual sincronizado com a tela atual.
// A Home continua sendo a raiz e, por isso, não recebe botão Voltar.
function updatePhase2NavigationCopy(screen) {
    const wordsTitle = document.getElementById('words-nav-title');
    const wordsSubtitle = document.getElementById('words-nav-subtitle');

    if (wordsTitle && wordsSubtitle) {
        if (screen === SCREENS.WORDS_SUBMENU) {
            wordsTitle.textContent = 'SIMPLE VERBS';
            wordsSubtitle.textContent = 'Choose a set';
        } else if (screen === SCREENS.WORDS_SUBMENU_PAST) {
            wordsTitle.textContent = 'SIMPLE PAST';
            wordsSubtitle.textContent = 'Choose a set';
        } else if (screen === SCREENS.WORDS_MENU) {
            wordsTitle.textContent = 'WORDS';
            wordsSubtitle.textContent = 'Choose a word game';
        }
    }
}

// Função para mostrar a tela
function showScreen(screen, options = {}) {
    if ([SCREENS.NUMBERS_MENU, SCREENS.NUMBERS_GAME].includes(currentScreen) && screen !== currentScreen) {
        window.closeLeaderboardModal?.({ restoreFocus: false });
    }

    if (currentScreen === SCREENS.NUMBERS_GAME && screen !== SCREENS.NUMBERS_GAME) {
        window.EnglishNextLevelNumbersResultLifecycle?.leaveScreen?.();
    }

    if (screen !== SCREENS.WORDS_MENU) {
        window.EnglishNextLevelSpacedReviewManager?.closePanel?.({ restoreFocus: false });
    }

    if (![SCREENS.WORDS_MENU, SCREENS.WORDS_SUBMENU, SCREENS.WORDS_SUBMENU_PAST, SCREENS.WORDS_GAME].includes(screen)) {
        closeWordsSettings({ restoreFocus: false });
    }

    // Se o jogador sair do Vocabulary Match antes de terminar, encerra o cronômetro.
    if (currentScreen === SCREENS.WORDS_GAME && screen !== SCREENS.WORDS_GAME) {
        stopVocabularyTimer();
        hideVocabularyStartModal();
        hideVocabularyResultModal();
        clearVocabularyResultTimeout();
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

    window.enlDebug?.(`📱 Mostrando tela: ${screen}`);
    
    const auth = document.getElementById('auth-container');
    const category = document.getElementById('category-container');
    const profile = document.getElementById('profile-container');
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
    const spacedReviewOpenBtn = document.getElementById('spaced-review-open-btn');
    
    // Esconde todas
    if (auth) auth.style.display = 'none';
    if (category) category.style.display = 'none';
    if (profile) profile.style.display = 'none';
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

        case SCREENS.PROFILE:
            if (profile) profile.style.display = 'block';
            window.EnglishNextLevelProgress?.refreshProfile?.();
            break;
            
        case SCREENS.NUMBERS_MENU:
            if (numbersMenu) numbersMenu.style.display = 'block';
            syncNumbersMenuBestScores();
            break;
            
        case SCREENS.NUMBERS_GAME:
            if (game) game.style.display = 'block';
            if (options.gameType) window.selectGame(options.gameType);
            break;
            
        case SCREENS.WORDS_MENU:
            if (wordsMenu) wordsMenu.style.display = 'block';
            if (simpleVerbsBtn) simpleVerbsBtn.style.display = 'block';
            if (simpleVerbsPastBtn) simpleVerbsPastBtn.style.display = 'block';
            if (spacedReviewOpenBtn) spacedReviewOpenBtn.style.display = 'block';
            if (simpleVerbsSubmenu) simpleVerbsSubmenu.style.display = 'none';
            if (simpleVerbsPastSubmenu) simpleVerbsPastSubmenu.style.display = 'none';
            window.EnglishNextLevelSpacedReviewManager?.refresh?.();
            break;

        case SCREENS.WORDS_SUBMENU:
            if (wordsMenu) wordsMenu.style.display = 'block';
            if (simpleVerbsBtn) simpleVerbsBtn.style.display = 'none';
            if (simpleVerbsPastBtn) simpleVerbsPastBtn.style.display = 'block';
            if (spacedReviewOpenBtn) spacedReviewOpenBtn.style.display = 'none';
            if (simpleVerbsSubmenu) simpleVerbsSubmenu.style.display = 'block';
            if (simpleVerbsPastSubmenu) simpleVerbsPastSubmenu.style.display = 'none';
            break;

        case SCREENS.WORDS_SUBMENU_PAST:
            if (wordsMenu) wordsMenu.style.display = 'block';
            if (simpleVerbsBtn) simpleVerbsBtn.style.display = 'block';
            if (simpleVerbsPastBtn) simpleVerbsPastBtn.style.display = 'none';
            if (spacedReviewOpenBtn) spacedReviewOpenBtn.style.display = 'none';
            if (simpleVerbsSubmenu) simpleVerbsSubmenu.style.display = 'none';
            if (simpleVerbsPastSubmenu) simpleVerbsPastSubmenu.style.display = 'block';
            break;
            
        case SCREENS.WORDS_GAME:
            if (vocab) {
                vocab.style.display = 'block';
                vocab.style.visibility = 'visible';
                vocab.style.opacity = '1';
                window.enlDebug?.("✅ vocab-container exibido pelo showScreen");
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
    
    updatePhase2NavigationCopy(screen);
    currentScreen = screen;
}

// Navegar para uma tela: atualiza a pilha interna e o histórico real do navegador.
// Isso faz o botão/gesto VOLTAR do Android/iPhone percorrer as telas do jogo.
function navigateTo(screen, options = {}) {
    window.enlDebug?.(`📍 Navegando para: ${screen}`);

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
        window.enlDebug?.(`⚠️ Já está na tela ${screen}, ignorando`);
        return;
    }
    
    if (currentScreen && currentScreen !== screen) {
        navigationStack.push(currentScreen);
        window.enlDebug?.(`➕ Adicionado ao histórico: ${currentScreen}`);
    }
    
    showScreen(screen, options);
    pushBrowserState(currentScreen);
}

// Navegação de nível superior usada pela bottom navigation mobile.
// Primeiro colapsa o histórico interno até Home; depois abre o destino pedido.
// Assim Home continua sendo a raiz real e Progress volta para Home com o botão físico.
function navigateToRoot(screen) {
    const target = screen === SCREENS.PROFILE ? SCREENS.PROFILE : SCREENS.CATEGORIES;

    if (!window.currentUser && !window.isGuest) {
        showScreen(SCREENS.LOGIN);
        navigationStack = [];
        replaceCurrentBrowserState(SCREENS.LOGIN);
        return;
    }

    if (target === SCREENS.CATEGORIES && currentScreen === SCREENS.CATEGORIES) {
        return;
    }

    if (target === SCREENS.PROFILE && currentScreen === SCREENS.PROFILE) {
        window.EnglishNextLevelProgress?.refreshProfile?.();
        return;
    }

    // Se há telas internas empilhadas, volta de uma vez até Categories usando
    // o histórico real do navegador. O popstate finaliza a navegação pendente.
    if (navigationStack.length > 0 && isAppHistoryState(window.history.state)) {
        pendingRootNavigation = target;
        window.history.go(-navigationStack.length);
        return;
    }

    navigationStack = [];
    showScreen(SCREENS.CATEGORIES);
    replaceCurrentBrowserState(SCREENS.CATEGORIES);

    if (target === SCREENS.PROFILE) {
        navigateTo(SCREENS.PROFILE);
    }
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
// Retorna true somente quando solicita navegação interna via history.go(), concluída pelo fluxo popstate.
function goBack(steps = 1) {
    const requestedSteps = Math.max(1, Number.parseInt(steps, 10) || 1);
    window.enlDebug?.(`◀ goBack chamado (${requestedSteps})`);
    window.enlDebug?.("📚 Pilha atual:", navigationStack);

    if (navigationStack.length === 0) {
        // Na raiz do jogo, deixa o navegador voltar normalmente para a página anterior.
        if (currentScreen === SCREENS.CATEGORIES || currentScreen === SCREENS.LOGIN) {
            window.history.back();
            return false;
        }

        // Segurança para algum estado antigo/sem histórico.
        showScreen(SCREENS.CATEGORIES);
        navigationStack = [];
        replaceCurrentBrowserState(SCREENS.CATEGORIES);
        return false;
    }

    const actualSteps = Math.min(requestedSteps, navigationStack.length);

    if (isAppHistoryState(window.history.state)) {
        // Esconde os submenus imediatamente; o popstate troca para a tela de destino.
        cleanBeforeBack();
        window.history.go(-actualSteps);
        return true;
    }

    // Fallback para navegadores muito antigos ou histórico não inicializado.
    let previousScreen = currentScreen;
    for (let i = 0; i < actualSteps; i += 1) {
        previousScreen = navigationStack.pop() || SCREENS.CATEGORIES;
    }
    showScreen(previousScreen);
    replaceCurrentBrowserState(previousScreen);
    return false;
}

// Recebe tanto o botão físico/gesto de voltar quanto history.back()/history.go()
// disparados pelos botões do próprio jogo.
window.addEventListener('popstate', (event) => {
    if (!isAppHistoryState(event.state)) {
        return;
    }

    window.enlDebug?.('📱 Voltar do navegador/celular:', event.state.screen);
    navigationStack = Array.isArray(event.state.stack)
        ? [...event.state.stack]
        : [];

    if (pendingRootNavigation) {
        const target = pendingRootNavigation;
        pendingRootNavigation = null;

        // A navegação inferior sempre parte de Home como raiz real.
        navigationStack = [];
        showScreen(SCREENS.CATEGORIES);
        replaceCurrentBrowserState(SCREENS.CATEGORIES);

        if (target === SCREENS.PROFILE) {
            navigateTo(SCREENS.PROFILE);
        }
        return;
    }

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
        window.enlDebug?.('✅ Nome do Firestore aplicado:', window.currentUserName);
    }
    else if (window.isGuest === true) {
        gameUserNameSpan.textContent = 'Guest';
        gameUserInfo.style.display = 'flex';
        if (categoryUserName) categoryUserName.textContent = 'Guest';
        window.enlDebug?.('✅ Guest name aplicado');
    }
    else if (window.currentUser && window.currentUser.email) {
        const name = window.currentUser.email.split('@')[0];
        gameUserNameSpan.textContent = name;
        gameUserInfo.style.display = 'flex';
        if (categoryUserName) categoryUserName.textContent = name;
        window.enlDebug?.('⚠️ Fallback para email:', name);
    }
    else {
        gameUserInfo.style.display = 'none';
    }
}

