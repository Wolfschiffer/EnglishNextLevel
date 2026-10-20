const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const TOPIC_DATA_SCRIPTS = [...INDEX_HTML.matchAll(/<script src="(js\/topics\/data\/[^\"]+)"/g)]
    .map((match) => match[1]);
const CORE_SCRIPTS = [
    'js/keyboard-accessibility.js',
    'js/leaderboard-dialog.js',
    'js/numbers-leaderboard.js',
    'js/numbers-result-dialog.js',
    'js/words-data.js',
    'js/numbers-data.js',
    'js/numbers-run-session.js',
    'js/numbers-scoring.js',
    'js/numbers-high-score-storage.js',
    'js/numbers-high-score-profile.js',
    'js/audio-engines.js',
    'js/audio-settings.js',
    'js/vocabulary-scoring.js',
    'js/words-speech.js',
    'js/vocabulary-result-dialog.js',
    'js/vocabulary-start-dialog.js',
    'js/vocabulary-touch-input.js',
    'js/vocabulary-renderer.js',
    'js/vocabulary-matching.js',
    'js/vocabulary-game.js',
    'js/game.js',
    'js/category-navigation.js',
    'js/numbers-eagle.js',
    'js/numbers-image-loader.js',
    'js/numbers-round-feedback.js',
    'js/numbers-answer-options.js',
    'js/numbers-fallback-questions.js',
    'js/numbers-game.js',
    'js/progress-profile-data.js',
    'js/progress-profile-summary.js',
    'js/progress-profile-renderer.js',
    ...TOPIC_DATA_SCRIPTS,
    'js/topics/topics-data.js'
];

function createBrowserContext(storageValues = new Map(), { failWrites = false } = {}) {
    const loadHandlers = [];
    const timers = [];
    let activeScript = null;
    const localStorage = {
        getItem(key) { return storageValues.get(key) ?? null; },
        setItem(key, value) {
            if (failWrites) throw new Error('write denied');
            storageValues.set(String(key), String(value));
        }
    };
    const body = {
        children: [],
        classList: { add() {}, remove() {}, contains() { return false; } },
        style: {},
        setAttribute() {},
        appendChild(element) { this.children.push(element); }
    };
    const numbersResultBestBadge = { removed: false, remove() { this.removed = true; } };
    const document = {
        body,
        addEventListener() {},
        createElement() {
            let text = '';
            let html = '';
            return {
                className: '',
                querySelector() { return null; },
                addEventListener() {},
                set textContent(value) { text = String(value); },
                get innerHTML() {
                    return html || text
                        .replaceAll('&', '&amp;')
                        .replaceAll('<', '&lt;')
                        .replaceAll('>', '&gt;')
                        .replaceAll('"', '&quot;')
                        .replaceAll("'", '&#39;');
                },
                set innerHTML(value) { html = String(value); }
            };
        },
        getElementById() { return null; },
        querySelector(selector) {
            return selector === '.numbers-result-best' ? numbersResultBestBadge : null;
        },
        querySelectorAll() { return []; }
    };
    const window = {
        document,
        localStorage,
        currentUser: null,
        isGuest: false,
        location: { href: 'http://localhost/', hostname: 'localhost', protocol: 'http:' },
        history: {
            state: null,
            replaceState() {},
            pushState() {},
            back() {},
            go() {}
        },
        sessionStorage: { getItem() { return null; }, setItem() {} },
        addEventListener(type, handler) {
            if (type === 'load') loadHandlers.push({ handler, script: activeScript });
        },
        removeEventListener() {},
        enlDebug() {}
    };
    window.window = window;

    const context = vm.createContext({
        window,
        document,
        localStorage,
        navigator: { userAgent: 'test browser' },
        console: { log() {}, info() {}, warn() {}, error() {} },
        setTimeout(callback, delay) {
            const timer = { callback, delay, cancelled: false };
            timers.push(timer);
            return timer;
        },
        clearTimeout(timer) {
            if (timer) timer.cancelled = true;
        },
        requestAnimationFrame() { return 1; },
        cancelAnimationFrame() {},
        performance: { now() { return 0; } }
    });

    return {
        context,
        loadHandlers,
        timers,
        storageValues,
        numbersResultBestBadge,
        loadScript(relativePath) {
            activeScript = relativePath;
            const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
            vm.runInContext(source, context, { filename: relativePath });
        }
    };
}

function createNumbersClickHarness() {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    const classes = [new Set(), new Set(), new Set()];
    const clickButtons = [1, 3, 2].map((value, index) => ({
        dataset: { index: String(index), value: String(value) },
        disabled: false,
        classList: {
            add(name) { classes[index].add(name); },
            remove(name) { classes[index].delete(name); },
            contains(name) { return classes[index].has(name); }
        }
    }));
    const calls = { sounds: [], animations: [], jumps: [], scores: [], wrongPopups: 0 };
    harness.context.clickPlatformButtons = clickButtons;
    harness.context.numbersClickCalls = calls;
    vm.runInContext(`
        gameActive = true;
        answered = false;
        isWaiting = false;
        currentNumber = { value: 2, word: 'two' };
        score = 0;
        streak = 0;
        multiplier = 1;
        lives = 3;
        DOM.platforms = clickPlatformButtons;
        calculateRoundScore = () => ({ total: 75, timeBonus: 1 });
        updateScore = () => {};
        updateMultiplier = () => {};
        updateLives = () => {};
        playSound = (type) => numbersClickCalls.sounds.push(type);
        showScorePopup = (...values) => numbersClickCalls.scores.push(values);
        showWrongPopup = () => { numbersClickCalls.wrongPopups++; };
        startAnimation = (type) => numbersClickCalls.animations.push(type);
        jumpToPlatform = (index) => numbersClickCalls.jumps.push(index);
    `, harness.context);

    return { ...harness, calls, clickButtons, classes };
}

function finishWrongAnswerFeedback(harness) {
    const feedbackTimer = [...harness.timers].reverse().find(timer => timer.delay === 300 && !timer.cancelled);
    assert.ok(feedbackTimer, 'wrong-answer feedback should have an active 300 ms timer');
    feedbackTimer.callback();
}

function createNumbersRunFallbackHarness({ recordAnswer = async () => {
    throw new Error('Simulated network failure');
} } = {}) {
    const harness = createNumbersClickHarness();
    harness.calls.wins = 0;
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        createAttemptId: () => 'attempt-1',
        recordAnswer
    };
    vm.runInContext(`
        currentGame = 'numbers';
        currentNumbers = gameData.numbers;
        availableNumbers = [
            gameData.numbers.find(number => number.value === 1),
            gameData.numbers.find(number => number.value === 3)
        ];
        currentNumber = gameData.numbers.find(number => number.value === 2);
        DOM.wordDisplay = { textContent: 'two' };
        startTime = 0;
        activeNumbersRun = {
            runId: 'verified-run',
            mode: 'numbers',
            questionCount: 2,
            questions: [null, null],
            questionIndex: 0,
            pendingAnswers: Promise.resolve(),
            pendingQuestionStart: Promise.resolve(),
            shownQuestionValues: new Set([2]),
            valid: true
        };
        Math.random = () => 0;
        winGame = () => { numbersClickCalls.wins++; };
    `, harness.context);

    return harness;
}

