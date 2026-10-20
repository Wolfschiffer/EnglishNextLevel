const test = require('node:test');
const assert = require('node:assert/strict');
const verification = require('../js/email-verification.js');
const authTabsModule = require('../js/auth-tabs.js');

function createClassList(initial = []) {
    const values = new Set(initial);
    return {
        add(value) { values.add(value); },
        remove(value) { values.delete(value); },
        toggle(value, force) {
            const enabled = force === undefined ? !values.has(value) : Boolean(force);
            if (enabled) values.add(value);
            else values.delete(value);
            return enabled;
        },
        contains(value) { return values.has(value); }
    };
}

function createElement(properties = {}) {
    const listeners = new Map();
    const attributes = new Map();
    return {
        hidden: false,
        disabled: false,
        textContent: '',
        style: {},
        classList: createClassList(),
        dataset: {},
        addEventListener(name, callback) {
            const callbacks = listeners.get(name) || [];
            callbacks.push(callback);
            listeners.set(name, callbacks);
        },
        async dispatch(name, event = {}) {
            for (const callback of listeners.get(name) || []) await callback(event);
        },
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        focus() { this.focused = true; },
        ...properties
    };
}

function createHarness(authOverrides = {}) {
    const elements = {
        'email-verification-panel': createElement({ hidden: true }),
        'password-reset-panel': createElement({ hidden: false }),
        'verification-email': createElement(),
        'verification-message': createElement(),
        'verification-check-btn': createElement({ textContent: "I've verified — Continue" }),
        'verification-resend-btn': createElement({ textContent: 'Resend verification email' }),
        'verification-other-account-btn': createElement(),
        'login-form': createElement({ classList: createClassList(['active']) }),
        'register-form': createElement({ classList: createClassList() })
    };
    const loginTab = createElement({ classList: createClassList(['active']), dataset: { tab: 'login' }, tabIndex: 0 });
    const registerTab = createElement({ classList: createClassList(), dataset: { tab: 'register' }, tabIndex: -1 });
    loginTab.setAttribute('aria-controls', 'login-form');
    loginTab.setAttribute('aria-selected', 'true');
    registerTab.setAttribute('aria-controls', 'register-form');
    registerTab.setAttribute('aria-selected', 'false');
    const authTabs = createElement({ style: { display: '' } });
    const guestOption = createElement({ style: { display: '' } });
    const attributes = new Map();
    const sessionData = new Map();
    const intervals = [];
    const clearedIntervals = [];
    let loginScreenCalls = 0;
    let verifiedUsers = [];
    let verificationRequiredUsers = [];
    const document = {
        body: { setAttribute(name, value) { attributes.set(name, value); } },
        getElementById(id) { return elements[id] || null; },
        querySelector(selector) {
            if (selector === '.auth-tabs') return authTabs;
            if (selector === '.guest-option') return guestOption;
            if (selector === '.auth-tab.active') return [loginTab, registerTab].find(tab => tab.classList.contains('active')) || null;
            if (selector === '.auth-tab[data-tab="login"]') return loginTab;
            return null;
        },
        querySelectorAll(selector) {
            return selector === '.auth-tab' ? [loginTab, registerTab] : [];
        }
    };
    const authTabController = authTabsModule.create({ document });
    authTabController.initialize();
    const auth = {
        currentUser: null,
        async signOut() { this.currentUser = null; },
        ...authOverrides
    };
    const controller = verification.create({
        document,
        auth,
        authTabs: authTabController,
        updateAllUserNames(name) { verificationRequiredUsers.push(name); },
        showLoginScreen() { loginScreenCalls += 1; },
        async loadVerifiedUser(user) { verifiedUsers.push(user); },
        getSessionStorage() {
            return {
                getItem(key) { return sessionData.get(key) || null; },
                setItem(key, value) { sessionData.set(key, value); }
            };
        },
        setInterval(callback, delay) {
            const handle = { callback, delay };
            intervals.push(handle);
            return handle;
        },
        clearInterval(handle) { clearedIntervals.push(handle); },
        onVerificationRequired(user) { verificationRequiredUsers.push(user); }
    });

    return {
        attributes,
        auth,
        authTabs,
        authTabController,
        clearedIntervals,
        controller,
        elements,
        guestOption,
        intervals,
        loginScreenCalls: () => loginScreenCalls,
        loginTab,
        registerTab,
        sessionData,
        verificationRequiredUsers: () => verificationRequiredUsers,
        verifiedUsers: () => verifiedUsers
    };
}

