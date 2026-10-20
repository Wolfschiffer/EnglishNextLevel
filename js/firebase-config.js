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

document.addEventListener('DOMContentLoaded', () => {
    window.enlDebug?.('DOM carregado, configurando eventos de login...');

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const guestBtn = document.getElementById('guest-btn');
    const categoryLogoutBtn = document.getElementById('category-logout-btn');
    const wordsLogoutBtn = document.getElementById('words-logout-btn');
    const authContainer = document.getElementById('auth-container');
    const categoryContainer = document.getElementById('category-container');
    const numbersMenu = document.getElementById('numbers-menu-container');
    const gameContainer = document.getElementById('game-container');
    const vocabContainer = document.getElementById('vocab-game-container');
    const wordsMenu = document.getElementById('words-menu-container');

    passwordResetUI.initialize();
    verificationUI.initialize();

    if (authContainer) authContainer.style.display = 'block';
    if (categoryContainer) categoryContainer.style.display = 'none';
    if (numbersMenu) numbersMenu.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'none';
    if (vocabContainer) vocabContainer.style.display = 'none';
    if (wordsMenu) wordsMenu.style.display = 'none';

    if (window.enlFirebaseUnavailable) {
        const authIntro = document.getElementById('auth-intro');
        const authTabs = document.querySelector('.auth-tabs');
        if (authIntro) {
            authIntro.textContent = 'Account services are unavailable. Continue as Guest to practice; progress stays on this device.';
        }
        if (authTabs) authTabs.style.display = 'none';
        if (loginForm) {
            loginForm.classList.remove('active');
            loginForm.style.display = 'none';
        }
        if (registerForm) {
            registerForm.classList.remove('active');
            registerForm.style.display = 'none';
        }
    }

    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (passwordResetUI.isActive()) passwordResetUI.setMode(false);
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const isLogin = tab.dataset.tab === 'login';
            if (loginForm) loginForm.classList.toggle('active', isLogin);
            if (registerForm) registerForm.classList.toggle('active', !isLogin);
        });
    });

    const showMessage = (btn, msg, isError = true, timeout = 4000) => {
        const oldMsg = document.querySelector('.error-message, .success-message');
        if (oldMsg) oldMsg.remove();

        const div = document.createElement('div');
        div.className = isError ? 'error-message' : 'success-message';
        div.textContent = msg;
        div.style.cssText = isError
            ? 'color:#e53e3e;font-size:0.85rem;margin-top:0.5rem;text-align:center'
            : 'color:#18864b;font-size:0.85rem;margin-top:0.5rem;text-align:center';

        btn.parentNode.appendChild(div);
        if (timeout > 0) setTimeout(() => div.remove(), timeout);
    };

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email')?.value;
            const password = document.getElementById('login-password')?.value;

            if (!email?.trim()) return showMessage(loginBtn, 'Please enter your email');
            if (!password?.trim()) return showMessage(loginBtn, 'Please enter your password');

            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';

            try {
                const credential = await login(email.trim(), password);

                document.getElementById('login-email').value = '';
                document.getElementById('login-password').value = '';

                if (!credential.user.emailVerified) {
                    const verificationPanel = document.getElementById('email-verification-panel');
                    if (!verificationPanel || verificationPanel.hidden) {
                        verificationUI.show(credential.user);
                    }
                }
            } catch (error) {
                const messages = {
                    'auth/user-not-found': 'No account found with this email',
                    'auth/wrong-password': 'Incorrect password',
                    'auth/invalid-credential': 'Incorrect email or password',
                    'auth/invalid-login-credentials': 'Incorrect email or password',
                    'auth/invalid-email': 'Invalid email format',
                    'auth/too-many-requests': 'Too many attempts. Please wait and try again.'
                };
                showMessage(loginBtn, messages[error.code] || 'Login failed');
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const name = document.getElementById('register-name')?.value;
            const email = document.getElementById('register-email')?.value;
            const password = document.getElementById('register-password')?.value;

            if (!name?.trim()) return showMessage(registerBtn, 'Please enter your name');
            if (name.trim().length > 50) return showMessage(registerBtn, 'Your name must be 50 characters or fewer');
            if (!email?.trim()) return showMessage(registerBtn, 'Please enter your email');
            if (!password?.trim()) return showMessage(registerBtn, 'Please enter a password');
            if (password.length < 6) return showMessage(registerBtn, 'Password must be at least 6 characters');

            registerBtn.disabled = true;
            registerBtn.textContent = 'Creating account...';

            try {
                const result = await register(name.trim(), email.trim(), password);

                document.getElementById('register-name').value = '';
                document.getElementById('register-email').value = '';
                document.getElementById('register-password').value = '';

                verificationUI.show(
                    result.userCredential.user,
                    result.verificationSent
                        ? 'Verification email sent. Check your inbox.'
                        : verificationUI.getSendErrorMessage(result.verificationError, false)
                );

                if (result.verificationSent) verificationUI.startCooldown(30);
            } catch (error) {
                const messages = {
                    'auth/email-already-in-use': 'Email already registered',
                    'auth/invalid-email': 'Invalid email format',
                    'auth/weak-password': 'Password too weak (min 6 chars)',
                    'auth/operation-not-allowed': 'Email registration is not enabled.'
                };
                showMessage(registerBtn, messages[error.code] || 'Registration failed');
            } finally {
                registerBtn.disabled = false;
                registerBtn.textContent = 'Create account';
            }
        });
    }

    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            window.enlDebug?.('Guest mode selected');
            window.isGuest = true;
            isGuest = true;
            window.currentUser = null;
            currentUser = null;
            currentUserName = 'Guest';
            window.currentUserName = 'Guest';
            updateAllUserNames('Guest');

            const authContainer = document.getElementById('auth-container');
            const categoryContainer = document.getElementById('category-container');

            if (authContainer) authContainer.style.display = 'none';
            if (categoryContainer) {
                categoryContainer.style.display = 'block';
                categoryContainer.classList.add('category-home-active');
            }

            const categoryButtons = document.querySelector('.category-buttons');
            if (categoryButtons) categoryButtons.style.display = 'grid';

            document.body.setAttribute('data-screen', 'categories');
            if (typeof updateGameUserName === 'function') updateGameUserName();
        });
    }

    const handleLogout = () => {
        if (isGuest) {
            isGuest = false;
            window.isGuest = false;
            currentUser = null;
            window.currentUser = null;
            verificationUI.setMode(false);
            showLoginScreen();
        } else {
            logout().finally(() => {
                verificationUI.setMode(false);
                showLoginScreen();
            });
        }
    };

    if (categoryLogoutBtn) categoryLogoutBtn.addEventListener('click', handleLogout);
    if (wordsLogoutBtn) wordsLogoutBtn.addEventListener('click', handleLogout);
});