function loadProgressWithCloud(harness, { failCloud = false } = {}) {
    const context = harness.context;
    let cloudUserData = null;
    context.window.currentUser = { uid: 'test-user', email: 'qa@example.test' };
    context.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'server timestamp' } } };
    context.db = {
        collection(name) {
            assert.equal(name, 'users');
            return { doc(uid) { assert.equal(uid, 'test-user'); return { uid }; } };
        },
        async runTransaction(callback) {
            if (failCloud) throw new Error('network unavailable');
            let pendingWrite = null;
            const result = await callback({
                async get() { return { exists: cloudUserData !== null, data: () => cloudUserData }; },
                set(_ref, data) { pendingWrite = data; }
            });
            if (pendingWrite) cloudUserData = { ...(cloudUserData || {}), ...pendingWrite };
            return result;
        }
    };
    harness.loadScript('js/progress-profile.js');
    return { get cloudUserData() { return cloudUserData; } };
}

function createNavigationBrowserContext() {
    const elements = new Map();
    const eventHandlers = new Map();

    function createElement() {
        const attributes = new Map();
        const classes = new Set();
        const listeners = new Map();

        return {
            style: { display: '' },
            tabIndex: -1,
            textContent: '',
            classList: {
                add(...names) { names.forEach((name) => classes.add(name)); },
                remove(...names) { names.forEach((name) => classes.delete(name)); },
                contains(name) { return classes.has(name); },
                toggle(name, force) {
                    const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
                    if (shouldAdd) classes.add(name);
                    else classes.delete(name);
                    return shouldAdd;
                }
            },
            setAttribute(name, value) { attributes.set(name, String(value)); },
            getAttribute(name) { return attributes.get(name) ?? null; },
            removeAttribute(name) { attributes.delete(name); },
            addEventListener(type, handler) {
                const handlers = listeners.get(type) ?? [];
                handlers.push(handler);
                listeners.set(type, handlers);
            },
            dispatch(type, event) {
                for (const handler of listeners.get(type) ?? []) handler(event);
            },
            click() {
                for (const handler of listeners.get('click') ?? []) {
                    handler({ preventDefault() {}, stopPropagation() {} });
                }
            }
        };
    }

    const body = createElement();
    const document = {
        body,
        readyState: 'complete',
        addEventListener() {},
        getElementById(id) { return elements.get(id) ?? null; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    const history = {
        state: null,
        goCalls: [],
        replaceState(state) { this.state = state; },
        pushState(state) { this.state = state; },
        go(delta) { this.goCalls.push(delta); }
    };

    for (const id of [
        'category-container', 'profile-container', 'mobile-bottom-nav',
        'mobile-nav-home', 'mobile-nav-progress', 'mobile-nav-settings',
        'words-settings-overlay', 'audio-settings-kicker',
        'category-numbers', 'category-words', 'category-topics',
        'numbers-menu-container', 'words-menu-container', 'vocab-game-container',
        'simple-verbs-submenu', 'simple-verbs-past-submenu',
        'back-to-category-btn', 'back-to-category-from-vocab'
    ]) {
        elements.set(id, createElement());
    }

    const context = {
        document,
        localStorage: { getItem() { return null; }, setItem() {} },
        sessionStorage: { getItem() { return null; }, setItem() {} },
        navigator: { userAgent: 'test browser' },
        location: { href: 'http://localhost/', hostname: 'localhost', protocol: 'http:' },
        history,
        currentUser: null,
        isGuest: true,
        console: { log() {}, info() {}, warn() {}, error() {} },
        addEventListener(type, handler) {
            const handlers = eventHandlers.get(type) ?? [];
            handlers.push(handler);
            eventHandlers.set(type, handlers);
        },
        removeEventListener() {},
        dispatchEvent() {},
        enlDebug() {},
        CustomEvent: class {
            constructor(type, options = {}) {
                this.type = type;
                this.detail = options.detail;
            }
        },
        setTimeout(callback) {
            callback();
            return 1;
        },
        clearTimeout() {},
        requestAnimationFrame() { return 1; },
        cancelAnimationFrame() {},
        performance: { now() { return 0; } },
        MutationObserver: class { observe() {} }
    };
    context.window = context;

    return {
        context: vm.createContext(context),
        elements,
        history,
        loadScript(relativePath) {
            const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
            vm.runInContext(source, this.context, { filename: relativePath });
        }
    };
}

test('core browser scripts load together in the same global environment', () => {
    const { context, loadHandlers, timers, loadScript } = createBrowserContext();
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const htmlScripts = [...indexHtml.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
    const coreOrderInHtml = htmlScripts.filter((script) => CORE_SCRIPTS.includes(script));
    const audioSettingsIndex = htmlScripts.indexOf('js/audio-settings.js');
    const gameIndex = htmlScripts.indexOf('js/game.js');
    const keyboardAccessibilityIndex = htmlScripts.indexOf('js/keyboard-accessibility.js');
    const categoryNavigationIndex = htmlScripts.indexOf('js/category-navigation.js');
    const mobileNavIndex = htmlScripts.indexOf('js/mobile-nav.js');

    assert.deepEqual(coreOrderInHtml, CORE_SCRIPTS, 'index.html should load core scripts in dependency order');
    assert.notEqual(mobileNavIndex, -1, 'index.html should load mobile-nav.js');
    assert.ok(audioSettingsIndex < mobileNavIndex, 'audio-settings.js must load before mobile-nav.js');
    assert.ok(gameIndex < mobileNavIndex, 'game.js must load before mobile-nav.js');
    assert.ok(keyboardAccessibilityIndex < categoryNavigationIndex, 'keyboard-accessibility.js must load before category-navigation.js');
    assert.ok(gameIndex < categoryNavigationIndex, 'game.js must load before category-navigation.js');
    assert.ok(categoryNavigationIndex < mobileNavIndex, 'category-navigation.js must load before mobile-nav.js');
    for (const script of htmlScripts) {
        if (CORE_SCRIPTS.includes(script)) {
            loadScript(script);
        }
    }

    assert.equal(typeof context.initGame, 'function');
    assert.equal(typeof context.initWordsSettings, 'function');
    assert.equal(typeof context.window.selectGame, 'function');
    assert.equal(loadHandlers.length, 1, 'the core scripts should register one load initializer');
    assert.equal(loadHandlers[0].script, 'js/numbers-game.js', 'Numbers should own game initialization');

    const startupCalls = [];
    context.initWordsSettings = () => startupCalls.push('settings');
    context.initGame = () => startupCalls.push('game');
    loadHandlers[0].handler();

    assert.deepEqual(startupCalls, ['settings']);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 100);

    timers[0].callback();
    assert.deepEqual(startupCalls, ['settings', 'game']);
});

test('opening the Words menu refreshes the review count for the active profile', () => {
    const gameSource = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
    const wordsMenuCase = /case SCREENS\.WORDS_MENU:([\s\S]*?)case SCREENS\.WORDS_SUBMENU:/m.exec(gameSource);

    assert.ok(wordsMenuCase, 'game navigation should define the Words menu screen');
    assert.match(wordsMenuCase[1], /EnglishNextLevelSpacedReviewManager\?\.refresh\?\./);
});

test('Words modal cleanup hooks remain available to shared navigation', () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    assert.doesNotThrow(() => vm.runInContext('hideVocabularyResultModal()', harness.context));
    assert.doesNotThrow(() => vm.runInContext('clearVocabularyResultTimeout()', harness.context));
});

test('category sign-out has one owner in the authentication UI flow', () => {
    const gameSource = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
    const authUiSource = fs.readFileSync(path.join(ROOT, 'js/auth-ui.js'), 'utf8');

    assert.doesNotMatch(gameSource, /categoryLogoutBtn\.addEventListener/);
    assert.match(authUiSource, /if \(categoryLogoutButton\) \{\s*categoryLogoutButton\.addEventListener\('click', \(\) => handleLogout\(categoryLogoutButton\)\);\s*\}/);
});

test('long profile names are shortened to the leaderboard limit', () => {
    const { context, loadScript } = createBrowserContext();
    for (const script of CORE_SCRIPTS) loadScript(script);
    context.window.currentUserName = 'A Profile Name Longer Than Twenty Characters';

    assert.equal(vm.runInContext('getDefaultLeaderboardName()', context), 'A Profile Name Longe');
});

test('Numbers result modal still escapes the saved profile name', () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);
    harness.context.window.currentUserName = '<img src=x>';

    vm.runInContext(`showNumbersResultModal({
        baseScore: 10,
        speedBonus: 1,
        lifeBonus: 1,
        totalGameTime: 8,
        finalScore: 10,
        isNewBest: false,
        completedMode: 'numbers'
    }, { won: true });`, harness.context);

    const modal = harness.context.document.body.children.find(element => element.className === 'numbers-result-modal');
    assert.ok(modal, 'the result dialog should be created');
    assert.match(modal.innerHTML, /value="&lt;img src=x&gt;"/);
    assert.doesNotMatch(modal.innerHTML, /value="<img src=x>"/);
});

