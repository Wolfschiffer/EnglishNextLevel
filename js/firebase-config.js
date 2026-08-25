// ============================================
// CONFIGURAÇÃO ESPECIAL PARA MOBILE
// ============================================

const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Em file:// o Firebase Auth pode não funcionar corretamente. Mantém o fallback local já existente.
if (isMobileDevice && window.location.protocol === 'file:') {
    console.log('📱 Mobile detectado em file:// - usando modo guest automático');

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

const firebaseConfig = {
    apiKey: "AIzaSyCkEdRxvECKNmVcMfqDE4jTE_qoNXF7p5c",
    authDomain: "english-next-level-game.firebaseapp.com",
    projectId: "english-next-level-game",
    storageBucket: "english-next-level-game.firebasestorage.app",
    messagingSenderId: "422019063374",
    appId: "1:422019063374:web:b55130f33775f7e1b0ad1f"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

let currentUser = null;
let isGuest = false;
let currentUserName = "";
let verificationResendTimer = null;
let passwordResetTimer = null;
let registrationInProgress = false;
const verificationAutoSendInFlight = new Set();
const VERIFICATION_AUTO_SENT_PREFIX = 'enlVerificationAutoSent:';

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

function updateAllUserNames(name) {
    console.log('🔄 updateAllUserNames chamado com:', name);

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

function showScreen(screenName) {
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
    showScreen('auth-container');
}

function showCategoryScreen() {
    showScreen('category-container');
}

window.showCategoryScreen = showCategoryScreen;

function setVerificationMessage(message = '', type = '') {
    const el = document.getElementById('verification-message');
    if (!el) return;

    el.textContent = message;
    el.classList.remove('is-success', 'is-error');
    if (type === 'success') el.classList.add('is-success');
    if (type === 'error') el.classList.add('is-error');
}

function setVerificationMode(active, user = null) {
    const panel = document.getElementById('email-verification-panel');
    const resetPanel = document.getElementById('password-reset-panel');
    const tabs = document.querySelector('.auth-tabs');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const guestOption = document.querySelector('.guest-option');
    const emailLabel = document.getElementById('verification-email');

    if (panel) panel.hidden = !active;
    if (active && resetPanel) resetPanel.hidden = true;
    if (tabs) tabs.style.display = active ? 'none' : '';
    if (guestOption) guestOption.style.display = active ? 'none' : '';

    if (active) {
        loginForm?.classList.remove('active');
        registerForm?.classList.remove('active');
        if (emailLabel) emailLabel.textContent = user?.email || '';
        showLoginScreen();
        document.body.setAttribute('data-screen', 'login');
    } else {
        const activeTab = document.querySelector('.auth-tab.active')?.dataset.tab || 'login';
        loginForm?.classList.toggle('active', activeTab === 'login');
        registerForm?.classList.toggle('active', activeTab === 'register');
        setVerificationMessage('');
    }
}

function showVerificationScreen(user, message = '') {
    // Não expõe o usuário ao restante do jogo enquanto o e-mail não estiver confirmado.
    currentUser = null;
    window.currentUser = null;
    isGuest = false;
    window.isGuest = false;
    updateAllUserNames('');

    setVerificationMode(true, user);
    if (message) setVerificationMessage(message, 'success');
}

function getVerificationAutoSentKey(user) {
    return `${VERIFICATION_AUTO_SENT_PREFIX}${user?.uid || 'unknown'}`;
}

function wasVerificationAutoSentThisSession(user) {
    if (!user?.uid) return false;
    try {
        return sessionStorage.getItem(getVerificationAutoSentKey(user)) === '1';
    } catch (_) {
        return false;
    }
}

function markVerificationAutoSentThisSession(user) {
    if (!user?.uid) return;
    try {
        sessionStorage.setItem(getVerificationAutoSentKey(user), '1');
    } catch (_) {
        // sessionStorage pode estar indisponível em modos de privacidade restritos.
    }
}

function getVerificationSendErrorMessage(error, automatic = false) {
    const code = error?.code || 'unknown-error';
    const messages = {
        'auth/too-many-requests': 'Too many verification requests. Wait a little before trying again.',
        'auth/network-request-failed': 'Network error while sending the verification email.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/unauthorized-continue-uri': 'The verification link domain is not authorized in Firebase.',
        'auth/invalid-continue-uri': 'The verification link configuration is invalid.',
        'auth/missing-continue-uri': 'The verification link configuration is incomplete.'
    };

    const base = messages[code] || (automatic
        ? 'We could not send the verification email automatically.'
        : 'Could not resend the verification email. Please try again.');

    return `${base} (${code})`;
}

async function sendVerificationEmail(user, { automatic = false } = {}) {
    if (!user || user.emailVerified) return { sent: false, skipped: true };

    if (automatic) {
        if (registrationInProgress || wasVerificationAutoSentThisSession(user)) {
            return { sent: false, skipped: true };
        }
        if (verificationAutoSendInFlight.has(user.uid)) {
            return { sent: false, skipped: true };
        }
        verificationAutoSendInFlight.add(user.uid);
    }

    try {
        await user.sendEmailVerification();
        if (automatic) markVerificationAutoSentThisSession(user);
        return { sent: true, skipped: false };
    } finally {
        if (automatic) verificationAutoSendInFlight.delete(user.uid);
    }
}

async function showVerificationForExistingAccount(user) {
    showVerificationScreen(user);

    if (registrationInProgress || wasVerificationAutoSentThisSession(user)) {
        return;
    }

    setVerificationMessage('Sending verification email...', '');

    try {
        const result = await sendVerificationEmail(user, { automatic: true });
        if (result.sent) {
            setVerificationMessage('Verification email sent. Check your inbox.', 'success');
            startVerificationResendCooldown(30);
        }
    } catch (error) {
        console.error('Automatic verification email failed:', error);
        setVerificationMessage(getVerificationSendErrorMessage(error, true), 'error');
    }
}

function setPasswordResetMessage(message = '', type = '') {
    const el = document.getElementById('password-reset-message');
    if (!el) return;

    el.textContent = message;
    el.classList.remove('is-success', 'is-error');
    if (type === 'success') el.classList.add('is-success');
    if (type === 'error') el.classList.add('is-error');
}

function setPasswordResetMode(active) {
    const panel = document.getElementById('password-reset-panel');
    const verificationPanel = document.getElementById('email-verification-panel');
    const tabs = document.querySelector('.auth-tabs');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const guestOption = document.querySelector('.guest-option');

    if (panel) panel.hidden = !active;
    if (active && verificationPanel) verificationPanel.hidden = true;
    if (tabs) tabs.style.display = active ? 'none' : '';
    if (guestOption) guestOption.style.display = active ? 'none' : '';

    if (active) {
        loginForm?.classList.remove('active');
        registerForm?.classList.remove('active');
        showLoginScreen();
        document.body.setAttribute('data-screen', 'login');
    } else {
        const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab === loginTab);
        });
        loginForm?.classList.add('active');
        registerForm?.classList.remove('active');
        setPasswordResetMessage('');
    }
}

