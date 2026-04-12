// ============================================
// CONFIGURAÇÃO ESPECIAL PARA MOBILE
// ============================================

// Detecta se é mobile
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Força modo guest em mobile se houver erro (fallback)
if (isMobileDevice && window.location.protocol === 'file:') {
    console.log('📱 Mobile detectado em file:// - usando modo guest automático');
    
    window.forceGuestMode = true;
    window.isGuest = true;
    window.currentUserName = 'Guest';
    
    window.addEventListener('DOMContentLoaded', () => {
        // FORÇA REMOÇÃO DO LOGIN
        const authContainer = document.getElementById('auth-container');
        const categoryContainer = document.getElementById('category-container');
        
        if (authContainer) {
            authContainer.style.display = 'none';
        }
        
        if (categoryContainer) {
            categoryContainer.style.display = 'block';
        }
        
        // FORÇA O DATA-SCREEN NO BODY PARA O CSS FUNCIONAR
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

// Elementos DOM (inicializados no DOMContentLoaded)
let domElements = {};

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
        if (el) {
            el.textContent = name;
            console.log(`✅ Atualizado: ${id} = ${name}`);
        }
    });
    
    const infoContainers = [
        'user-info', 'category-user-info', 'words-user-info',
        'game-user-info', 'vocab-user-info'
    ];
    
    infoContainers.forEach(id => {
        const el = document.getElementById(id);
        if (el && name) {
            el.style.display = 'flex';
            console.log(`✅ Container visível: ${id}`);
        } else if (el && !name) {
            el.style.display = 'none';
        }
    });
}

function showScreen(screenName) {
    const screens = [
        'auth-container', 'category-container', 'numbers-menu-container',
        'game-container', 'vocab-game-container', 'words-menu-container'
    ];
    
    screens.forEach(screen => {
        const el = document.getElementById(screen);
        if (el) el.style.display = 'none';
    });
    
    const target = document.getElementById(screenName);
    if (target) target.style.display = 'block';
    
    if (screenName === 'category-container') {
        const catBtns = document.querySelector('.category-buttons');
        if (catBtns) catBtns.style.display = 'flex';
    }
}

function showLoginScreen() {
    showScreen('auth-container');
}

function showCategoryScreen() {
    showScreen('category-container');
}

window.showCategoryScreen = showCategoryScreen;

// ============================================
// FUNÇÕES DE AUTENTICAÇÃO
// ============================================