test('leaving Numbers releases the focus trap from the active result dialog', () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    const dialogElement = {};
    let releaseCount = 0;
    const originalCreateElement = harness.context.document.createElement;
    harness.context.document.createElement = (tagName) => {
        const modal = originalCreateElement(tagName);
        modal.querySelector = selector => selector === '.numbers-result-card' ? dialogElement : null;
        return modal;
    };
    harness.context.window.EnlKeyboardAccessibility = {
        trapDialogFocus(dialog) {
            assert.equal(dialog, dialogElement);
            return () => { releaseCount++; };
        }
    };

    vm.runInContext(`showNumbersResultModal({
        baseScore: 10,
        speedBonus: 1,
        lifeBonus: 1,
        totalGameTime: 8,
        finalScore: 10,
        isNewBest: false,
        completedMode: 'numbers'
    }, { won: true });`, harness.context);
    assert.equal(releaseCount, 0);

    harness.context.window.EnglishNextLevelNumbersResultLifecycle.leaveScreen();
    assert.equal(releaseCount, 1);
});

test('Numbers 11–20 best score survives a local profile reload', () => {
    const storageValues = new Map();

    function loadGuestProfile() {
        const harness = createBrowserContext(storageValues);
        for (const script of CORE_SCRIPTS) harness.loadScript(script);
        harness.context.window.isGuest = true;
        harness.context.window.selectGame('numbers11-20');
        return harness;
    }

    const firstSession = loadGuestProfile();
    firstSession.context.updateHighScore(1250);

    const storageKey = 'englishNextLevel.numbersHighScores.v1.guest';
    const savedScores = JSON.parse(storageValues.get(storageKey));
    assert.equal(savedScores['numbers11-20'], 1250);

    const reloadedSession = loadGuestProfile();
    assert.equal(reloadedSession.context.updateHighScore(), 1250);
});

test('Numbers high scores stay separate while switching between local, guest, and signed-in profiles', () => {
    const storageValues = new Map();
    const harness = createBrowserContext(storageValues);
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    function loadProfile({ isGuest = false, user = null } = {}) {
        harness.context.window.isGuest = isGuest;
        harness.context.window.currentUser = user;
        return vm.runInContext('loadNumbersHighScoresForCurrentProfile()', harness.context);
    }

    assert.equal(loadProfile()['numbers11-20'], 0);
    assert.equal(harness.context.updateHighScore(1500, 'numbers11-20'), 1500);

    assert.equal(loadProfile({ isGuest: true })['numbers11-20'], 0);
    assert.equal(harness.context.updateHighScore(500, 'numbers11-20'), 500);

    assert.equal(loadProfile({ user: { uid: 'account-a' } })['numbers11-20'], 0);
    assert.equal(harness.context.updateHighScore(2500, 'numbers11-20'), 2500);

    assert.equal(loadProfile({ user: { uid: 'account-b' } })['numbers11-20'], 0);
    assert.equal(loadProfile({ user: { uid: 'account-a' } })['numbers11-20'], 2500);
    assert.equal(loadProfile({ isGuest: true })['numbers11-20'], 500);
    assert.equal(loadProfile()['numbers11-20'], 1500);
});

test('local Numbers wrong answer costs one life and a later correct answer scores the same question', () => {
    const harness = createNumbersClickHarness();

    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[1] })', harness.context);

    assert.equal(vm.runInContext('score', harness.context), 0);
    assert.equal(vm.runInContext('lives', harness.context), 2);
    assert.equal(vm.runInContext('answered', harness.context), false);
    assert.equal(harness.classes[1].has('wrong'), true);
    assert.deepEqual(harness.calls.sounds, ['wrong']);
    assert.equal(harness.calls.wrongPopups, 1);

    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[2] })', harness.context);
    assert.equal(vm.runInContext('score', harness.context), 0, 'the correct platform must also be locked during feedback');
    assert.equal(vm.runInContext('answered', harness.context), false);

    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[0] })', harness.context);
    assert.equal(vm.runInContext('lives', harness.context), 2, 'rapid repeat clicks during feedback must not cost another life');
    assert.equal(harness.calls.wrongPopups, 1, 'rapid repeat clicks during feedback must not show another error');

    finishWrongAnswerFeedback(harness);
    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[2] })', harness.context);

    assert.equal(vm.runInContext('score', harness.context), 75);
    assert.equal(vm.runInContext('lives', harness.context), 2);
    assert.equal(vm.runInContext('streak', harness.context), 1);
    assert.equal(vm.runInContext('answered', harness.context), true);
    assert.deepEqual(harness.calls.jumps, [2]);
    assert.deepEqual(harness.clickButtons.map(button => button.disabled), [true, true, true]);
    assert.equal(harness.classes[2].has('correct'), true);
});

test('verified Numbers wrong attempt keeps its index and a correct retry advances it', async () => {
    const harness = createNumbersClickHarness();
    const attempts = [];
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        createAttemptId: () => `attempt-${attempts.length + 1}`,
        async recordAnswer(runId, questionIndex, answerValue, attemptId) {
            attempts.push({ runId, questionIndex, answerValue, attemptId });
            const correct = answerValue === 2;
            return { correct, questionIndex: correct ? questionIndex + 1 : questionIndex };
        }
    };
    vm.runInContext(`activeNumbersRun = {
        runId: 'verified-run',
        valid: true,
        questionIndex: 0,
        pendingAnswers: Promise.resolve(),
        pendingQuestionStart: Promise.resolve()
    }`, harness.context);

    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[1] })', harness.context);
    await vm.runInContext('activeNumbersRun.pendingAnswers', harness.context);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 0);
    assert.equal(vm.runInContext('answered', harness.context), false);

    finishWrongAnswerFeedback(harness);
    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[2] })', harness.context);
    await vm.runInContext('activeNumbersRun.pendingAnswers', harness.context);

    assert.deepEqual(attempts, [
        { runId: 'verified-run', questionIndex: 0, answerValue: 3, attemptId: 'attempt-1' },
        { runId: 'verified-run', questionIndex: 0, answerValue: 2, attemptId: 'attempt-2' }
    ]);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 1);
    assert.equal(vm.runInContext('score', harness.context), 75);
    assert.equal(vm.runInContext('lives', harness.context), 2);
    assert.equal(vm.runInContext('answered', harness.context), true);
});