function getPasswordResetErrorMessage(error) {
    const code = error?.code || 'unknown-error';
    const messages = {
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/missing-email': 'Please enter your email address.',
        'auth/too-many-requests': 'Too many reset requests. Wait a little before trying again.',
        'auth/network-request-failed': 'Network error while sending the reset email.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/operation-not-allowed': 'Password reset is not enabled for this project.'
    };
    return messages[code] || 'Could not send the reset email. Please try again.';
}

async function sendPasswordReset(email) {
    return auth.sendPasswordResetEmail(email);
}

function startPasswordResetCooldown(seconds = 30) {
    const btn = document.getElementById('password-reset-send-btn');
    if (!btn) return;

    if (passwordResetTimer) clearInterval(passwordResetTimer);

    let remaining = seconds;
    btn.disabled = true;
    btn.textContent = `Send again in ${remaining}s`;

    passwordResetTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(passwordResetTimer);
            passwordResetTimer = null;
            btn.disabled = false;
            btn.textContent = 'Send reset link';
            return;
        }
        btn.textContent = `Send again in ${remaining}s`;
    }, 1000);
}

function startVerificationResendCooldown(seconds = 30) {
    const btn = document.getElementById('verification-resend-btn');
    if (!btn) return;

    if (verificationResendTimer) clearInterval(verificationResendTimer);

    let remaining = seconds;
    btn.disabled = true;
    btn.textContent = `Resend available in ${remaining}s`;

    verificationResendTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(verificationResendTimer);
            verificationResendTimer = null;
            btn.disabled = false;
            btn.textContent = 'Resend verification email';
            return;
        }
        btn.textContent = `Resend available in ${remaining}s`;
    }, 1000);
}

