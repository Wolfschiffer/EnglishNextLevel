// Words game: pronunciation controls, matching, scoring, and menu behavior.

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
// JOGO DE VOCABULÁRIO
// ============================================

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
let currentVocabularySourceData = null;
let currentVocabularySetId = null;

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
const vocabStartDescription = document.getElementById('vocab-start-description');
const vocabInstructionText = document.getElementById('vocab-instruction-text');
const vocabGameContainer = document.getElementById('vocab-game-container');
const vocabResultOverlay = document.getElementById('vocab-result-overlay');
const vocabResultSubtitle = document.getElementById('vocab-result-subtitle');
const vocabResultMatches = document.getElementById('vocab-result-matches');
const vocabResultScore = document.getElementById('vocab-result-score');
const vocabResultTime = document.getElementById('vocab-result-time');
const vocabResultReplay = document.getElementById('vocab-result-replay');
const vocabResultBack = document.getElementById('vocab-result-back');
const vocabularyMatchingModule = window.EnglishNextLevelVocabularyMatching;
if (!vocabularyMatchingModule?.create) {
    throw new Error('vocabulary-matching.js must load before vocabulary-game.js');
}
const vocabularyMatching = vocabularyMatchingModule.create({
    window,
    document,
    englishList,
    portugueseList,
    getEnglishWords: () => currentEnglishWords,
    getPortugueseWords: () => currentPortugueseWords,
    getMatchCount: () => matchesCount,
    setMatchCount: (value) => {
        matchesCount = value;
        if (vocabMatchesSpan) vocabMatchesSpan.textContent = String(matchesCount);
    },
    getGameFinished: () => vocabGameFinished,
    showMessage: showVocabMessage,
    playWrongSound: () => playSound('wrong'),
    awardPoints: awardVocabularyMatchPoints,
    finishGame: finishVocabularyGameStats,
    playMatchedPastPronunciation,
    renderLists: renderVocabularyLists,
    handleCorrectFeedback: handleVocabularyCorrectMatchFeedback
});
const vocabularyTouchInput = window.EnglishNextLevelVocabularyTouchInput.create({
    document,
    onCompleteMatch: vocabularyMatching.completeMatch
});
const vocabularyRendererModule = window.EnglishNextLevelVocabularyRenderer;
if (!vocabularyRendererModule?.create) {
    throw new Error('vocabulary-renderer.js must load before vocabulary-game.js');
}
const vocabularyRenderer = vocabularyRendererModule.create({
    document,
    englishList,
    portugueseList,
    getEnglishWords: () => currentEnglishWords,
    getPortugueseWords: () => currentPortugueseWords,
    getGameType: () => currentVerbGameType,
    createAudioButton,
    addCardPronunciation: addVocabularyCardPronunciation,
    setupKeyboardCard: vocabularyMatching.setupKeyboardCard,
    handleDragStart: vocabularyMatching.handleDragStart,
    handleDragEnd: vocabularyMatching.handleDragEnd,
    handleDragOver: vocabularyMatching.handleDragOver,
    handleDrop: vocabularyMatching.handleDrop,
    touchInput: vocabularyTouchInput
});
const vocabularyResultDialog = window.EnglishNextLevelVocabularyResultDialog.create({
    body: document.body,
    overlay: vocabResultOverlay,
    subtitle: vocabResultSubtitle,
    matches: vocabResultMatches,
    score: vocabResultScore,
    time: vocabResultTime,
    replayButton: vocabResultReplay,
    backButton: vocabResultBack,
    getIsWordsGameScreen: () => currentScreen === SCREENS.WORDS_GAME,
    getIsStartOverlayActive: () => Boolean(vocabStartOverlay?.classList.contains('active')),
    getMatchesCount: () => matchesCount,
    getWordCount: () => currentEnglishWords.length,
    getScore: () => vocabScore,
    getElapsedSeconds: () => vocabElapsedSeconds,
    getGameType: () => currentVerbGameType,
    getBackFocusTarget: () => Array.from(document.querySelectorAll('.game-card[data-words-mode]'))
        .find((card) => card.dataset.wordsMode === currentVocabularySetId),
    formatTime: formatVocabularyTime,
    scheduleFrame: (callback) => requestAnimationFrame(callback),
    setTimeoutFn: (callback, delay) => setTimeout(callback, delay),
    clearTimeoutFn: (timeoutId) => clearTimeout(timeoutId),
    onReplay: () => startVocabularyGame(currentVocabularySourceData, currentVerbGameType),
    onBack: () => goBack(1)
});

// Compatibilidade com o fluxo global de navegação em game.js.
function hideVocabularyResultModal() {
    return vocabularyResultDialog.hide();
}

function clearVocabularyResultTimeout() {
    return vocabularyResultDialog.cancel();
}

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
    if (vocabScoreSpan) vocabScoreSpan.textContent = Number(vocabScore || 0).toLocaleString('en-US');
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

    return EnglishNextLevelVocabularyScoring.calculateMatchPoints(secondsSinceLastMatch, isMobile);
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

    window.EnglishNextLevelProgress?.recordWordsResult?.({
        mode: currentVerbGameType,
        score: vocabScore,
        timeSeconds: vocabElapsedSeconds
    });

    window.EnglishNextLevelSpacedReview?.trackCompletedSet?.({
        mode: currentVerbGameType,
        setId: currentVocabularySetId,
        items: currentVocabularySourceData || []
    });
}