test('verified Numbers queues a correct retry while a wrong-answer request is pending', async () => {
    const harness = createNumbersClickHarness();
    const attempts = [];
    let resolveWrongAnswer;
    let markWrongAnswerStarted;
    const wrongAnswerStarted = new Promise(resolve => { markWrongAnswerStarted = resolve; });
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        createAttemptId: () => `attempt-${attempts.length + 1}`,
        recordAnswer(runId, questionIndex, answerValue, attemptId) {
            attempts.push({ runId, questionIndex, answerValue, attemptId });
            if (attempts.length === 1) {
                markWrongAnswerStarted();
                return new Promise(resolve => { resolveWrongAnswer = resolve; });
            }
            return Promise.resolve({ correct: true, questionIndex: questionIndex + 1 });
        }
    };
    vm.runInContext(`activeNumbersRun = {
        runId: 'verified-run',
        valid: true,
        questionIndex: 0,
        pendingAnswers: Promise.resolve(),
        pendingQuestionStart: Promise.resolve()
    }`, harness.context);

    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[1] })', harness.context);
    await wrongAnswerStarted;
    finishWrongAnswerFeedback(harness);
    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[2] })', harness.context);

    assert.equal(attempts.length, 1, 'the correct retry should wait behind the pending wrong answer');
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 1);
    resolveWrongAnswer({ correct: false, questionIndex: 0 });
    await vm.runInContext('activeNumbersRun.pendingAnswers', harness.context);

    assert.deepEqual(attempts, [
        { runId: 'verified-run', questionIndex: 0, answerValue: 3, attemptId: 'attempt-1' },
        { runId: 'verified-run', questionIndex: 0, answerValue: 2, attemptId: 'attempt-2' }
    ]);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 1);
    assert.equal(vm.runInContext('score', harness.context), 75);
    assert.equal(vm.runInContext('lives', harness.context), 2);
});

test('Numbers skips a queued correct retry after a pending wrong answer fails and keeps the fallback limit', async () => {
    let rejectWrongAnswer;
    let markWrongAnswerStarted;
    const wrongAnswerStarted = new Promise(resolve => { markWrongAnswerStarted = resolve; });
    const attempts = [];
    const harness = createNumbersRunFallbackHarness({
        recordAnswer(runId, questionIndex, answerValue, attemptId) {
            attempts.push({ runId, questionIndex, answerValue, attemptId });
            if (attempts.length > 1) {
                return Promise.resolve({ correct: true, questionIndex: questionIndex + 1 });
            }
            markWrongAnswerStarted();
            return new Promise((resolve, reject) => { rejectWrongAnswer = reject; });
        }
    });

    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[1] })', harness.context);
    await wrongAnswerStarted;
    finishWrongAnswerFeedback(harness);
    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[2] })', harness.context);

    assert.equal(attempts.length, 1, 'the correct retry should wait behind the pending wrong answer');
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 1);

    const pendingRound = vm.runInContext('nextRound()', harness.context);
    rejectWrongAnswer(new Error('Simulated connection loss'));
    await pendingRound;
    await vm.runInContext('activeNumbersRun.pendingAnswers', harness.context);

    assert.equal(vm.runInContext('activeNumbersRun.valid', harness.context), false);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 1);
    assert.deepEqual(attempts, [
        { runId: 'verified-run', questionIndex: 0, answerValue: 3, attemptId: 'attempt-1' }
    ], 'the queued correct retry must not be sent after the run is invalidated');
    assert.notEqual(vm.runInContext('currentNumber.value', harness.context), 2);
    assert.equal(vm.runInContext('availableNumbers.length', harness.context), 0);
    assert.equal(vm.runInContext('activeNumbersRun.shownQuestionValues.has(currentNumber.value)', harness.context), true);

    vm.runInContext(`handlePlatformClick({ currentTarget: DOM.platforms.find(button => Number(button.dataset.value) === currentNumber.value) })`, harness.context);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 2);
    await vm.runInContext('nextRound()', harness.context);

    assert.equal(harness.calls.wins, 1);
    assert.equal(attempts.length, 1);
});

test('Numbers keeps the question limit when a correct server answer cannot be validated', async () => {
    const harness = createNumbersRunFallbackHarness();

    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[2] })', harness.context);
    await vm.runInContext('activeNumbersRun.pendingAnswers', harness.context);
    assert.equal(vm.runInContext('activeNumbersRun.valid', harness.context), false);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 1);

    await vm.runInContext('nextRound()', harness.context);
    assert.notEqual(vm.runInContext('currentNumber.value', harness.context), 2);
    assert.equal(vm.runInContext('availableNumbers.length', harness.context), 0);
    assert.equal(vm.runInContext('activeNumbersRun.shownQuestionValues.has(currentNumber.value)', harness.context), true);

    vm.runInContext(`handlePlatformClick({ currentTarget: DOM.platforms.find(button => Number(button.dataset.value) === currentNumber.value) })`, harness.context);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 2);
    await vm.runInContext('nextRound()', harness.context);

    assert.equal(harness.calls.wins, 1);
    assert.equal(vm.runInContext('availableNumbers.length', harness.context), 0);
});

test('Numbers advances the local fallback after an unvalidated wrong attempt is corrected', async () => {
    const harness = createNumbersRunFallbackHarness();

    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[1] })', harness.context);
    await vm.runInContext('activeNumbersRun.pendingAnswers', harness.context);
    assert.equal(vm.runInContext('activeNumbersRun.valid', harness.context), false);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 0);

    finishWrongAnswerFeedback(harness);
    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[2] })', harness.context);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 1);
    await vm.runInContext('nextRound()', harness.context);
    assert.notEqual(vm.runInContext('currentNumber.value', harness.context), 2);
    assert.equal(vm.runInContext('availableNumbers.length', harness.context), 0);

    vm.runInContext(`handlePlatformClick({ currentTarget: DOM.platforms.find(button => Number(button.dataset.value) === currentNumber.value) })`, harness.context);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 2);
    await vm.runInContext('nextRound()', harness.context);

    assert.equal(harness.calls.wins, 1);
    assert.equal(vm.runInContext('availableNumbers.length', harness.context), 0);
});

test('Numbers falls back within the question limit when answer validation fails during round transition', async () => {
    let rejectAnswer;
    let markAnswerStarted;
    const answerStarted = new Promise(resolve => { markAnswerStarted = resolve; });
    const harness = createNumbersRunFallbackHarness({
        recordAnswer() {
            markAnswerStarted();
            return new Promise((resolve, reject) => { rejectAnswer = reject; });
        }
    });

    vm.runInContext('handlePlatformClick({ currentTarget: clickPlatformButtons[2] })', harness.context);
    await answerStarted;
    const pendingRound = vm.runInContext('nextRound()', harness.context);
    rejectAnswer(new Error('Simulated connection loss'));
    await pendingRound;

    assert.equal(vm.runInContext('activeNumbersRun.valid', harness.context), false);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 1);
    assert.notEqual(vm.runInContext('currentNumber.value', harness.context), 2);
    assert.equal(vm.runInContext('availableNumbers.length', harness.context), 0);
    assert.equal(vm.runInContext('activeNumbersRun.shownQuestionValues.has(currentNumber.value)', harness.context), true);

    vm.runInContext(`handlePlatformClick({ currentTarget: DOM.platforms.find(button => Number(button.dataset.value) === currentNumber.value) })`, harness.context);
    assert.equal(vm.runInContext('activeNumbersRun.questionIndex', harness.context), 2);
    await vm.runInContext('nextRound()', harness.context);

    assert.equal(harness.calls.wins, 1);
});

test('Numbers continues when the browser localStorage getter is blocked', () => {
    const harness = createBrowserContext();
    Object.defineProperty(harness.context, 'localStorage', {
        configurable: true,
        get() { throw new Error('storage blocked'); }
    });
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    const loadedScores = vm.runInContext('loadNumbersHighScoresForCurrentProfile(true)', harness.context);
    assert.equal(loadedScores.numbers, 0);
    assert.equal(loadedScores['numbers11-20'], 0);
    assert.equal(vm.runInContext('persistNumbersHighScores()', harness.context), false);
});