async function loadVerifiedUser(user) {
    setVerificationMode(false);

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
    registrationInProgress = true;

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
            const result = await sendVerificationEmail(userCredential.user);
            verificationSent = result.sent;
            if (verificationSent) markVerificationAutoSentThisSession(userCredential.user);
        } catch (error) {
            verificationError = error;
            console.warn('Não foi possível enviar o primeiro e-mail de verificação:', error);
        }

        return { userCredential, verificationSent, verificationError };
    } finally {
        registrationInProgress = false;
    }
}

function logout() {
    return auth.signOut();
}

// ============================================
// ESTADO DE AUTENTICAÇÃO
// ============================================

auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');

    if (window.forceGuestMode === true) {
        console.log('🔒 forceGuestMode ativo - ignorando onAuthStateChanged');
        return;
    }

    if (isGuest) {
        console.log('Guest mode active, ignoring auth change');
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
            setVerificationMode(false);
            showLoginScreen();
        }
        return;
    }

    // Contas Email/Password precisam confirmar o endereço antes de acessar o conteúdo salvo.
    if (!user.emailVerified) {
        // Para contas antigas, o primeiro login da sessão envia a verificação automaticamente.
        // Durante um cadastro novo, o próprio fluxo de register() faz o envio para evitar duplicidade.
        await showVerificationForExistingAccount(user);
        return;
    }

    await loadVerifiedUser(user);
});

