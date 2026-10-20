// ============================================
// CONFIGURAÇÃO ESPECIAL PARA MOBILE
// ============================================

const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Em file:// o Firebase Auth pode não funcionar corretamente. Mantém o fallback local já existente.
if (isMobileDevice && window.location.protocol === 'file:') {
    window.enlDebug?.('📱 Mobile detectado em file:// - usando modo guest automático');

    window.forceGuestMode = true;
    window.isGuest = true;
    window.currentUserName = 'Guest';

    window.addEventListener('DOMContentLoaded', () => {
        const authContainer = document.getElementById('auth-container');
        const categoryContainer = document.getElementById('category-container');

        if (authContainer) authContainer.style.display = 'none';
        if (categoryContainer) {
            categoryContainer.style.display = 'block';
            categoryContainer.classList.add('category-home-active');
        }

        document.body.setAttribute('data-screen', 'categories');

        if (typeof updateAllUserNames === 'function') {
            updateAllUserNames('Guest');
        }
    });
}

// ============================================
// FIREBASE CONFIGURAÇÃO
// ============================================

const firebaseEnvironment = window.EnlFirebaseEnvironment.current;
const USE_LOCAL_FIREBASE_EMULATORS = firebaseEnvironment.useLocalEmulators;
window.enlFirebaseEnvironment = firebaseEnvironment.name;
window.document?.body?.setAttribute('data-firebase-environment', firebaseEnvironment.name);
const firebaseConfig = firebaseEnvironment.firebaseConfig;

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
if (USE_LOCAL_FIREBASE_EMULATORS) {
    auth.useEmulator('http://127.0.0.1:9099');
}
const db = firebase.firestore();
if (USE_LOCAL_FIREBASE_EMULATORS) {
    db.useEmulator('127.0.0.1', 8080);
    console.info('Firebase local: Authentication e Firestore estão usando os emuladores locais.');
}
if (firebase.functions) {
    const functions = firebase.functions();
    if (USE_LOCAL_FIREBASE_EMULATORS) functions.useEmulator('127.0.0.1', 5001);
}

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

let currentUser = null;
let isGuest = false;
let currentUserName = "";

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

function updateAllUserNames(name) {
    window.enlDebug?.('🔄 updateAllUserNames chamado com:', name);

    const elements = [
        'user-name-display', 'category-user-name', 'words-user-name',
        'game-user-name', 'vocab-user-name'
    ];

    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = name;
    });

    const infoContainers = [
        'user-info', 'category-user-info', 'words-user-info',
        'game-user-info', 'vocab-user-info'
    ];

    infoContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = name ? 'flex' : 'none';
    });
}

function showAuthScreen(screenName) {
    const screens = [
        'auth-container', 'category-container', 'numbers-menu-container',
        'game-container', 'vocab-game-container', 'words-menu-container'
    ];

    screens.forEach(screen => {
        const el = document.getElementById(screen);
        if (el) {
            el.style.display = 'none';
            if (screen === 'category-container') {
                el.classList.remove('category-home-active');
            }
        }
    });

    const target = document.getElementById(screenName);
    if (target) target.style.display = 'block';

    if (screenName === 'category-container') {
        target?.classList.add('category-home-active');
        const catBtns = document.querySelector('.category-buttons');
        if (catBtns) catBtns.style.display = 'grid';
    }
}

function showLoginScreen() {
    showAuthScreen('auth-container');
    document.body.setAttribute('data-screen', 'login');
}

const passwordResetModule = window.EnglishNextLevelPasswordReset;
if (!passwordResetModule?.create) {
    throw new Error('password-reset.js must load before firebase-config.js');
}
const passwordResetUI = passwordResetModule.create({ document, auth, showLoginScreen });

const verificationModule = window.EnglishNextLevelEmailVerification;
if (!verificationModule?.create) {
    throw new Error('email-verification.js must load before firebase-config.js');
}
const verificationUI = verificationModule.create({
    document,
    auth,
    updateAllUserNames,
    showLoginScreen,
    loadVerifiedUser,
    onVerificationRequired() {
        // Keep unverified accounts out of the rest of the app.
        currentUser = null;
        window.currentUser = null;
        isGuest = false;
        window.isGuest = false;
    }
});