test('Numbers does not show a new best score when all persistence paths fail', () => {
    const harness = createBrowserContext(new Map(), { failWrites: true });
    for (const script of CORE_SCRIPTS) harness.loadScript(script);
    harness.context.window.isGuest = true;
    harness.context.window.selectGame('numbers11-20');
    vm.runInContext("lastNumbersResult = { finalScore: 1250, isNewBest: true, completedMode: 'numbers11-20' }", harness.context);

    assert.equal(harness.context.updateHighScore(1250), 0);
    assert.equal(vm.runInContext('lastNumbersResult.isNewBest', harness.context), false);
    assert.equal(harness.numbersResultBestBadge.removed, true);
});

test('Numbers reverts a volatile best score when both local and cloud saves fail', async () => {
    const harness = createBrowserContext(new Map(), { failWrites: true });
    for (const script of CORE_SCRIPTS) harness.loadScript(script);
    harness.context.window.selectGame('numbers11-20');
    const cloud = loadProgressWithCloud(harness, { failCloud: true });

    assert.equal(harness.context.updateHighScore(1250), 1250);
    vm.runInContext("lastNumbersResult = { finalScore: 1250, isNewBest: true, completedMode: 'numbers11-20' }", harness.context);
    await harness.context.window.EnglishNextLevelProgress.refreshProfile();

    assert.equal(harness.context.updateHighScore(), 0);
    assert.equal(harness.context.window.EnglishNextLevelProgress.getProgress().numbers.bestScores['numbers11-20'], 0);
    assert.equal(vm.runInContext('lastNumbersResult.isNewBest', harness.context), false);
    assert.equal(harness.numbersResultBestBadge.removed, true);
    assert.equal(cloud.cloudUserData, null);
});

test('Numbers keeps its best score when cloud sync succeeds without local storage', async () => {
    const harness = createBrowserContext(new Map(), { failWrites: true });
    for (const script of CORE_SCRIPTS) harness.loadScript(script);
    harness.context.window.selectGame('numbers11-20');
    const cloud = loadProgressWithCloud(harness);

    assert.equal(harness.context.updateHighScore(1250), 1250);
    vm.runInContext("lastNumbersResult = { finalScore: 1250, isNewBest: true, completedMode: 'numbers11-20' }", harness.context);
    await harness.context.window.EnglishNextLevelProgress.refreshProfile();

    assert.equal(harness.context.updateHighScore(), 1250);
    assert.equal(vm.runInContext('lastNumbersResult.isNewBest', harness.context), true);
    assert.equal(harness.numbersResultBestBadge.removed, false);
    assert.equal(cloud.cloudUserData.progressV1.numbers.bestScores['numbers11-20'], 1250);
});

test('Numbers local fallback excludes a question already shown by the server', async () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    let questionRequests = 0;
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        async startQuestion() {
            questionRequests++;
            if (questionRequests === 1) {
                return { started: true, questionIndex: 0, question: { word: 'two', options: [1, 2, 3] } };
            }
            throw new Error('Simulated network failure');
        }
    };
    vm.runInContext(`
        DOM.wordDisplay = { textContent: '' };
        DOM.platforms = [0, 1, 2].map(() => ({
            disabled: false,
            textContent: '',
            dataset: {},
            classList: { remove() {}, add() {} }
        }));
        currentNumbers = gameData.numbers;
        availableNumbers = [gameData.numbers[0], gameData.numbers[1], gameData.numbers[2]];
        gameActive = true;
        startTime = 0;
        Math.random = () => 0;
        activeNumbersRun = {
            runId: 'abcdefghijklmnopqrst',
            mode: 'numbers',
            questionCount: 3,
            questions: [null, null, null],
            questionIndex: 0,
            pendingAnswers: Promise.resolve(),
            pendingQuestionStart: Promise.resolve(),
            shownQuestionValues: new Set(),
            valid: true
        };
    `, harness.context);

    await vm.runInContext('nextRound()', harness.context);
    assert.equal(vm.runInContext('currentNumber.value', harness.context), 2);
    assert.deepEqual(
        JSON.parse(vm.runInContext('JSON.stringify(availableNumbers.map(number => number.value))', harness.context)),
        [1, 3]
    );

    vm.runInContext('activeNumbersRun.questionIndex = 1', harness.context);
    await vm.runInContext('nextRound()', harness.context);

    assert.equal(questionRequests, 2);
    assert.equal(vm.runInContext('activeNumbersRun.valid', harness.context), false);
    assert.notEqual(vm.runInContext('currentNumber.value', harness.context), 2);
    assert.equal(vm.runInContext('availableNumbers.some(number => number.value === 2)', harness.context), false);
});

test('Numbers server run ends at its question count when remote questions are outside the local sample', async () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    let questionRequests = 0;
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        async startQuestion(_runId, questionIndex) {
            questionRequests++;
            const question = questionIndex === 0
                ? { word: 'thirteen', options: [11, 12, 13] }
                : { word: 'fourteen', options: [12, 13, 14] };
            return { started: true, questionIndex, question };
        }
    };
    vm.runInContext(`
        DOM.wordDisplay = { textContent: '' };
        DOM.platforms = [0, 1, 2].map(() => ({
            disabled: false,
            textContent: '',
            dataset: {},
            classList: { remove() {}, add() {} }
        }));
        currentNumbers = gameData.numbers11_20;
        availableNumbers = [gameData.numbers11_20[0], gameData.numbers11_20[1]];
        gameActive = true;
        startTime = 0;
        Math.random = () => 0;
        activeNumbersRun = {
            runId: 'abcdefghijklmnopqrst',
            mode: 'numbers11-20',
            questionCount: 2,
            questions: [null, null],
            questionIndex: 0,
            pendingAnswers: Promise.resolve(),
            pendingQuestionStart: Promise.resolve(),
            shownQuestionValues: new Set(),
            valid: true
        };
    `, harness.context);

    await vm.runInContext('nextRound()', harness.context);
    assert.equal(vm.runInContext('currentNumber.value', harness.context), 13);
    assert.equal(vm.runInContext('availableNumbers.length', harness.context), 2);

    vm.runInContext('activeNumbersRun.questionIndex = 1', harness.context);
    await vm.runInContext('nextRound()', harness.context);
    assert.equal(vm.runInContext('currentNumber.value', harness.context), 14);

    let winCalled = 0;
    let runWasValidAtWin = false;
    harness.context.winGame = () => {
        winCalled++;
        runWasValidAtWin = vm.runInContext('activeNumbersRun.valid', harness.context);
    };
    vm.runInContext('activeNumbersRun.questionIndex = 2', harness.context);
    await vm.runInContext('nextRound()', harness.context);

    assert.equal(questionRequests, 2);
    assert.equal(winCalled, 1);
    assert.equal(runWasValidAtWin, true);
});