// ============================================
// EVENTOS DA TELA DE LOGIN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, configurando eventos de login...');

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    const passwordResetPanel = document.getElementById('password-reset-panel');
    const passwordResetEmail = document.getElementById('password-reset-email');
    const passwordResetSendBtn = document.getElementById('password-reset-send-btn');
    const passwordResetBackBtn = document.getElementById('password-reset-back-btn');
    const guestBtn = document.getElementById('guest-btn');
    const verificationCheckBtn = document.getElementById('verification-check-btn');
    const verificationResendBtn = document.getElementById('verification-resend-btn');
    const verificationOtherAccountBtn = document.getElementById('verification-other-account-btn');
    const categoryLogoutBtn = document.getElementById('category-logout-btn');
    const wordsLogoutBtn = document.getElementById('words-logout-btn');
    const authContainer = document.getElementById('auth-container');
    const categoryContainer = document.getElementById('category-container');
    const numbersMenu = document.getElementById('numbers-menu-container');
    const gameContainer = document.getElementById('game-container');
    const vocabContainer = document.getElementById('vocab-game-container');
    const wordsMenu = document.getElementById('words-menu-container');

    if (authContainer) authContainer.style.display = 'block';
    if (categoryContainer) categoryContainer.style.display = 'none';
    if (numbersMenu) numbersMenu.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'none';
    if (vocabContainer) vocabContainer.style.display = 'none';
    if (wordsMenu) wordsMenu.style.display = 'none';

    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (passwordResetPanel && !passwordResetPanel.hidden) setPasswordResetMode(false);
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

    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', () => {
            const loginEmailValue = document.getElementById('login-email')?.value?.trim() || '';
            if (passwordResetEmail) passwordResetEmail.value = loginEmailValue;
            setPasswordResetMessage('');
            setPasswordResetMode(true);
            setTimeout(() => passwordResetEmail?.focus(), 0);
        });
    }

    if (passwordResetBackBtn) {
        passwordResetBackBtn.addEventListener('click', () => {
            if (passwordResetTimer) {
                clearInterval(passwordResetTimer);
                passwordResetTimer = null;
            }
            if (passwordResetSendBtn) {
                passwordResetSendBtn.disabled = false;
                passwordResetSendBtn.textContent = 'Send reset link';
            }
            setPasswordResetMode(false);
            document.getElementById('login-email')?.focus();
        });
    }

    if (passwordResetSendBtn) {
        passwordResetSendBtn.addEventListener('click', async () => {
            const email = passwordResetEmail?.value?.trim() || '';
            if (!email) {
                setPasswordResetMessage('Please enter your email address.', 'error');
                passwordResetEmail?.focus();
                return;
            }

            passwordResetSendBtn.disabled = true;
            passwordResetSendBtn.textContent = 'Sending...';
            setPasswordResetMessage('');

            try {
                await sendPasswordReset(email);
                // Mensagem propositalmente genérica: não revela se um endereço está ou não cadastrado.
                setPasswordResetMessage(
                    'If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.',
                    'success'
                );
                startPasswordResetCooldown(30);
            } catch (error) {
                // Com Email Enumeration Protection, Firebase pode ocultar user-not-found.
                // Caso um projeto antigo ainda retorne esse código, mantemos a mesma resposta genérica.
                if (error?.code === 'auth/user-not-found') {
                    setPasswordResetMessage(
                        'If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.',
                        'success'
                    );
                    startPasswordResetCooldown(30);
                } else {
                    console.error('Password reset failed:', error);
                    setPasswordResetMessage(getPasswordResetErrorMessage(error), 'error');
                    passwordResetSendBtn.disabled = false;
                    passwordResetSendBtn.textContent = 'Send reset link';
                }
            }
        });

        passwordResetEmail?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !passwordResetSendBtn.disabled) {
                event.preventDefault();
                passwordResetSendBtn.click();
            }
        });
    }

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
                        showVerificationScreen(credential.user);
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

                showVerificationScreen(
                    result.userCredential.user,
                    result.verificationSent
                        ? 'Verification email sent. Check your inbox.'
                        : getVerificationSendErrorMessage(result.verificationError, false)
                );

                if (result.verificationSent) startVerificationResendCooldown(30);
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

    if (verificationCheckBtn) {
        verificationCheckBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) {
                setVerificationMessage('Your session expired. Please log in again.', 'error');
                setVerificationMode(false);
                return;
            }

            verificationCheckBtn.disabled = true;
            verificationCheckBtn.textContent = 'Checking...';
            setVerificationMessage('');

            try {
                await user.reload();
                const refreshedUser = auth.currentUser;

                if (refreshedUser?.emailVerified) {
                    setVerificationMessage('Email verified!', 'success');
                    await loadVerifiedUser(refreshedUser);
                } else {
                    setVerificationMessage('Not verified yet. Open the link in your email, then try again.', 'error');
                }
            } catch (error) {
                console.error('Verification check failed:', error);
                setVerificationMessage('Could not check verification. Please try again.', 'error');
            } finally {
                verificationCheckBtn.disabled = false;
                verificationCheckBtn.textContent = "I've verified — Continue";
            }
        });
    }

    if (verificationResendBtn) {
        verificationResendBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) {
                setVerificationMessage('Your session expired. Please log in again.', 'error');
                return;
            }

            verificationResendBtn.disabled = true;
            verificationResendBtn.textContent = 'Sending...';
            setVerificationMessage('');

            try {
                await sendVerificationEmail(user);
                markVerificationAutoSentThisSession(user);
                setVerificationMessage('A new verification email was sent.', 'success');
                startVerificationResendCooldown(30);
            } catch (error) {
                console.error('Verification resend failed:', error);
                setVerificationMessage(getVerificationSendErrorMessage(error, false), 'error');
                verificationResendBtn.disabled = false;
                verificationResendBtn.textContent = 'Resend verification email';
            }
        });
    }

    if (verificationOtherAccountBtn) {
        verificationOtherAccountBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
            } finally {
                setVerificationMode(false);
                const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
                tabs.forEach(t => t.classList.toggle('active', t === loginTab));
                loginForm?.classList.add('active');
                registerForm?.classList.remove('active');
                showLoginScreen();
            }
        });
    }

    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            console.log('Guest mode selected');
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
            setVerificationMode(false);
            showLoginScreen();
        } else {
            logout().finally(() => {
                setVerificationMode(false);
                showLoginScreen();
            });
        }
    };

    if (categoryLogoutBtn) categoryLogoutBtn.addEventListener('click', handleLogout);
    if (wordsLogoutBtn) wordsLogoutBtn.addEventListener('click', handleLogout);
});