function login(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

function register(name, email, password) {
    return auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            return db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
}

function logout() {
    return auth.signOut();
}

// ============================================
// EVENTOS DE AUTENTICAÇÃO
// ============================================

// ============================================
// EVENTOS DE AUTENTICAÇÃO
// ============================================

auth.onAuthStateChanged((user) => {
    console.log("Auth state changed:", user ? "User logged in" : "No user");
    
    // 🔥 Se for modo guest forçado (mobile local), ignora completamente
    if (window.forceGuestMode === true) {
        console.log("🔒 forceGuestMode ativo - ignorando onAuthStateChanged");
        return;
    }
    
    if (isGuest) {
        console.log("Guest mode active, ignoring auth change");
        return;
    }
    
    // 🔥 Se já está na tela de categorias como guest, não faz nada
    const categoryContainer = document.getElementById('category-container');
    if (window.isGuest === true && categoryContainer && categoryContainer.style.display === 'block') {
        console.log("👤 Guest já logado, mantendo tela atual");
        return;
    }
    
    if (user) {
        currentUser = user;
        window.currentUser = user;
        isGuest = false;
        window.isGuest = false;
        
        db.collection('users').doc(user.uid).get()
            .then((doc) => {
                if (doc.exists) {
                    currentUserName = doc.data().name;
                    window.currentUserName = currentUserName;
                    console.log('📛 Nome do Firestore:', currentUserName);
                    updateAllUserNames(currentUserName);
                } else {
                    currentUserName = user.email.split('@')[0];
                    window.currentUserName = currentUserName;
                    console.log('📛 Nome do email (fallback):', currentUserName);
                    updateAllUserNames(currentUserName);
                }
                
                const authContainer = document.getElementById('auth-container');
                const categoryContainer = document.getElementById('category-container');
                const categoryButtons = document.querySelector('.category-buttons');
                
                if (authContainer) authContainer.style.display = 'none';
                if (categoryContainer) categoryContainer.style.display = 'block';
                if (categoryButtons) categoryButtons.style.display = 'flex';
                
                if (typeof updateGameUserName === 'function') updateGameUserName();
            })
            .catch(() => {
                currentUserName = user.email.split('@')[0];
                window.currentUserName = currentUserName;
                updateAllUserNames(currentUserName);
                
                const authContainer = document.getElementById('auth-container');
                const categoryContainer = document.getElementById('category-container');
                const categoryButtons = document.querySelector('.category-buttons');
                
                if (authContainer) authContainer.style.display = 'none';
                if (categoryContainer) categoryContainer.style.display = 'block';
                if (categoryButtons) categoryButtons.style.display = 'flex';
                
                if (typeof updateGameUserName === 'function') updateGameUserName();
            });
    } else {
        if (!isGuest && !window.forceGuestMode) {
            currentUser = null;
            showLoginScreen();
        }
    }
});

// ============================================
// INICIALIZAR EVENTOS DA TELA DE LOGIN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM carregado, configurando eventos de login...");
    
    // Elementos do DOM
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

if (authContainer) authContainer.style.display = 'block';
if (categoryContainer) categoryContainer.style.display = 'none';
if (numbersMenu) numbersMenu.style.display = 'none';
if (gameContainer) gameContainer.style.display = 'none';
if (vocabContainer) vocabContainer.style.display = 'none';
if (wordsMenu) wordsMenu.style.display = 'none';
    
    // Tabs
    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const isLogin = tab.dataset.tab === 'login';
            if (loginForm) loginForm.classList.toggle('active', isLogin);
            if (registerForm) registerForm.classList.toggle('active', !isLogin);
        });
    });
    
    // Helper para mostrar erros
    const showMessage = (btn, msg, isError = true) => {
        const oldMsg = document.querySelector('.error-message, .success-message');
        if (oldMsg) oldMsg.remove();
        
        const div = document.createElement('div');
        div.className = isError ? 'error-message' : 'success-message';
        div.textContent = msg;
        div.style.cssText = isError 
            ? 'color:#e53e3e;font-size:0.85rem;margin-top:0.5rem;text-align:center'
            : 'color:#22c55e;font-size:0.85rem;margin-top:0.5rem;text-align:center';
        
        btn.parentNode.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    };
    
    // Botão Login
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('login-email')?.value;
            const password = document.getElementById('login-password')?.value;
            
            if (!email?.trim()) return showMessage(loginBtn, "Please enter your email");
            if (!password?.trim()) return showMessage(loginBtn, "Please enter your password");
            
            loginBtn.disabled = true;
            loginBtn.textContent = "Logging in...";
            
            login(email, password)
                .then(() => {
                    document.getElementById('login-email').value = "";
                    document.getElementById('login-password').value = "";
                })
                .catch((error) => {
                    const messages = {
                        'auth/user-not-found': "No account found with this email",
                        'auth/wrong-password': "Incorrect password",
                        'auth/invalid-email': "Invalid email format"
                    };
                    showMessage(loginBtn, messages[error.code] || "Login failed");
                })
                .finally(() => {
                    loginBtn.disabled = false;
                    loginBtn.textContent = "Login";
                });
        });
    }
    
    // Botão Registro
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            const name = document.getElementById('register-name')?.value;
            const email = document.getElementById('register-email')?.value;
            const password = document.getElementById('register-password')?.value;
            
            if (!name?.trim()) return showMessage(registerBtn, "Please enter your name");
            if (!email?.trim()) return showMessage(registerBtn, "Please enter your email");
            if (!password?.trim()) return showMessage(registerBtn, "Please enter a password");
            if (password.length < 6) return showMessage(registerBtn, "Password must be at least 6 characters");
            
            registerBtn.disabled = true;
            registerBtn.textContent = "Registering...";
            
            register(name, email, password)
                .then(() => {
                    showMessage(registerBtn, "Account created! Logging in...", false);
                    document.getElementById('register-name').value = "";
                    document.getElementById('register-email').value = "";
                    document.getElementById('register-password').value = "";
                })
                .catch((error) => {
                    const messages = {
                        'auth/email-already-in-use': "Email already registered",
                        'auth/invalid-email': "Invalid email format",
                        'auth/weak-password': "Password too weak (min 6 chars)"
                    };
                    showMessage(registerBtn, messages[error.code] || "Registration failed");
                })
                .finally(() => {
                    registerBtn.disabled = false;
                    registerBtn.textContent = "Register";
                });
        });
    }
    
    // Botão Guest
if (guestBtn) {
    guestBtn.addEventListener('click', () => {
        console.log("Guest mode selected");
        window.isGuest = true;
        window.currentUser = null;
        currentUserName = "Guest";
        updateAllUserNames("Guest");
        
        // Forçar a exibição da tela de categorias
        const authContainer = document.getElementById('auth-container');
        const categoryContainer = document.getElementById('category-container');
        
        if (authContainer) authContainer.style.display = 'none';
        if (categoryContainer) {
            categoryContainer.style.display = 'block';
            console.log('✅ Tela de categorias exibida como guest');
        }
        
        const categoryButtons = document.querySelector('.category-buttons');
        if (categoryButtons) categoryButtons.style.display = 'flex';
        
        if (typeof updateGameUserName === 'function') updateGameUserName();
    });
}


    
    // Logout
    const handleLogout = () => {
        if (isGuest) {
            isGuest = false;
            currentUser = null;
            showLoginScreen();
        } else {
            logout().finally(() => showLoginScreen());
        }
    };
    
    if (categoryLogoutBtn) categoryLogoutBtn.addEventListener('click', handleLogout);
    if (wordsLogoutBtn) wordsLogoutBtn.addEventListener('click', handleLogout);
});