test('leaving Numbers while a server question is pending ignores its late response', async () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    let resolveQuestion;
    let markQuestionRequested;
    const questionRequested = new Promise(resolve => { markQuestionRequested = resolve; });
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        startQuestion() {
            markQuestionRequested();
            return new Promise(resolve => { resolveQuestion = resolve; });
        }
    };
    vm.runInContext(`
        DOM.game = { classList: { add() {}, remove() {} } };
        DOM.wordDisplay = { textContent: '' };
        DOM.instructions = { textContent: '' };
        DOM.platforms = [0, 1, 2].map(() => ({
            disabled: false,
            textContent: '',
            dataset: {},
            classList: { remove() {}, add() {} }
        }));
        currentNumbers = gameData.numbers;
        availableNumbers = [gameData.numbers[0], gameData.numbers[1]];
        gameActive = true;
        startTime = 0;
        currentScreen = null;
        activeNumbersRun = {
            runId: 'abcdefghijklmnopqrst',
            mode: 'numbers',
            questionCount: 2,
            questions: [null, null],
            questionIndex: 0,
            pendingAnswers: Promise.resolve(),
            pendingQuestionStart: Promise.resolve(),
            shownQuestionValues: new Set(),
            valid: true
        };
    `, harness.context);

    const pendingRound = vm.runInContext('nextRound()', harness.context);
    await questionRequested;
    vm.runInContext('showMenu()', harness.context);
    resolveQuestion({ started: true, questionIndex: 0, question: { word: 'two', options: [1, 2, 3] } });

    await assert.doesNotReject(pendingRound);
    assert.equal(vm.runInContext('DOM.wordDisplay.textContent', harness.context), 'Ready?');
    assert.equal(vm.runInContext('activeNumbersRun', harness.context), null);
});

test('leaving Numbers while server finish is pending ignores its late failure', async () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    let rejectFinish;
    let markFinishRequested;
    const finishRequested = new Promise(resolve => { markFinishRequested = resolve; });
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        finish() {
            markFinishRequested();
            return new Promise((resolve, reject) => { rejectFinish = reject; });
        }
    };
    vm.runInContext(`
        gameActive = true;
        gameEnded = false;
        activeNumbersRun = {
            runId: 'abcdefghijklmnopqrst',
            mode: 'numbers',
            pendingAnswers: Promise.resolve(),
            valid: true
        };
        DOM.instructions = { textContent: '' };
        DOM.platforms = [];
        resetEagle = () => {};
    `, harness.context);

    const pendingWin = vm.runInContext('winGame()', harness.context);
    await finishRequested;
    harness.context.window.selectGame('tens');
    rejectFinish(new Error('Simulated late network failure'));
    await pendingWin;

    assert.equal(vm.runInContext('currentGame', harness.context), 'tens');
    assert.equal(vm.runInContext('activeNumbersRun', harness.context), null);
    assert.equal(harness.timers.some(timer => timer.delay === 450), false);
});

for (const resultPath of ['win', 'game over']) {
    test(`leaving Numbers cancels a pending ${resultPath} dialog`, async () => {
        const harness = createBrowserContext();
        for (const script of CORE_SCRIPTS) harness.loadScript(script);

        let resultDialogCalls = 0;
        harness.context.showNumbersResultModal = () => { resultDialogCalls += 1; };
        vm.runInContext(`
            gameActive = true;
            gameEnded = false;
            activeNumbersRun = null;
            DOM.platforms = [];
            stopTimer = () => {};
            playSound = () => {};
            resetEagle = () => {};
            loadNumbersHighScoresForCurrentProfile = () => {};
            updateHighScore = () => {};
        `, harness.context);

        if (resultPath === 'win') await vm.runInContext('winGame()', harness.context);
        else vm.runInContext('gameOver()', harness.context);

        const resultTimer = harness.timers.find(timer => timer.delay === 450);
        assert.ok(resultTimer, 'the result modal should be scheduled');
        harness.context.window.selectGame('tens');

        assert.equal(resultTimer.cancelled, true);
        resultTimer.callback();
        assert.equal(resultDialogCalls, 0);
        assert.equal(vm.runInContext('currentGame', harness.context), 'tens');
    });
}

test('shared Progress navigation cancels a pending Numbers result dialog', async () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    let resultDialogCalls = 0;
    harness.context.showNumbersResultModal = () => { resultDialogCalls += 1; };
    vm.runInContext(`
        gameActive = true;
        gameEnded = false;
        activeNumbersRun = null;
        currentScreen = SCREENS.NUMBERS_GAME;
        navigationStack = [];
        window.isGuest = true;
        DOM.platforms = [];
        stopTimer = () => {};
        playSound = () => {};
        resetEagle = () => {};
        loadNumbersHighScoresForCurrentProfile = () => {};
        updateHighScore = () => {};
    `, harness.context);

    await vm.runInContext('winGame()', harness.context);
    const resultTimer = harness.timers.find(timer => timer.delay === 450);
    assert.ok(resultTimer, 'the win dialog should be scheduled');

    harness.context.navigateToRoot('profile');

    assert.equal(resultTimer.cancelled, true);
    assert.equal(vm.runInContext('currentScreen', harness.context), 'profile');
    resultTimer.callback();
    assert.equal(resultDialogCalls, 0);
});

for (const finishOutcome of ['success', 'failure']) {
    test(`shared Progress navigation ignores a late Numbers finish ${finishOutcome}`, async () => {
        const harness = createBrowserContext();
        for (const script of CORE_SCRIPTS) harness.loadScript(script);

        let settleFinish;
        let markFinishRequested;
        const finishRequested = new Promise(resolve => { markFinishRequested = resolve; });
        harness.context.window.EnglishNextLevelNumbersRunClient = {
            finish() {
                markFinishRequested();
                return new Promise((resolve, reject) => { settleFinish = finishOutcome === 'success' ? resolve : reject; });
            }
        };
        vm.runInContext(`
            gameActive = true;
            gameEnded = false;
            activeNumbersRun = {
                runId: 'abcdefghijklmnopqrst',
                mode: 'numbers',
                pendingAnswers: Promise.resolve(),
                valid: true
            };
            currentScreen = SCREENS.NUMBERS_GAME;
            navigationStack = [];
            window.isGuest = true;
            DOM.platforms = [];
            stopTimer = () => {};
            playSound = () => {};
            resetEagle = () => {};
            loadNumbersHighScoresForCurrentProfile = () => {};
            window.savedHighScores = [];
            updateHighScore = (...args) => { window.savedHighScores.push(args); };
        `, harness.context);
        let resultDialogCalls = 0;
        harness.context.showNumbersResultModal = () => { resultDialogCalls += 1; };

        const pendingWin = vm.runInContext('winGame()', harness.context);
        await finishRequested;
        harness.context.navigateToRoot('profile');
        if (finishOutcome === 'success') {
            settleFinish({ finalScore: 12, time: 30 });
        } else {
            settleFinish(new Error('Simulated late network failure'));
        }
        await pendingWin;

        assert.equal(vm.runInContext('currentScreen', harness.context), 'profile');
        assert.equal(vm.runInContext('activeNumbersRun', harness.context), null);
        assert.equal(vm.runInContext('gameActive', harness.context), false);
        assert.equal(harness.timers.some(timer => timer.delay === 450), false);
        assert.equal(resultDialogCalls, 0);
        const savedHighScores = JSON.parse(vm.runInContext('JSON.stringify(window.savedHighScores)', harness.context));
        if (finishOutcome === 'success') {
            assert.equal(vm.runInContext('lastNumbersResult.finalScore', harness.context), 12);
            assert.deepEqual(savedHighScores, [[12, 'numbers']]);
        } else {
            assert.equal(savedHighScores.length, 0);
        }
    });
}