async function loadVerifiedUser(user) {
    verificationUI.setMode(false);

    currentUser = user;
    window.currentUser = user;
    isGuest = false;
    window.isGuest = false;

    try {
        const doc = await db.collection('users').doc(user.uid).get();
        currentUserName = doc.exists && doc.data()?.name
            ? doc.data().name
            : (user.email?.split('@')[0] || 'Student');
    } catch (error) {
        console.warn('Não foi possível carregar o perfil do Firestore:', error);
        currentUserName = user.email?.split('@')[0] || 'Student';
    }

    window.currentUserName = currentUserName;
    updateAllUserNames(currentUserName);

    const authContainer = document.getElementById('auth-container');
    const categoryContainer = document.getElementById('category-container');
    const categoryButtons = document.querySelector('.category-buttons');

    if (authContainer) authContainer.style.display = 'none';
    if (categoryContainer) {
        categoryContainer.style.display = 'block';
        categoryContainer.classList.add('category-home-active');
    }
    if (categoryButtons) categoryButtons.style.display = 'grid';

    document.body.setAttribute('data-screen', 'categories');

    if (typeof updateGameUserName === 'function') updateGameUserName();
}

// ============================================
// FUNÇÕES DE AUTENTICAÇÃO
// ============================================

function login(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

async function register(name, email, password) {
    verificationUI.setRegistrationInProgress(true);

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);

        await db.collection('users').doc(userCredential.user.uid).set({
            name,
            email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        let verificationSent = false;
        let verificationError = null;
        try {
            const result = await verificationUI.sendEmail(userCredential.user);
            verificationSent = result.sent;
            if (verificationSent) verificationUI.markAutoSentThisSession(userCredential.user);
        } catch (error) {
            verificationError = error;
            console.warn('Não foi possível enviar o primeiro e-mail de verificação:', error);
        }

        return { userCredential, verificationSent, verificationError };
    } finally {
        verificationUI.setRegistrationInProgress(false);
    }
}

function logout() {
    return auth.signOut();
}

// ============================================
// ESTADO DE AUTENTICAÇÃO
// ============================================

auth.onAuthStateChanged(async (user) => {
    window.enlDebug?.('Auth state changed:', user ? 'User logged in' : 'No user');

    if (window.forceGuestMode === true) {
        window.enlDebug?.('🔒 forceGuestMode ativo - ignorando onAuthStateChanged');
        return;
    }

    if (isGuest) {
        window.enlDebug?.('Guest mode active, ignoring auth change');
        return;
    }

    const categoryContainer = document.getElementById('category-container');
    if (window.isGuest === true && categoryContainer && categoryContainer.style.display === 'block') {
        return;
    }

    if (!user) {
        currentUser = null;
        window.currentUser = null;
        if (!isGuest && !window.forceGuestMode) {
            verificationUI.setMode(false);
            showLoginScreen();
        }
        return;
    }

    // Contas Email/Password precisam confirmar o endereço antes de acessar o conteúdo salvo.
    if (!user.emailVerified) {
        // Para contas antigas, o primeiro login da sessão envia a verificação automaticamente.
        // Durante um cadastro novo, o próprio fluxo de register() faz o envio para evitar duplicidade.
        await verificationUI.showForExistingAccount(user);
        return;
    }

    await loadVerifiedUser(user);
});

// ============================================
// EVENTOS DA TELA DE LOGIN
// ============================================

function enterGuestMode() {
    window.isGuest = true;
    isGuest = true;
    window.currentUser = null;
    currentUser = null;
    currentUserName = 'Guest';
    window.currentUserName = 'Guest';
    updateAllUserNames('Guest');
}

async function handleLogout() {
    if (isGuest) {
        isGuest = false;
        window.isGuest = false;
        currentUser = null;
        window.currentUser = null;
        verificationUI.setMode(false);
        showLoginScreen();
        return;
    }

    await logout();
    verificationUI.setMode(false);
    showLoginScreen();
}

const authUIModule = window.EnglishNextLevelAuthUI;
if (!authUIModule?.create) {
    throw new Error('auth-ui.js must load before firebase-config.js');
}

const authUI = authUIModule.create({
    document,
    window,
    passwordResetUI,
    verificationUI,
    login,
    register,
    onGuestModeSelected: enterGuestMode,
    onLogout: handleLogout,
    updateGameUserName: () => {
        if (typeof updateGameUserName === 'function') updateGameUserName();
    }
});

document.addEventListener('DOMContentLoaded', () => authUI.initialize());
