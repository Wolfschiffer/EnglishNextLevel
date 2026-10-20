const assert = require('node:assert/strict');
const test = require('node:test');
const authUI = require('../js/auth-ui.js');
const authTabsModule = require('../js/auth-tabs.js');

function createClassList(initial = []) {
    const classes = new Set(initial);
    return {
        add(value) { classes.add(value); },
        remove(value) { classes.delete(value); },
        contains(value) { return classes.has(value); },
        toggle(value, force) {
            const shouldAdd = force === undefined ? !classes.has(value) : force;
            if (shouldAdd) classes.add(value);
            else classes.delete(value);
            return shouldAdd;
        }
    };
}

function createElement(options = {}) {
    const listeners = new Map();
    const attributes = new Map();
    const element = {
        style: {},
        classList: options.classList || createClassList(),
        dataset: options.dataset || {},
        textContent: options.textContent || '',
        value: options.value || '',
        hidden: options.hidden ?? false,
        disabled: false,
        removed: false,
        tabIndex: options.tabIndex ?? 0,
        parentNode: { children: [], appendChild(child) { this.children.push(child); } },
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        async trigger(type) {
            for (const handler of listeners.get(type) || []) await handler({ target: element });
        },
        click() {
            for (const handler of listeners.get('click') || []) handler({ target: element });
        },
        remove() { this.removed = true; }
    };
    element.setAttribute = (name, value) => attributes.set(name, String(value));
    element.getAttribute = (name) => attributes.get(name) ?? null;
    element.focus = () => { element.focused = true; };
    return element;
}

function createHarness(overrides = {}) {
    const ids = [
        'login-form', 'register-form', 'login-btn', 'register-btn', 'guest-btn',
        'category-logout-btn', 'words-logout-btn', 'auth-container', 'category-container',
        'numbers-menu-container', 'game-container', 'vocab-game-container', 'words-menu-container',
        'auth-intro', 'login-email', 'login-password', 'register-name', 'register-email',
        'register-password', 'email-verification-panel'
    ];
    const elements = new Map(ids.map((id) => [id, createElement()]));
    const tabs = [
        createElement({ dataset: { tab: 'login' }, classList: createClassList(['active']), tabIndex: 0 }),
        createElement({ dataset: { tab: 'register' }, tabIndex: -1 })
    ];
    tabs[0].setAttribute('aria-controls', 'login-form');
    tabs[0].setAttribute('aria-selected', 'true');
    tabs[1].setAttribute('aria-controls', 'register-form');
    tabs[1].setAttribute('aria-selected', 'false');
    const authTabs = createElement();
    const guestOption = createElement();
    const categoryButtons = createElement();
    const messages = [];
    const document = {
        body: { attributes: new Map(), setAttribute(name, value) { this.attributes.set(name, value); } },
        getElementById(id) { return elements.get(id) || null; },
        querySelector(selector) {
            if (selector === '.auth-tabs') return authTabs;
            if (selector === '.guest-option') return guestOption;
            if (selector === '.category-buttons') return categoryButtons;
            if (selector === '.error-message, .success-message') {
                return messages.find((message) => !message.removed) || null;
            }
            return null;
        },
        querySelectorAll(selector) { return selector === '.auth-tab' ? tabs : []; },
        createElement() {
            const element = createElement();
            messages.push(element);
            return element;
        }
    };
    const authTabsController = authTabsModule.create({ document });
    const window = { document, enlDebug() {}, ...overrides.window };
    const calls = { passwordResetInitialize: 0, verificationInitialize: 0, passwordResetSetMode: 0, login: [], register: [], verificationShow: [], cooldown: [], logout: 0, guest: 0, updateGameUserName: 0 };
    const passwordResetUI = {
        initialize() { calls.passwordResetInitialize++; },
        isActive() { return overrides.passwordResetActive === true; },
        setMode() { calls.passwordResetSetMode++; }
    };
    const verificationUI = {
        initialize() { calls.verificationInitialize++; },
        show(...args) { calls.verificationShow.push(args); },
        getSendErrorMessage() { return 'Verification email could not be sent.'; },
        startCooldown(seconds) { calls.cooldown.push(seconds); }
    };
    const ui = authUI.create({
        document,
        window,
        passwordResetUI,
        verificationUI,
        authTabs: authTabsController,
        login: async (...args) => {
            calls.login.push(args);
            if (overrides.loginError) throw overrides.loginError;
            return overrides.loginResult || { user: { emailVerified: true } };
        },
        register: async (...args) => {
            calls.register.push(args);
            if (overrides.registerError) throw overrides.registerError;
            return overrides.registerResult || {
                userCredential: { user: { email: args[1] } },
                verificationSent: true,
                verificationError: null
            };
        },
        onGuestModeSelected() {
            calls.guest++;
            window.isGuest = true;
            window.currentUser = null;
            window.currentUserName = 'Guest';
        },
        onLogout() {
            calls.logout++;
            if (overrides.logoutError) throw overrides.logoutError;
        },
        updateGameUserName() { calls.updateGameUserName++; },
        setTimeout() { return 1; }
    });

    return { ui, document, window, elements, tabs, authTabs, authTabsController, guestOption, categoryButtons, messages, calls };
}

