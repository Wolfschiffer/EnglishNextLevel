const assert = require('node:assert/strict');
const test = require('node:test');
const authTabsModule = require('../js/auth-tabs.js');

function createClassList(initial = []) {
    const values = new Set(initial);
    return {
        add(value) { values.add(value); },
        contains(value) { return values.has(value); },
        toggle(value, force) {
            const enabled = force === undefined ? !values.has(value) : Boolean(force);
            if (enabled) values.add(value);
            else values.delete(value);
            return enabled;
        }
    };
}

function createElement(options = {}) {
    const attributes = new Map(Object.entries(options.attributes || {}));
    const listeners = new Map();
    return {
        attributes,
        classList: options.classList || createClassList(),
        dataset: options.dataset || {},
        tabIndex: options.tabIndex ?? 0,
        addEventListener(type, callback) {
            const callbacks = listeners.get(type) || [];
            callbacks.push(callback);
            listeners.set(type, callbacks);
        },
        async dispatch(type, event = {}) {
            for (const callback of listeners.get(type) || []) {
                await callback({ target: this, currentTarget: this, preventDefault() { this.defaultPrevented = true; }, ...event });
            }
        },
        focus() { this.focused = true; },
        getAttribute(name) { return attributes.get(name) ?? null; },
        setAttribute(name, value) { attributes.set(name, String(value)); }
    };
}

function createHarness() {
    const loginPanel = createElement({ classList: createClassList(['active']) });
    const registerPanel = createElement();
    const loginTab = createElement({
        classList: createClassList(['active']),
        dataset: { tab: 'login' },
        attributes: { 'aria-controls': 'login-panel', 'aria-selected': 'true' }
    });
    const registerTab = createElement({
        dataset: { tab: 'register' },
        attributes: { 'aria-controls': 'register-panel', 'aria-selected': 'false' },
        tabIndex: -1
    });
    const elements = { 'login-panel': loginPanel, 'register-panel': registerPanel };
    const document = {
        querySelectorAll(selector) { return selector === '.auth-tab' ? [loginTab, registerTab] : []; },
        getElementById(id) { return elements[id] || null; }
    };
    const controller = authTabsModule.create({ document });
    return { controller, loginPanel, loginTab, registerPanel, registerTab };
}

test('initialization keeps one selected tab and exposes only its linked panel', () => {
    const harness = createHarness();
    harness.controller.initialize();

    assert.equal(harness.loginTab.getAttribute('aria-selected'), 'true');
    assert.equal(harness.loginTab.tabIndex, 0);
    assert.equal(harness.loginPanel.classList.contains('active'), true);
    assert.equal(harness.loginPanel.getAttribute('aria-hidden'), 'false');
    assert.equal(harness.registerTab.getAttribute('aria-selected'), 'false');
    assert.equal(harness.registerTab.tabIndex, -1);
    assert.equal(harness.registerPanel.classList.contains('active'), false);
    assert.equal(harness.registerPanel.getAttribute('aria-hidden'), 'true');
});

test('activating a tab synchronizes its selected state and panel', async () => {
    const harness = createHarness();
    const activated = [];
    harness.controller.initialize((name) => activated.push(name));

    await harness.registerTab.dispatch('click');

    assert.deepEqual(activated, ['register']);
    assert.equal(harness.controller.getSelected(), 'register');
    assert.equal(harness.registerTab.getAttribute('aria-selected'), 'true');
    assert.equal(harness.registerTab.tabIndex, 0);
    assert.equal(harness.registerPanel.classList.contains('active'), true);
    assert.equal(harness.registerPanel.getAttribute('aria-hidden'), 'false');
    assert.equal(harness.loginTab.getAttribute('aria-selected'), 'false');
    assert.equal(harness.loginPanel.getAttribute('aria-hidden'), 'true');
});

test('arrow keys wrap between tabs and move focus while Home and End select endpoints', async () => {
    const harness = createHarness();
    harness.controller.initialize();

    await harness.loginTab.dispatch('keydown', { key: 'ArrowLeft' });
    assert.equal(harness.registerTab.focused, true);
    assert.equal(harness.controller.getSelected(), 'register');

    await harness.registerTab.dispatch('keydown', { key: 'ArrowRight' });
    assert.equal(harness.loginTab.focused, true);
    assert.equal(harness.controller.getSelected(), 'login');

    await harness.loginTab.dispatch('keydown', { key: 'End' });
    assert.equal(harness.registerTab.focused, true);
    assert.equal(harness.controller.getSelected(), 'register');

    await harness.registerTab.dispatch('keydown', { key: 'Home' });
    assert.equal(harness.loginTab.focused, true);
    assert.equal(harness.controller.getSelected(), 'login');
});

test('hiding panels for reset or verification preserves selection and restores its panel', () => {
    const harness = createHarness();
    harness.controller.initialize();
    harness.controller.select('register');

    harness.controller.setPanelVisibility(false);
    assert.equal(harness.controller.getSelected(), 'register');
    assert.equal(harness.registerTab.getAttribute('aria-selected'), 'true');
    assert.equal(harness.registerPanel.classList.contains('active'), false);
    assert.equal(harness.registerPanel.getAttribute('aria-hidden'), 'true');

    harness.controller.setPanelVisibility(true);
    assert.equal(harness.registerPanel.classList.contains('active'), true);
    assert.equal(harness.registerPanel.getAttribute('aria-hidden'), 'false');
});