test('a late verified Numbers score stays with the account that started the run', async () => {
    const storedValues = new Map();
    const harness = createBrowserContext(storedValues);
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    let settleFinish;
    let markFinishRequested;
    const finishRequested = new Promise(resolve => { markFinishRequested = resolve; });
    const progressWrites = [];
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        finish() {
            markFinishRequested();
            return new Promise(resolve => { settleFinish = resolve; });
        }
    };
    harness.context.window.EnglishNextLevelProgress = {
        recordNumbersBest(...args) {
            progressWrites.push(args);
            return true;
        }
    };
    vm.runInContext(`
        gameActive = true;
        gameEnded = false;
        window.currentUser = { uid: 'source-user' };
        window.isGuest = false;
        activeNumbersRun = {
            runId: 'abcdefghijklmnopqrst',
            mode: 'numbers',
            pendingAnswers: Promise.resolve(),
            profileStorageKey: getNumbersHighScoreStorageKey(),
            valid: true
        };
        currentScreen = SCREENS.NUMBERS_GAME;
        navigationStack = [];
        DOM.platforms = [];
        stopTimer = () => {};
        playSound = () => {};
        resetEagle = () => {};
    `, harness.context);

    const pendingWin = vm.runInContext('winGame()', harness.context);
    await finishRequested;
    vm.runInContext("window.currentUser = { uid: 'next-user' }", harness.context);
    harness.context.navigateToRoot('profile');
    settleFinish({ finalScore: 42, time: 25 });
    await pendingWin;

    const sourceProfileKey = 'englishNextLevel.numbersHighScores.v1.user.source-user';
    const nextProfileKey = 'englishNextLevel.numbersHighScores.v1.user.next-user';
    assert.equal(JSON.parse(storedValues.get(sourceProfileKey)).numbers, 42);
    assert.equal(storedValues.has(nextProfileKey), false);
    assert.deepEqual(progressWrites, []);
    assert.equal(harness.timers.some(timer => timer.delay === 450), false);
});

test('shared Progress navigation lets pending verified Numbers answers finish saving', async () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    let resolveAnswers;
    const pendingAnswers = new Promise(resolve => { resolveAnswers = resolve; });
    let markFinishRequested;
    const finishRequested = new Promise(resolve => { markFinishRequested = resolve; });
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        finish() {
            markFinishRequested();
            return Promise.resolve({ finalScore: 22 });
        }
    };
    harness.context.pendingAnswerPromise = pendingAnswers;
    vm.runInContext(`
        gameActive = true;
        gameEnded = false;
        activeNumbersRun = {
            runId: 'abcdefghijklmnopqrst',
            mode: 'numbers',
            pendingAnswers: pendingAnswerPromise,
            valid: true
        };
        currentScreen = SCREENS.NUMBERS_GAME;
        navigationStack = [];
        window.isGuest = true;
        DOM.platforms = [];
        stopTimer = () => {};
        playSound = () => {};
        resetEagle = () => {};
        loadNumbersHighScoresForCurrentProfile = () => {};
        window.savedHighScores = [];
        updateHighScore = (...args) => { window.savedHighScores.push(args); };
    `, harness.context);
    let resultDialogCalls = 0;
    harness.context.showNumbersResultModal = () => { resultDialogCalls += 1; };

    const pendingWin = vm.runInContext('winGame()', harness.context);
    await Promise.resolve();
    harness.context.navigateToRoot('profile');
    resolveAnswers();
    await finishRequested;
    await pendingWin;

    assert.equal(vm.runInContext('activeNumbersRun', harness.context), null);
    assert.equal(vm.runInContext('lastNumbersResult.finalScore', harness.context), 22);
    assert.deepEqual(
        JSON.parse(vm.runInContext('JSON.stringify(window.savedHighScores)', harness.context)),
        [[22, 'numbers']]
    );
    assert.equal(harness.timers.some(timer => timer.delay === 450), false);
    assert.equal(resultDialogCalls, 0);
});

test('shared Progress navigation invalidates a pending Numbers start', async () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);

    let resolveStart;
    let markStartRequested;
    const startRequested = new Promise(resolve => { markStartRequested = resolve; });
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        canSubmitGlobally: () => true,
        start() {
            markStartRequested();
            return new Promise(resolve => { resolveStart = resolve; });
        }
    };
    vm.runInContext(`
        currentScreen = SCREENS.NUMBERS_GAME;
        navigationStack = [];
        window.isGuest = true;
        DOM.game = { classList: { add() {}, remove() {} } };
        DOM.startButton = { style: {}, classList: { add() {}, remove() {} }, disabled: false };
        DOM.instructions = { textContent: '' };
        DOM.platforms = [];
        ProgrammaticSfxEngine.primeFromUserGesture = () => {};
    `, harness.context);

    const pendingStart = vm.runInContext('startGame()', harness.context);
    await startRequested;
    harness.context.navigateToRoot('profile');
    resolveStart({
        runId: 'abcdefghijklmnopqrst',
        mode: 'numbers',
        questionCount: 1
    });
    await pendingStart;

    assert.equal(vm.runInContext('currentScreen', harness.context), 'profile');
    assert.equal(vm.runInContext('activeNumbersRun', harness.context), null);
    assert.equal(vm.runInContext('numbersRunStarting', harness.context), false);
    assert.equal(vm.runInContext('gameActive', harness.context), false);
    assert.equal(vm.runInContext('DOM.instructions.textContent', harness.context), 'Press START to begin');
});

test('Numbers run captures the profile that started it', async () => {
    const harness = createBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        canSubmitGlobally: () => true,
        async start(mode) {
            return { runId: 'abcdefghijklmnopqrst', mode, questionCount: 1 };
        }
    };
    vm.runInContext(`
        window.currentUser = { uid: 'source-user' };
        window.isGuest = false;
        DOM.game = { classList: { add() {}, remove() {} } };
        DOM.startButton = { style: {}, classList: { add() {}, remove() {} }, disabled: false };
        DOM.instructions = { textContent: '' };
        DOM.gameStats = { style: {} };
        ProgrammaticSfxEngine.primeFromUserGesture = () => {};
        resetGame = () => {};
    `, harness.context);

    await vm.runInContext('startGame()', harness.context);

    assert.equal(
        vm.runInContext('activeNumbersRun.profileStorageKey', harness.context),
        'englishNextLevel.numbersHighScores.v1.user.source-user'
    );
    assert.equal(
        vm.runInContext('activeNumbersRunProfileStorageKey', harness.context),
        'englishNextLevel.numbersHighScores.v1.user.source-user'
    );
});

test('local Numbers round saves its best score to the profile that started it', async () => {
    const storageValues = new Map();
    const harness = createBrowserContext(storageValues);
    for (const script of CORE_SCRIPTS) harness.loadScript(script);
    harness.context.window.currentUser = { uid: 'local-round-owner' };
    harness.context.window.isGuest = false;
    harness.context.window.EnglishNextLevelNumbersRunClient = {
        canSubmitGlobally: () => false
    };
    vm.runInContext(`
        DOM.game = { classList: { add() {}, remove() {} } };
        DOM.startButton = { style: {}, classList: { add() {}, remove() {} }, disabled: false };
        DOM.instructions = { textContent: '' };
        DOM.gameStats = { style: {} };
        ProgrammaticSfxEngine.primeFromUserGesture = () => {};
        resetGame = () => {};
        playSound = () => {};
    `, harness.context);

    await vm.runInContext('startGame()', harness.context);
    harness.context.window.currentUser = { uid: 'different-account' };
    vm.runInContext('score = 1200;', harness.context);
    await vm.runInContext('winGame()', harness.context);

    const ownerScores = JSON.parse(storageValues.get(
        'englishNextLevel.numbersHighScores.v1.user.local-round-owner'
    ));
    assert.ok(ownerScores.numbers > 0);
    assert.equal(storageValues.has('englishNextLevel.numbersHighScores.v1.user.different-account'), false);
});

test('screen navigation has no legacy bypass helpers', () => {
    const harness = createNavigationBrowserContext();
    harness.loadScript('js/keyboard-accessibility.js');
    harness.loadScript('js/game.js');
    harness.loadScript('js/category-navigation.js');

    assert.equal(typeof harness.context.navigateTo, 'function');
    assert.equal(typeof harness.context.showScreen, 'function');
    assert.equal('showCategoryScreen' in harness.context, false);
    assert.equal('showNumbersMenu' in harness.context, false);
});