test('showing verification blocks account access and displays the account email', () => {
    const harness = createHarness();
    const user = { uid: 'u1', email: 'student@example.test' };

    harness.controller.show(user, 'Verification email sent.');

    assert.equal(harness.elements['email-verification-panel'].hidden, false);
    assert.equal(harness.elements['password-reset-panel'].hidden, true);
    assert.equal(harness.elements['verification-email'].textContent, user.email);
    assert.equal(harness.elements['verification-message'].textContent, 'Verification email sent.');
    assert.equal(harness.elements['login-form'].classList.contains('active'), false);
    assert.equal(harness.authTabs.style.display, 'none');
    assert.deepEqual(harness.verificationRequiredUsers(), [user, '']);
    assert.equal(harness.attributes.get('data-screen'), 'login');
});

test('existing unverified accounts receive at most one automatic email per session', async () => {
    let sent = 0;
    const harness = createHarness();
    const user = {
        uid: 'u2',
        email: 'student@example.test',
        emailVerified: false,
        async sendEmailVerification() { sent += 1; }
    };

    await harness.controller.showForExistingAccount(user);
    await harness.controller.showForExistingAccount(user);

    assert.equal(sent, 1);
    assert.equal(harness.elements['verification-message'].textContent, 'Verification email sent. Check your inbox.');
    assert.equal(harness.elements['verification-resend-btn'].disabled, true);
    assert.equal(harness.sessionData.get('enlVerificationAutoSent:u2'), '1');
    assert.equal(harness.intervals.length, 1);
});

test('registration can suppress the automatic verification email while its own email is sent', async () => {
    let sent = 0;
    const harness = createHarness();
    const user = {
        uid: 'u3',
        email: 'student@example.test',
        emailVerified: false,
        async sendEmailVerification() { sent += 1; }
    };

    harness.controller.setRegistrationInProgress(true);
    await harness.controller.showForExistingAccount(user);

    assert.equal(sent, 0);
    assert.equal(harness.elements['email-verification-panel'].hidden, false);
    assert.equal(harness.intervals.length, 0);
});

test('verification check refreshes the token and loads the verified account', async () => {
    let tokenRefresh = null;
    const user = {
        emailVerified: false,
        async reload() { this.emailVerified = true; },
        async getIdToken(forceRefresh) { tokenRefresh = forceRefresh; }
    };
    const harness = createHarness({ currentUser: user });
    harness.controller.initialize();

    await harness.elements['verification-check-btn'].dispatch('click');

    assert.equal(tokenRefresh, true);
    assert.deepEqual(harness.verifiedUsers(), [user]);
    assert.equal(harness.elements['verification-message'].textContent, 'Email verified!');
    assert.equal(harness.elements['verification-check-btn'].disabled, false);
    assert.equal(harness.elements['verification-check-btn'].textContent, "I've verified — Continue");
});

test('resend sends a new verification email and starts the cooldown', async () => {
    let sent = 0;
    const user = { emailVerified: false, async sendEmailVerification() { sent += 1; } };
    const harness = createHarness({ currentUser: user });
    harness.controller.initialize();

    await harness.elements['verification-resend-btn'].dispatch('click');

    assert.equal(sent, 1);
    assert.equal(harness.elements['verification-message'].textContent, 'A new verification email was sent.');
    assert.equal(harness.elements['verification-resend-btn'].disabled, true);
    assert.equal(harness.intervals.length, 1);
});

test('switching accounts signs out and restores the login form', async () => {
    let signOuts = 0;
    const harness = createHarness({ async signOut() { signOuts += 1; } });
    harness.authTabController.select('register');
    harness.controller.show({ email: 'student@example.test' });
    harness.controller.initialize();

    await harness.elements['verification-other-account-btn'].dispatch('click');

    assert.equal(signOuts, 1);
    assert.equal(harness.elements['email-verification-panel'].hidden, true);
    assert.equal(harness.elements['login-form'].classList.contains('active'), true);
    assert.equal(harness.registerTab.getAttribute('aria-selected'), 'false');
    assert.equal(harness.loginTab.getAttribute('aria-selected'), 'true');
    assert.equal(harness.loginTab.focused, true);
    assert.equal(harness.loginScreenCalls(), 2);
});

test('verification cooldown restores the resend button after its timer', () => {
    const harness = createHarness();
    harness.controller.startCooldown(1);
    const timer = harness.intervals[0];

    assert.equal(harness.elements['verification-resend-btn'].disabled, true);
    assert.equal(harness.elements['verification-resend-btn'].textContent, 'Resend available in 1s');

    timer.callback();

    assert.deepEqual(harness.clearedIntervals, [timer]);
    assert.equal(harness.elements['verification-resend-btn'].disabled, false);
    assert.equal(harness.elements['verification-resend-btn'].textContent, 'Resend verification email');
});