function handleVocabularyCorrectMatchFeedback() {
    if (matchesCount === currentEnglishWords.length) {
        playSound('win');
        showVocabMessage('Set complete', 'win');
        vocabularyResultDialog.queue();
        return;
    }

    playSound('correct');
    showVocabMessage('Correct match', 'success');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startVocabularyGame(vocabularyDataParam = null, gameType = 'present') {
    window.enlDebug?.("🎮 Iniciando jogo de vocabulário");
    vocabularyTouchInput.reset();
    vocabularyMatching.reset();

    // Usar dados específicos do jogo ou o padrão
    const activeData = vocabularyDataParam || vocabularyDataVerbs1;
    currentVocabularySourceData = activeData;
    vocabularyResultDialog.cancel();
    vocabularyResultDialog.hide();

    window.enlDebug?.(`📊 Tipo de jogo: ${gameType}`);
    window.enlDebug?.(`📊 Usando ${activeData.length} verbos para este jogo`);

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
        if (vocabInstructionText) vocabInstructionText.textContent = 'Drag each present verb to its simple past form, or select a word and its match with Enter or Space.';
        if (vocabStartDescription) vocabStartDescription.textContent = 'Match each present verb with its simple past form. Drag cards or use Enter/Space. The timer starts when you press START.';
        if (vocabGameContainer) vocabGameContainer.dataset.vocabMode = 'past';
    } else {
        if (vocabLeftHeading) vocabLeftHeading.textContent = 'ENGLISH';
        if (vocabRightHeading) vocabRightHeading.textContent = 'PORTUGUÊS';
        if (vocabInstructionText) vocabInstructionText.textContent = 'Drag each English verb to its Portuguese meaning, or select a word and its match with Enter or Space.';
        if (vocabStartDescription) vocabStartDescription.textContent = 'Match each English verb with its Portuguese meaning. Drag cards or use Enter/Space. The timer starts when you press START.';
        if (vocabGameContainer) vocabGameContainer.dataset.vocabMode = 'present';
    }

    renderVocabularyLists();
    if (vocabMessage) vocabMessage.innerHTML = '';

    // Prepara a voz disponível enquanto o modal está aberto, mas só inicia
    // tempo, pontuação e ativação efetiva do TTS depois do clique em START.
    preloadCurrentGameAudios();
    showVocabularyStartModal();
}


// ============================================
// MOSTRA MENSAGEM NO JOGO DE VOCABULÁRIO
// ============================================

function showVocabMessage(message, type) {
    if (!vocabMessage) return;
    vocabMessage.textContent = message;
    vocabMessage.className = `vocab-message ${type}`;
    setTimeout(() => {
        if (vocabMessage.textContent === message) {
            vocabMessage.textContent = '';
            vocabMessage.className = 'vocab-message';
        }
    }, type === 'win' ? 900 : 1400);
}

// ============================================
// RENDERIZA AS LISTAS (SUA VERSÃO)
// ============================================

function renderVocabularyLists() {
    vocabularyRenderer.render();
}


// MENU DE WORDS
// ============================================

window.selectWordGame = function(gameType) {
    window.enlDebug?.(`📚 Word game selected: ${gameType}`);

    const selected = vocabularyGameModes[gameType];

    if (selected) {
        currentVocabularySetId = gameType;
        const vocabNavSubtitle = document.getElementById('vocab-nav-subtitle');
        if (vocabNavSubtitle) {
            const match = String(gameType).match(/(\d+)$/);
            const setNumber = match ? match[1] : '';
            vocabNavSubtitle.textContent = selected.type === 'past'
                ? `Simple Past${setNumber ? ` ${setNumber}` : ''}`
                : `Simple Verbs${setNumber ? ` ${setNumber}` : ''}`;
        }
        // O roteador controla as telas e atualiza o histórico interno do navegador.
        navigateTo(SCREENS.WORDS_GAME);

        // Iniciar o jogo com tipo explícito
        startVocabularyGame(selected.data, selected.type);
    } else {
        alert(`Game "${gameType}" not found!`);
    }
};

document.querySelectorAll(
    '#simple-verbs-submenu .game-card[data-words-mode], #simple-verbs-past-submenu .game-card[data-words-mode]'
).forEach((card) => {
    card.addEventListener('click', () => window.selectWordGame(card.dataset.wordsMode));
});


// ============================================
// SUBMENU DOS SIMPLE VERBS
// ============================================

function bindWordsMenuButton(button, onActivate, debugMessage) {
    if (!button) return;

    button.addEventListener('click', (event) => {
        event.stopPropagation();
        window.enlDebug?.(debugMessage);
        onActivate();
    });
}

bindWordsMenuButton(
    document.getElementById('simple-verbs-btn'),
    () => navigateTo(SCREENS.WORDS_SUBMENU),
    '📚 SIMPLE VERBS clicado'
);

bindWordsMenuButton(
    document.getElementById('simple-verbs-past-btn'),
    () => navigateTo(SCREENS.WORDS_SUBMENU_PAST),
    '📚 SIMPLE VERBS PAST clicado'
);
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
        window.enlDebug?.("◀ Botão VOLTAR do WORDS clicado");

        // O roteador limpa os containers e atualiza o histórico.
        goBack();
    });
}
