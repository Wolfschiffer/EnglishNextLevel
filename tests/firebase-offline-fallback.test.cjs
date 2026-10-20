const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const fallbackSource = fs.readFileSync(path.join(root, 'js/firebase-offline-fallback.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function createElement() {
    const listeners = new Map();
    const classes = new Set();
    return {
        style: {},
        textContent: '',
        hidden: false,
        value: '',
        classList: {
            add(value) { classes.add(value); },
            remove(value) { classes.delete(value); },
            toggle(value, force) {
                if (force === undefined ? !classes.has(value) : force) classes.add(value);
                else classes.delete(value);
            },
            contains(value) { return classes.has(value); }
        },
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || [];
            handlers.push(handler);
            listeners.set(type, handlers);
        },
        click() {
            for (const handler of listeners.get('click') || []) handler({ target: this });
        }
    };
}

function createBrowserContext() {
    const elements = new Map();
    const documentListeners = new Map();
    const ids = [
        'auth-container', 'category-container', 'numbers-menu-container', 'game-container',
        'vocab-game-container', 'words-menu-container', 'login-form', 'register-form',
        'login-btn', 'register-btn', 'guest-btn', 'category-logout-btn', 'words-logout-btn',
        'auth-intro'
    ];
    for (const id of ids) elements.set(id, createElement());

    const authTabs = createElement();
    const categoryButtons = createElement();
    const document = {
        readyState: 'loading',
        body: { setAttribute() {} },
        getElementById(id) { return elements.get(id) || null; },
        querySelector(selector) {
            if (selector === '.auth-tabs') return authTabs;
            if (selector === '.category-buttons') return categoryButtons;
            return null;
        },
        querySelectorAll() { return []; },
        addEventListener(type, handler) {
            const handlers = documentListeners.get(type) || [];
            handlers.push(handler);
            documentListeners.set(type, handlers);
        }
    };
    const context = {
        document,
        navigator: { userAgent: 'test browser' },
        console: { warn() {}, info() {} },
        setTimeout(callback) { callback(); return 1; },
        clearTimeout() {},
        setInterval() { return 1; },
        clearInterval() {},
        URLSearchParams,
        window: null
    };
    context.window = context;
    context.document = document;
    context.location = { protocol: 'http:', hostname: 'localhost', pathname: '/', search: '' };
    context.addEventListener = () => {};
    context.enlDebug = () => {};
    context.EnlFirebaseEnvironment = {
        current: { name: 'test', useLocalEmulators: true, firebaseConfig: { projectId: 'demo-english-next-level' } }
    };
    context.elements = elements;
    context.documentListeners = documentListeners;
    context.authTabs = authTabs;
    context.categoryButtons = categoryButtons;
    return context;
}

test('Firebase fallback leaves a complete compat SDK untouched', () => {
    const sdk = {
        initializeApp() {},
        auth() {},
        firestore() {}
    };
    const context = { firebase: sdk, console: { warn() {} } };
    context.window = context;

    vm.runInNewContext(fallbackSource, context);

    assert.equal(context.firebase, sdk);
    assert.equal(context.enlFirebaseUnavailable, undefined);
});

test('a missing optional Functions SDK does not disable available account services', () => {
    const context = createBrowserContext();
    const auth = { useEmulator() {}, onAuthStateChanged() { return () => {}; } };
    const db = { useEmulator() {} };
    const sdk = {
        initializeApp() {},
        auth: () => auth,
        firestore: () => db
    };
    context.firebase = sdk;
    vm.createContext(context);
    vm.runInContext(fallbackSource, context);

    for (const file of ['auth-tabs.js', 'password-reset.js', 'email-verification.js', 'auth-ui.js', 'firebase-config.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
    }

    assert.equal(context.firebase, sdk);
    assert.equal(context.firebase.functions, undefined);
    assert.equal(context.enlFirebaseUnavailable, undefined);
    assert.notEqual(context.authTabs.style.display, 'none');
    assert.notEqual(context.elements.get('login-form').style.display, 'none');
});

test('Firebase fallback runs after the CDN SDK tags and before Firebase initialization', () => {
    const sdkTags = [...html.matchAll(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^\"]+"><\/script>/g)];
    const lastSdkEnd = sdkTags.at(-1)?.index ?? -1;
    const fallbackIndex = html.indexOf('<script src="js/firebase-offline-fallback.js"></script>');
    const configIndex = html.indexOf('<script src="js/firebase-config.js"></script>');

    assert.equal(sdkTags.length, 4);
    assert.ok(lastSdkEnd >= 0 && fallbackIndex > lastSdkEnd);
    assert.ok(configIndex > fallbackIndex);
});

test('Firebase fallback exposes offline-safe compat methods when the SDK is missing', async () => {
    const context = createBrowserContext();
    vm.runInNewContext(fallbackSource, context);

    assert.equal(context.enlFirebaseUnavailable, true);
    assert.equal(typeof context.firebase.initializeApp, 'function');
    assert.equal(typeof context.firebase.auth().onAuthStateChanged, 'function');
    assert.equal(typeof context.firebase.firestore.FieldValue.serverTimestamp, 'function');
    assert.equal(context.firebase.functions, undefined);
    await assert.rejects(
        context.firebase.auth().signInWithEmailAndPassword('student@example.test', 'password'),
        /Firebase Authentication is unavailable/
    );
});

test('the login flow falls back to the local guest option when Firebase is missing', () => {
    const context = createBrowserContext();
    vm.createContext(context);
    vm.runInContext(fallbackSource, context);

    for (const file of ['auth-tabs.js', 'password-reset.js', 'email-verification.js', 'auth-ui.js', 'firebase-config.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
    }

    for (const handler of context.documentListeners.get('DOMContentLoaded') || []) handler();

    const loginForm = context.elements.get('login-form');
    const registerForm = context.elements.get('register-form');
    const guestButton = context.elements.get('guest-btn');
    assert.equal(context.elements.get('auth-intro').textContent,
        'Account services are unavailable. Continue as Guest to practice; progress stays on this device.');
    assert.equal(context.authTabs.style.display, 'none');
    assert.equal(loginForm.style.display, 'none');
    assert.equal(registerForm.style.display, 'none');

    guestButton.click();

    assert.equal(context.isGuest, true);
    assert.equal(context.currentUser, null);
    assert.equal(context.currentUserName, 'Guest');
    assert.equal(context.elements.get('auth-container').style.display, 'none');
    assert.equal(context.elements.get('category-container').style.display, 'block');
    assert.equal(context.categoryButtons.style.display, 'grid');
});
