(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelAuthUI = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    function create(dependencies = {}) {
        const document = dependencies.document || globalThis.document;
        const window = dependencies.window || globalThis.window || globalThis;
        const passwordResetUI = dependencies.passwordResetUI;
        const verificationUI = dependencies.verificationUI;
        const authTabsController = dependencies.authTabs;
        const login = dependencies.login;
        const register = dependencies.register;
        const onGuestModeSelected = dependencies.onGuestModeSelected || (() => {});
        const onLogout = dependencies.onLogout || (() => {});
        const updateGameUserName = dependencies.updateGameUserName || (() => {});
        const scheduleTimeout = dependencies.setTimeout || globalThis.setTimeout.bind(globalThis);
        let initialized = false;

        function showMessage(button, message, isError = true, timeout = 4000) {
            const previousMessage = document.querySelector('.error-message, .success-message');
            if (previousMessage) previousMessage.remove();

            const element = document.createElement('div');
            element.className = isError ? 'error-message' : 'success-message';
            element.textContent = message;
            element.style.cssText = isError
                ? 'color:#e53e3e;font-size:0.85rem;margin-top:0.5rem;text-align:center'
                : 'color:#18864b;font-size:0.85rem;margin-top:0.5rem;text-align:center';

            button.parentNode.appendChild(element);
            if (timeout > 0) scheduleTimeout(() => element.remove(), timeout);
        }

        async function handleLogout(button) {
            try {
                await onLogout();
            } catch (error) {
                window.enlDebug?.('Sign out failed:', error);
                showMessage(button, 'Could not sign out. Please try again.');
            }
        }

        function initialize() {
            if (initialized) return;
            initialized = true;

            window.enlDebug?.('DOM carregado, configurando eventos de login...');

            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const loginButton = document.getElementById('login-btn');
            const registerButton = document.getElementById('register-btn');
            const guestButton = document.getElementById('guest-btn');
            const categoryLogoutButton = document.getElementById('category-logout-btn');
            const wordsLogoutButton = document.getElementById('words-logout-btn');
            const authContainer = document.getElementById('auth-container');
            const categoryContainer = document.getElementById('category-container');

            passwordResetUI.initialize();
            verificationUI.initialize();
            authTabsController?.initialize(() => {
                if (passwordResetUI.isActive()) passwordResetUI.setMode(false);
            });

            for (const id of [
                'numbers-menu-container', 'game-container', 'vocab-game-container', 'words-menu-container'
            ]) {
                const element = document.getElementById(id);
                if (element) element.style.display = 'none';
            }

            if (authContainer) authContainer.style.display = 'block';
            if (categoryContainer) categoryContainer.style.display = 'none';

            if (window.enlFirebaseUnavailable) {
                const authIntro = document.getElementById('auth-intro');
                const authTabList = document.querySelector('.auth-tabs');
                if (authIntro) {
                    authIntro.textContent = 'Account services are unavailable. Continue as Guest to practice; progress stays on this device.';
                }
                if (authTabList) authTabList.style.display = 'none';
                authTabsController?.setPanelVisibility(false);
                if (loginForm) {
                    loginForm.style.display = 'none';
                }
                if (registerForm) {
                    registerForm.style.display = 'none';
                }
            }

            if (loginButton) {
                loginButton.addEventListener('click', async () => {
                    const email = document.getElementById('login-email')?.value;
                    const password = document.getElementById('login-password')?.value;

                    if (!email?.trim()) return showMessage(loginButton, 'Please enter your email');
                    if (!password?.trim()) return showMessage(loginButton, 'Please enter your password');

                    loginButton.disabled = true;
                    loginButton.textContent = 'Logging in...';

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
                        showMessage(loginButton, messages[error.code] || 'Login failed');
                    } finally {
                        loginButton.disabled = false;
                        loginButton.textContent = 'Login';
                    }
                });
            }

            if (registerButton) {
                registerButton.addEventListener('click', async () => {
                    const name = document.getElementById('register-name')?.value;
                    const email = document.getElementById('register-email')?.value;
                    const password = document.getElementById('register-password')?.value;

                    if (!name?.trim()) return showMessage(registerButton, 'Please enter your name');
                    if (name.trim().length > 50) return showMessage(registerButton, 'Your name must be 50 characters or fewer');
                    if (!email?.trim()) return showMessage(registerButton, 'Please enter your email');
                    if (!password?.trim()) return showMessage(registerButton, 'Please enter a password');
                    if (password.length < 6) return showMessage(registerButton, 'Password must be at least 6 characters');

                    registerButton.disabled = true;
                    registerButton.textContent = 'Creating account...';

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
                        showMessage(registerButton, messages[error.code] || 'Registration failed');
                    } finally {
                        registerButton.disabled = false;
                        registerButton.textContent = 'Create account';
                    }
                });
            }

            if (guestButton) {
                guestButton.addEventListener('click', () => {
                    window.enlDebug?.('Guest mode selected');
                    onGuestModeSelected();

                    if (authContainer) authContainer.style.display = 'none';
                    if (categoryContainer) {
                        categoryContainer.style.display = 'block';
                        categoryContainer.classList.add('category-home-active');
                    }

                    const categoryButtons = document.querySelector('.category-buttons');
                    if (categoryButtons) categoryButtons.style.display = 'grid';

                    document.body.setAttribute('data-screen', 'categories');
                    updateGameUserName();
                });
            }

            if (categoryLogoutButton) {
                categoryLogoutButton.addEventListener('click', () => handleLogout(categoryLogoutButton));
            }
            if (wordsLogoutButton) {
                wordsLogoutButton.addEventListener('click', () => handleLogout(wordsLogoutButton));
            }
        }

        return { initialize };
    }

    return { create };
});
