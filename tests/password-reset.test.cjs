const test = require('node:test');
const assert = require('node:assert/strict');
const passwordReset = require('../js/password-reset.js');
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
        value: '',
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

function createHarness(sendPasswordResetEmail = async () => {}) {
    const elements = {
        'forgot-password-btn': createElement(),
        'login-email': createElement({ value: ' student@example.test ' }),
        'password-reset-email': createElement(),
        'password-reset-send-btn': createElement({ textContent: 'Send reset link' }),
        'password-reset-back-btn': createElement(),
        'password-reset-panel': createElement({ hidden: true }),
        'email-verification-panel': createElement({ hidden: false }),
        'password-reset-message': createElement(),
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
    const intervals = [];
    const clearedIntervals = [];
    let loginScreenCalls = 0;
    let resetCalls = [];

    const document = {
        body: { setAttribute(name, value) { attributes.set(name, value); } },
        getElementById(id) { return elements[id] || null; },
        querySelector(selector) {
            if (selector === '.auth-tabs') return authTabs;
            if (selector === '.guest-option') return guestOption;
            if (selector === '.auth-tab[data-tab="login"]') return loginTab;
            return null;
        },
        querySelectorAll(selector) {
            return selector === '.auth-tab' ? [loginTab, registerTab] : [];
        }
    };
    const authTabController = authTabsModule.create({ document });
    authTabController.initialize();
    const controller = passwordReset.create({
        document,
        authTabs: authTabController,
        auth: {
            async sendPasswordResetEmail(email) {
                resetCalls.push(email);
                return sendPasswordResetEmail(email);
            }
        },
        showLoginScreen() { loginScreenCalls += 1; },
        setTimeout(callback) { callback(); return 1; },
        setInterval(callback, delay) {
            const handle = { callback, delay };
            intervals.push(handle);
            return handle;
        },
        clearInterval(handle) { clearedIntervals.push(handle); }
    });

    return {
        attributes,
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
        resetCalls: () => resetCalls
    };
}

test('password reset errors use safe messages for known and unknown codes', () => {
    assert.equal(passwordReset.getErrorMessage({ code: 'auth/invalid-email' }), 'Please enter a valid email address.');
    assert.equal(passwordReset.getErrorMessage({ code: 'auth/too-many-requests' }), 'Too many reset requests. Wait a little before trying again.');
    assert.equal(passwordReset.getErrorMessage({ code: 'auth/new-code' }), 'Could not send the reset email. Please try again.');
});

test('forgot-password opens the reset panel with the login email and back restores login', async () => {
    const harness = createHarness();
    harness.authTabController.select('register');
    harness.controller.initialize();
    harness.controller.initialize();

    await harness.elements['forgot-password-btn'].dispatch('click');
    assert.equal(harness.elements['password-reset-email'].value, 'student@example.test');
    assert.equal(harness.elements['password-reset-panel'].hidden, false);
    assert.equal(harness.elements['email-verification-panel'].hidden, true);
    assert.equal(harness.authTabs.style.display, 'none');
    assert.equal(harness.guestOption.style.display, 'none');
    assert.equal(harness.elements['register-form'].classList.contains('active'), false);
    assert.equal(harness.elements['register-form'].getAttribute('aria-hidden'), 'true');
    assert.equal(harness.loginScreenCalls(), 1);
    assert.equal(harness.attributes.get('data-screen'), 'login');

    await harness.elements['password-reset-back-btn'].dispatch('click');
    assert.equal(harness.elements['password-reset-panel'].hidden, true);
    assert.equal(harness.authTabs.style.display, '');
    assert.equal(harness.guestOption.style.display, '');
    assert.equal(harness.elements['login-form'].classList.contains('active'), true);
    assert.equal(harness.loginTab.getAttribute('aria-selected'), 'true');
    assert.equal(harness.loginTab.tabIndex, 0);
    assert.equal(harness.registerTab.getAttribute('aria-selected'), 'false');
    assert.equal(harness.elements['login-email'].focused, true);
});

test('password reset gives the same success message for unknown accounts', async () => {
    const harness = createHarness(async () => {
        throw { code: 'auth/user-not-found' };
    });
    harness.controller.initialize();
    harness.elements['password-reset-email'].value = 'student@example.test';

    await harness.elements['password-reset-send-btn'].dispatch('click');

    assert.deepEqual(harness.resetCalls(), ['student@example.test']);
    assert.equal(harness.elements['password-reset-message'].classList.contains('is-success'), true);
    assert.match(harness.elements['password-reset-message'].textContent, /^If an account exists/);
    assert.equal(harness.elements['password-reset-send-btn'].disabled, true);
    assert.equal(harness.intervals.length, 1);
});

test('password reset gives a generic success for disabled accounts', async () => {
    const harness = createHarness(async () => {
        throw { code: 'auth/user-disabled' };
    });
    harness.controller.initialize();
    harness.elements['password-reset-email'].value = 'student@example.test';

    await harness.elements['password-reset-send-btn'].dispatch('click');

    assert.equal(harness.elements['password-reset-message'].classList.contains('is-success'), true);
    assert.match(harness.elements['password-reset-message'].textContent, /^If an account exists/);
    assert.equal(harness.elements['password-reset-send-btn'].disabled, true);
});

test('password reset shows the generic success for a successful email send', async () => {
    const harness = createHarness(async () => ({ delivered: true }));
    harness.controller.initialize();
    harness.elements['password-reset-email'].value = 'student@example.test';

    await harness.elements['password-reset-send-btn'].dispatch('click');

    assert.deepEqual(harness.resetCalls(), ['student@example.test']);
    assert.equal(harness.elements['password-reset-message'].classList.contains('is-success'), true);
    assert.match(harness.elements['password-reset-message'].textContent, /^If an account exists/);
    assert.equal(harness.elements['password-reset-send-btn'].disabled, true);
});

test('pressing Enter submits the password reset form', async () => {
    const harness = createHarness();
    harness.controller.initialize();
    harness.elements['password-reset-email'].value = ' student@example.test ';
    let prevented = false;

    await harness.elements['password-reset-email'].dispatch('keydown', {
        key: 'Enter',
        preventDefault() { prevented = true; }
    });

    assert.equal(prevented, true);
    assert.deepEqual(harness.resetCalls(), ['student@example.test']);
    assert.equal(harness.elements['password-reset-message'].classList.contains('is-success'), true);
    assert.equal(harness.elements['password-reset-send-btn'].disabled, true);
});

test('password reset cooldown can be cancelled and restores the send button', () => {
    const harness = createHarness();
    harness.controller.startCooldown(1);
    const timer = harness.intervals[0];
    assert.equal(harness.elements['password-reset-send-btn'].disabled, true);
    assert.equal(harness.elements['password-reset-send-btn'].textContent, 'Send again in 1s');

    timer.callback();

    assert.deepEqual(harness.clearedIntervals, [timer]);
    assert.equal(harness.elements['password-reset-send-btn'].disabled, false);
    assert.equal(harness.elements['password-reset-send-btn'].textContent, 'Send reset link');
});
