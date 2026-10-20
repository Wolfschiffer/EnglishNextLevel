// Email verification UI and account-confirmation flow.

(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelEmailVerification = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    const AUTO_SENT_PREFIX = 'enlVerificationAutoSent:';

    function create(dependencies = {}) {
        const document = dependencies.document || globalThis.document;
        const auth = dependencies.auth;
        const authTabs = dependencies.authTabs;
        const updateAllUserNames = dependencies.updateAllUserNames || (() => {});
        const showLoginScreen = dependencies.showLoginScreen || (() => {});
        const loadVerifiedUser = dependencies.loadVerifiedUser || (async () => {});
        const getSessionStorage = dependencies.getSessionStorage || (() => globalThis.sessionStorage);
        const scheduleInterval = dependencies.setInterval || globalThis.setInterval.bind(globalThis);
        const cancelInterval = dependencies.clearInterval || globalThis.clearInterval.bind(globalThis);
        let resendTimer = null;
        let registrationInProgress = false;
        let initialized = false;
        const automaticSendsInFlight = new Set();

        function setMessage(message = '', type = '') {
            const element = document.getElementById('verification-message');
            if (!element) return;

            element.textContent = message;
            element.classList.remove('is-success', 'is-error');
            if (type === 'success') element.classList.add('is-success');
            if (type === 'error') element.classList.add('is-error');
        }

        function setMode(active, user = null) {
            const panel = document.getElementById('email-verification-panel');
            const resetPanel = document.getElementById('password-reset-panel');
            const tabs = document.querySelector('.auth-tabs');
            const guestOption = document.querySelector('.guest-option');
            const emailLabel = document.getElementById('verification-email');

            if (panel) panel.hidden = !active;
            if (active && resetPanel) resetPanel.hidden = true;
            if (tabs) tabs.style.display = active ? 'none' : '';
            if (guestOption) guestOption.style.display = active ? 'none' : '';

            if (active) {
                authTabs?.setPanelVisibility(false);
                if (emailLabel) emailLabel.textContent = user?.email || '';
                showLoginScreen();
                document.body.setAttribute('data-screen', 'login');
                return;
            }

            authTabs?.setPanelVisibility(true);
            setMessage('');
        }

        function show(user, message = '') {
            // Keep unverified accounts out of the rest of the app.
            dependencies.onVerificationRequired?.(user);
            updateAllUserNames('');
            setMode(true, user);
            if (message) setMessage(message, 'success');
        }

        function getAutoSentKey(user) {
            return `${AUTO_SENT_PREFIX}${user?.uid || 'unknown'}`;
        }

        function wasAutoSentThisSession(user) {
            if (!user?.uid) return false;
            try {
                return getSessionStorage()?.getItem(getAutoSentKey(user)) === '1';
            } catch (_) {
                return false;
            }
        }

        function markAutoSentThisSession(user) {
            if (!user?.uid) return;
            try {
                getSessionStorage()?.setItem(getAutoSentKey(user), '1');
            } catch (_) {
                // Session storage can be unavailable in restricted privacy modes.
            }
        }

        function getSendErrorMessage(error, automatic = false) {
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

        async function sendEmail(user, { automatic = false } = {}) {
            if (!user || user.emailVerified) return { sent: false, skipped: true };

            if (automatic) {
                if (registrationInProgress || wasAutoSentThisSession(user)) {
                    return { sent: false, skipped: true };
                }
                if (automaticSendsInFlight.has(user.uid)) {
                    return { sent: false, skipped: true };
                }
                automaticSendsInFlight.add(user.uid);
            }

            try {
                await user.sendEmailVerification();
                if (automatic) markAutoSentThisSession(user);
                return { sent: true, skipped: false };
            } finally {
                if (automatic) automaticSendsInFlight.delete(user.uid);
            }
        }

        function clearCooldown() {
            if (resendTimer === null) return;
            cancelInterval(resendTimer);
            resendTimer = null;
        }

        function startCooldown(seconds = 30) {
            const button = document.getElementById('verification-resend-btn');
            if (!button) return;

            clearCooldown();
            let remaining = seconds;
            button.disabled = true;
            button.textContent = `Resend available in ${remaining}s`;

            resendTimer = scheduleInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    clearCooldown();
                    button.disabled = false;
                    button.textContent = 'Resend verification email';
                    return;
                }
                button.textContent = `Resend available in ${remaining}s`;
            }, 1000);
        }

        async function showForExistingAccount(user) {
            show(user);

            if (registrationInProgress || wasAutoSentThisSession(user)) return;

            setMessage('Sending verification email...');

            try {
                const result = await sendEmail(user, { automatic: true });
                if (result.sent) {
                    setMessage('Verification email sent. Check your inbox.', 'success');
                    startCooldown(30);
                }
            } catch (error) {
                console.error('Automatic verification email failed:', error);
                setMessage(getSendErrorMessage(error, true), 'error');
            }
        }

        async function checkVerification(button) {
            const user = auth.currentUser;
            if (!user) {
                setMessage('Your session expired. Please log in again.', 'error');
                setMode(false);
                return;
            }

            button.disabled = true;
            button.textContent = 'Checking...';
            setMessage('');

            try {
                await user.reload();
                const refreshedUser = auth.currentUser;

                if (refreshedUser?.emailVerified) {
                    // Refresh the token so callable functions see the updated email_verified claim.
                    await refreshedUser.getIdToken(true);
                    setMessage('Email verified!', 'success');
                    await loadVerifiedUser(refreshedUser);
                } else {
                    setMessage('Not verified yet. Open the link in your email, then try again.', 'error');
                }
            } catch (error) {
                console.error('Verification check failed:', error);
                setMessage('Could not check verification. Please try again.', 'error');
            } finally {
                button.disabled = false;
                button.textContent = "I've verified — Continue";
            }
        }

        async function resendVerification(button) {
            const user = auth.currentUser;
            if (!user) {
                setMessage('Your session expired. Please log in again.', 'error');
                return;
            }

            button.disabled = true;
            button.textContent = 'Sending...';
            setMessage('');

            try {
                await sendEmail(user);
                markAutoSentThisSession(user);
                setMessage('A new verification email was sent.', 'success');
                startCooldown(30);
            } catch (error) {
                console.error('Verification resend failed:', error);
                setMessage(getSendErrorMessage(error, false), 'error');
                button.disabled = false;
                button.textContent = 'Resend verification email';
            }
        }

        async function switchAccount() {
            try {
                await auth.signOut();
            } finally {
                setMode(false);
                authTabs?.select('login', { focus: true });
                showLoginScreen();
            }
        }

        function initialize() {
            if (initialized) return;
            initialized = true;

            const checkButton = document.getElementById('verification-check-btn');
            const resendButton = document.getElementById('verification-resend-btn');
            const otherAccountButton = document.getElementById('verification-other-account-btn');

            checkButton?.addEventListener('click', () => checkVerification(checkButton));
            resendButton?.addEventListener('click', () => resendVerification(resendButton));
            otherAccountButton?.addEventListener('click', switchAccount);
        }

        return Object.freeze({
            clearCooldown,
            getSendErrorMessage,
            initialize,
            markAutoSentThisSession,
            sendEmail,
            setMessage,
            setMode,
            setRegistrationInProgress(value) { registrationInProgress = Boolean(value); },
            show,
            showForExistingAccount,
            startCooldown
        });
    }

    return Object.freeze({ create });
});