test('leaving the Numbers menu or game closes its leaderboard without restoring hidden focus', () => {
    for (const sourceScreen of ['numbersMenu', 'numbersGame']) {
        const harness = createNavigationBrowserContext();
        const closeOptions = [];
        harness.context.closeWordsSettings = () => {};
        harness.context.syncNumbersMenuBestScores = () => {};
        harness.context.closeLeaderboardModal = (options) => closeOptions.push(options);
        harness.loadScript('js/keyboard-accessibility.js');
        harness.loadScript('js/game.js');

        harness.context.showScreen(sourceScreen);
        harness.context.showScreen('categories');

        assert.equal(closeOptions.length, 1, `${sourceScreen} should close the active leaderboard`);
        assert.equal(closeOptions[0].restoreFocus, false);
    }
});

test('category cards navigate through the shared screen manager and support keyboard activation', () => {
    const harness = createNavigationBrowserContext();
    harness.context.closeWordsSettings = () => {};
    harness.context.syncNumbersMenuBestScores = () => {};
    harness.loadScript('js/keyboard-accessibility.js');
    harness.loadScript('js/game.js');
    harness.loadScript('js/category-navigation.js');

    harness.elements.get('category-numbers').click();
    assert.equal(harness.history.state.screen, 'numbersMenu');
    assert.equal(harness.elements.get('category-container').style.display, 'none');
    assert.equal(harness.elements.get('numbers-menu-container').style.display, 'block');

    const keyboardHarness = createNavigationBrowserContext();
    keyboardHarness.context.closeWordsSettings = () => {};
    keyboardHarness.context.syncNumbersMenuBestScores = () => {};
    keyboardHarness.loadScript('js/keyboard-accessibility.js');
    keyboardHarness.loadScript('js/game.js');
    keyboardHarness.loadScript('js/category-navigation.js');
    let prevented = false;
    const wordsCard = keyboardHarness.elements.get('category-words');
    assert.equal(wordsCard.tabIndex, 0);
    wordsCard.dispatch('keydown', {
        key: 'Enter',
        repeat: false,
        preventDefault() { prevented = true; }
    });

    assert.equal(prevented, true);
    assert.equal(keyboardHarness.history.state.screen, 'wordsMenu');
    assert.equal(keyboardHarness.context.document.body.getAttribute('data-screen'), 'words');
    assert.equal(keyboardHarness.elements.get('words-menu-container').style.display, 'block');

    const spaceHarness = createNavigationBrowserContext();
    spaceHarness.context.closeWordsSettings = () => {};
    spaceHarness.loadScript('js/keyboard-accessibility.js');
    spaceHarness.loadScript('js/game.js');
    spaceHarness.loadScript('js/category-navigation.js');
    const topicsCard = spaceHarness.elements.get('category-topics');
    let spacePrevented = false;
    topicsCard.dispatch('keydown', {
        key: ' ',
        repeat: false,
        preventDefault() { spacePrevented = true; }
    });
    assert.equal(spacePrevented, true);
    assert.equal(spaceHarness.history.state, null, 'Space activates the card on key release');
    topicsCard.dispatch('keyup', { key: ' ', preventDefault() {} });
    assert.equal(spaceHarness.history.state.screen, 'topicsMenu');
});

test('category back buttons share browser-history navigation', () => {
    const cases = [
        ['back-to-category-btn', 'numbersMenu'],
        ['back-to-category-from-vocab', 'wordsGame']
    ];

    for (const [buttonId, destination] of cases) {
        const harness = createNavigationBrowserContext();
        harness.context.closeWordsSettings = () => {};
        harness.context.syncNumbersMenuBestScores = () => {};
        harness.loadScript('js/keyboard-accessibility.js');
        harness.loadScript('js/game.js');
        harness.loadScript('js/category-navigation.js');
        harness.context.showScreen('categories');
        harness.context.navigateTo(destination);

        harness.elements.get(buttonId).click();

        assert.deepEqual(harness.history.goCalls, [-1], `${buttonId} should use the shared browser history`);
        if (buttonId === 'back-to-category-from-vocab') {
            assert.equal(
                harness.elements.get('vocab-game-container').style.display,
                'none',
                'the Words game should be hidden before asynchronous browser history completes'
            );
        }
    }
});

test('Words submenu is hidden before asynchronous browser back completes', () => {
    const harness = createNavigationBrowserContext();
    harness.context.closeWordsSettings = () => {};
    harness.loadScript('js/keyboard-accessibility.js');
    harness.loadScript('js/game.js');
    harness.context.showScreen('categories');
    harness.context.navigateTo('wordsSubmenu');

    const submenu = harness.elements.get('simple-verbs-submenu');
    assert.equal(submenu.style.display, 'block');

    assert.equal(harness.context.goBack(), true, 'browser-history navigation should report that popstate is expected');

    assert.deepEqual(harness.history.goCalls, [-1]);
    assert.equal(submenu.style.display, 'none');
});

test('goBack reports a synchronous result when browser history is unavailable', () => {
    const harness = createNavigationBrowserContext();
    harness.context.closeWordsSettings = () => {};
    harness.context.syncNumbersMenuBestScores = () => {};
    harness.loadScript('js/keyboard-accessibility.js');
    harness.loadScript('js/game.js');
    harness.context.showScreen('categories');
    harness.context.navigateTo('wordsSubmenu');
    harness.history.state = { screen: 'invalid-app-history' };

    assert.equal(harness.context.goBack(), false);
    assert.equal(harness.context.document.body.getAttribute('data-screen'), 'categories');
    assert.deepEqual(harness.history.goCalls, []);
});

test('mobile bottom navigation opens Progress and Settings for a guest', () => {
    const harness = createNavigationBrowserContext();
    for (const script of CORE_SCRIPTS) harness.loadScript(script);
    harness.loadScript('js/mobile-nav.js');

    const navigateToRoot = harness.context.navigateToRoot;
    let requestedRoot = null;
    assert.equal(typeof navigateToRoot, 'function');
    harness.context.navigateToRoot = (screen) => {
        requestedRoot = screen;
        return navigateToRoot(screen);
    };

    harness.context.showScreen('categories');
    harness.elements.get('mobile-nav-progress').click();

    assert.equal(requestedRoot, 'profile');
    assert.equal(harness.context.document.body.getAttribute('data-screen'), 'profile');
    assert.equal(harness.elements.get('profile-container').style.display, 'block');
    assert.equal(harness.elements.get('category-container').style.display, 'none');
    assert.equal(harness.history.state.screen, 'profile');
    assert.deepEqual(harness.history.goCalls, []);

    harness.elements.get('mobile-nav-settings').click();

    assert.equal(harness.elements.get('words-settings-overlay').classList.contains('visible'), true);
    assert.equal(harness.elements.get('words-settings-overlay').getAttribute('aria-hidden'), 'false');
    assert.equal(harness.elements.get('mobile-nav-settings').classList.contains('is-active'), true);
});

test('mobile navigation includes the rendered Words root screen', () => {
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const mobileNav = fs.readFileSync(path.join(ROOT, 'js/mobile-nav.js'), 'utf8');
    const mobileNavStyles = fs.readFileSync(path.join(ROOT, 'css/mobile-nav.css'), 'utf8');

    assert.match(index, /<body data-screen="login">/);
    assert.match(mobileNav, /'words'/);
    assert.doesNotMatch(mobileNav, /'wordsMenu'/);
    assert.match(mobileNavStyles, /body\[data-screen="words"\] \.mobile-bottom-nav/);
    assert.match(mobileNavStyles, /body\[data-screen="words"\] #words-menu-settings-btn/);
    assert.doesNotMatch(mobileNavStyles, /data-screen="wordsMenu"/);
});
