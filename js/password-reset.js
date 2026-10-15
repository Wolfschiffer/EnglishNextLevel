// Password reset UI and cooldown for the account screen.

(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelPasswordReset = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    const GENERIC_SUCCESS_MESSAGE =
        'If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.';

    function getErrorMessage(error) {
        const code = error?.code || 'unknown-error';
        const messages = {
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/missing-email': 'Please enter your email address.',
            'auth/too-many-requests': 'Too many reset requests. Wait a little before trying again.',
            'auth/network-request-failed': 'Network error while sending the reset email.',
            'auth/operation-not-allowed': 'Password reset is not enabled for this project.'
        };

        return messages[code] || 'Could not send the reset email. Please try again.';
    }

    function create(dependencies = {}) {
        const document = dependencies.document || globalThis.document;
        const auth = dependencies.auth;
        const showLoginScreen = dependencies.showLoginScreen || (() => {});
        const scheduleTimeout = dependencies.setTimeout || globalThis.setTimeout.bind(globalThis);
        const scheduleInterval = dependencies.setInterval || globalThis.setInterval.bind(globalThis);
        const cancelInterval = dependencies.clearInterval || globalThis.clearInterval.bind(globalThis);
        let cooldownTimer = null;
        let initialized = false;

        function setMessage(message = '', type = '') {
            const element = document.getElementById('password-reset-message');
            if (!element) return;

            element.textContent = message;
            element.classList.remove('is-success', 'is-error');
            if (type === 'success') element.classList.add('is-success');
            if (type === 'error') element.classList.add('is-error');
        }

        function setMode(active) {
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
                return;
            }

            const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
            document.querySelectorAll('.auth-tab').forEach(tab => {
                tab.classList.toggle('active', tab === loginTab);
            });
            loginForm?.classList.add('active');
            registerForm?.classList.remove('active');
            setMessage('');
        }

        function isActive() {
            const panel = document.getElementById('password-reset-panel');
            return Boolean(panel && !panel.hidden);
        }

        function clearCooldown() {
            if (cooldownTimer === null) return;
            cancelInterval(cooldownTimer);
            cooldownTimer = null;
        }

        function resetButton() {
            const button = document.getElementById('password-reset-send-btn');
            if (!button) return;
            button.disabled = false;
            button.textContent = 'Send reset link';
        }

        function startCooldown(seconds = 30) {
            const button = document.getElementById('password-reset-send-btn');
            if (!button) return;

            clearCooldown();
            let remaining = seconds;
            button.disabled = true;
            button.textContent = `Send again in ${remaining}s`;

            cooldownTimer = scheduleInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    clearCooldown();
                    resetButton();
                    return;
                }
                button.textContent = `Send again in ${remaining}s`;
            }, 1000);
        }

        async function sendReset(email) {
            return auth.sendPasswordResetEmail(email);
        }

        function initialize() {
            if (initialized) return;
            initialized = true;

            const forgotPasswordButton = document.getElementById('forgot-password-btn');
            const emailInput = document.getElementById('password-reset-email');
            const sendButton = document.getElementById('password-reset-send-btn');
            const backButton = document.getElementById('password-reset-back-btn');
            const submitReset = async () => {
                if (!sendButton || sendButton.disabled) return;

                const email = emailInput?.value?.trim() || '';
                if (!email) {
                    setMessage('Please enter your email address.', 'error');
                    emailInput?.focus();
                    return;
                }

                sendButton.disabled = true;
                sendButton.textContent = 'Sending...';
                setMessage('');

                try {
                    await sendReset(email);
                    // Keep the response generic to avoid revealing registered addresses.
                    setMessage(GENERIC_SUCCESS_MESSAGE, 'success');
                    startCooldown(30);
                } catch (error) {
                    // Some Firebase projects reveal account status through these errors.
                    if (['auth/user-not-found', 'auth/user-disabled'].includes(error?.code)) {
                        setMessage(GENERIC_SUCCESS_MESSAGE, 'success');
                        startCooldown(30);
                    } else {
                        console.error('Password reset failed:', error);
                        setMessage(getErrorMessage(error), 'error');
                        resetButton();
                    }
                }
            };

            forgotPasswordButton?.addEventListener('click', () => {
                const loginEmail = document.getElementById('login-email')?.value?.trim() || '';
                if (emailInput) emailInput.value = loginEmail;
                setMessage('');
                setMode(true);
                scheduleTimeout(() => emailInput?.focus(), 0);
            });

            backButton?.addEventListener('click', () => {
                clearCooldown();
                resetButton();
                setMode(false);
                document.getElementById('login-email')?.focus();
            });

            sendButton?.addEventListener('click', submitReset);

            emailInput?.addEventListener('keydown', async (event) => {
                if (event.key !== 'Enter' || sendButton?.disabled) return;
                event.preventDefault();
                await submitReset();
            });
        }

        return Object.freeze({
            clearCooldown,
            initialize,
            isActive,
            setMessage,
            setMode,
            startCooldown
        });
    }

    return Object.freeze({ create, getErrorMessage });
});