test('auth UI initializes account modules once and switches between login and registration', async () => {
    const harness = createHarness({ passwordResetActive: true });
    harness.ui.initialize();
    harness.ui.initialize();

    assert.equal(harness.calls.passwordResetInitialize, 1);
    assert.equal(harness.calls.verificationInitialize, 1);
    assert.equal(harness.elements.get('auth-container').style.display, 'block');
    assert.equal(harness.elements.get('category-container').style.display, 'none');

    await harness.tabs[1].trigger('click');
    assert.equal(harness.tabs[0].classList.contains('active'), false);
    assert.equal(harness.tabs[1].classList.contains('active'), true);
    assert.equal(harness.elements.get('login-form').classList.contains('active'), false);
    assert.equal(harness.elements.get('register-form').classList.contains('active'), true);
    assert.equal(harness.tabs[1].getAttribute('aria-selected'), 'true');
    assert.equal(harness.tabs[1].tabIndex, 0);
    assert.equal(harness.tabs[0].getAttribute('aria-selected'), 'false');
    assert.equal(harness.calls.passwordResetSetMode, 1);
});

test('login validates fields, calls Firebase with a trimmed email, and restores the button', async () => {
    const harness = createHarness();
    harness.ui.initialize();
    const button = harness.elements.get('login-btn');

    await button.trigger('click');
    assert.equal(harness.messages[0].textContent, 'Please enter your email');
    assert.equal(harness.calls.login.length, 0);

    harness.elements.get('login-email').value = ' student@example.test ';
    harness.elements.get('login-password').value = 'secret123';
    await button.trigger('click');

    assert.deepEqual(harness.calls.login, [['student@example.test', 'secret123']]);
    assert.equal(harness.elements.get('login-email').value, '');
    assert.equal(harness.elements.get('login-password').value, '');
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Login');
});

test('login reports Firebase errors and restores the button after a rejected sign-in', async () => {
    const harness = createHarness({ loginError: { code: 'auth/invalid-credential' } });
    harness.ui.initialize();
    harness.elements.get('login-email').value = 'student@example.test';
    harness.elements.get('login-password').value = 'wrong-password';

    const button = harness.elements.get('login-btn');
    await button.trigger('click');

    assert.equal(harness.messages[0].textContent, 'Incorrect email or password');
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Login');
});

test('registration validates the name limit and displays verification success', async () => {
    const harness = createHarness();
    harness.ui.initialize();
    const button = harness.elements.get('register-btn');
    harness.elements.get('register-name').value = 'N'.repeat(51);
    harness.elements.get('register-email').value = 'student@example.test';
    harness.elements.get('register-password').value = 'secret123';

    await button.trigger('click');
    assert.equal(harness.messages[0].textContent, 'Your name must be 50 characters or fewer');
    assert.equal(harness.calls.register.length, 0);

    harness.elements.get('register-name').value = ` ${'N'.repeat(50)} `;
    harness.elements.get('register-email').value = ' student@example.test ';
    await button.trigger('click');

    assert.deepEqual(harness.calls.register, [[`${'N'.repeat(50)}`, 'student@example.test', 'secret123']]);
    assert.equal(harness.calls.verificationShow.length, 1);
    assert.equal(harness.calls.verificationShow[0][0].email, 'student@example.test');
    assert.equal(harness.calls.verificationShow[0][1], 'Verification email sent. Check your inbox.');
    assert.deepEqual(harness.calls.cooldown, [30]);
    assert.equal(harness.elements.get('register-name').value, '');
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Create account');
});

test('offline guest entry and logout buttons are delegated to the account flow', async () => {
    const harness = createHarness({ window: { enlFirebaseUnavailable: true } });
    harness.ui.initialize();

    assert.equal(harness.authTabs.style.display, 'none');
    assert.equal(harness.elements.get('login-form').style.display, 'none');
    assert.equal(harness.elements.get('register-form').style.display, 'none');
    assert.match(harness.elements.get('auth-intro').textContent, /Continue as Guest/);

    harness.elements.get('guest-btn').click();
    assert.equal(harness.calls.guest, 1);
    assert.equal(harness.window.isGuest, true);
    assert.equal(harness.elements.get('auth-container').style.display, 'none');
    assert.equal(harness.elements.get('category-container').style.display, 'block');
    assert.equal(harness.categoryButtons.style.display, 'grid');
    assert.equal(harness.document.body.attributes.get('data-screen'), 'categories');
    assert.equal(harness.calls.updateGameUserName, 1);

    harness.elements.get('category-logout-btn').click();
    harness.elements.get('words-logout-btn').click();
    assert.equal(harness.calls.logout, 2);
});

test('logout keeps the user informed when Firebase sign-out fails', async () => {
    const harness = createHarness({ logoutError: new Error('offline') });
    harness.ui.initialize();

    await harness.elements.get('category-logout-btn').trigger('click');

    assert.equal(harness.calls.logout, 1);
    assert.equal(harness.messages[0].textContent, 'Could not sign out. Please try again.');
});
