const test = require('node:test');
const assert = require('node:assert/strict');
const resultDialogModule = require('../js/numbers-result-dialog.js');
const leaderboardClient = require('../js/leaderboard-client.js');

class FakeElement {
    constructor(tagName = 'div') {
        this.tagName = tagName;
        this.className = '';
        this.children = [];
        this.listeners = new Map();
        this.queryNodes = new Map();
        this.disabled = false;
        this.value = '';
        this.textContent = '';
        this.isConnected = false;
        this.focusCount = 0;
        this.parentElement = null;
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value);
        if (!this.className.split(/\s+/).includes('numbers-result-modal')) return;

        this.queryNodes.clear();
        if (/class="numbers-result-card"/.test(this._innerHTML)) {
            const dialog = new FakeElement('div');
            dialog.className = 'numbers-result-card';
            this.queryNodes.set('.numbers-result-card', dialog);
        }
        for (const match of this._innerHTML.matchAll(/<(input|button|div)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
            const [, tagName, id] = match;
            const element = new FakeElement(tagName);
            const valueMatch = /\bvalue="([^"]*)"/.exec(match[0]);
            if (valueMatch) element.value = valueMatch[1];
            this.queryNodes.set(`#${id}`, element);
        }
    }

    get innerHTML() { return this._innerHTML; }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        child.isConnected = this.isConnected;
        for (const node of child.queryNodes.values()) node.isConnected = child.isConnected;
        return child;
    }

    querySelector(selector) { return this.queryNodes.get(selector) || null; }
    focus() { this.focusCount++; }

    addEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        handlers.push(handler);
        this.listeners.set(type, handlers);
    }

    async click() {
        for (const handler of this.listeners.get('click') || []) {
            await handler({ target: this, preventDefault() {} });
        }
    }

    remove() {
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        }
        this.parentElement = null;
        this.isConnected = false;
    }
}

function createHarness(overrides = {}) {
    const document = {
        createElement(tagName) { return new FakeElement(tagName); },
        querySelector(selector) {
            if (selector === '.numbers-result-modal') {
                return document.body.children.find(element => element.className === 'numbers-result-modal') || null;
            }
            return null;
        }
    };
    document.body = new FakeElement('body');
    document.body.appendChild = child => {
        child.parentElement = document.body;
        child.isConnected = true;
        document.body.children.push(child);
        return child;
    };

    const windowListeners = new Map();
    const returnFocusTarget = {
        isConnected: true,
        visible: false,
        focusCount: 0,
        focus(options) { this.focusCount++; this.lastFocusOptions = options; },
        getClientRects() { return this.visible ? [1] : []; }
    };
    const calls = {
        save: [], feedback: [], restart: 0, back: 0, traps: [], focusTrapReleases: 0,
        backWillPopState: false, backShowsMenu: false
    };
    const activeWindow = {
        addEventListener(type, listener) {
            const listeners = windowListeners.get(type) || new Set();
            listeners.add(listener);
            windowListeners.set(type, listeners);
        },
        removeEventListener(type, listener) { windowListeners.get(type)?.delete(listener); },
        dispatch(type) { [...(windowListeners.get(type) || [])].forEach(listener => listener()); },
        listenerCount(type) { return windowListeners.get(type)?.size || 0; }
    };
    const dependencies = {
        document,
        activeWindow,
        getBackFocusTarget: () => returnFocusTarget,
        focusTrap: {
            trapDialogFocus(dialog, options) {
                calls.traps.push({ dialog, options });
                options.initialFocus?.focus();
                return () => { calls.focusTrapReleases++; };
            }
        },
        escapeHtml: text => String(text),
        formatTime: seconds => `time:${seconds}`,
        formatScore: score => `score:${score}`,
        getPlayerName: () => 'Saved Name',
        getCurrentGame: () => 'numbers',
        saveToLeaderboard: async (...args) => {
            calls.save.push(args);
            return { saved: true, destination: 'qa', playerName: args[2], improved: true };
        },
        client: {
            getSuccessfulSaveFeedback(...args) {
                calls.feedback.push(args);
                return { buttonText: 'Saved in QA', statusText: 'Saved to the QA leaderboard.' };
            }
        },
        onRestart: () => { calls.restart++; },
        onBack: () => {
            calls.back++;
            if (calls.backShowsMenu) returnFocusTarget.visible = true;
            return calls.backWillPopState;
        },
        removeWinScreen() {},
        removeRestartButton() {},
        logger: { error() {} },
        ...overrides
    };

    return { dialog: resultDialogModule.create(dependencies), document, calls, activeWindow, returnFocusTarget };
}

const completedResult = {
    baseScore: 100,
    speedBonus: 1.5,
    lifeBonus: 1.4,
    totalGameTime: 40,
    finalScore: 210,
    completedMode: 'numbers11-20',
    leaderboardRunId: 'run-123'
};

test('result dialog traps focus on the leaderboard name and releases it when removed', () => {
    const harness = createHarness();
    harness.dialog.show(completedResult, { won: true });

    const modal = harness.document.querySelector('.numbers-result-modal');
    const dialogCard = modal.querySelector('.numbers-result-card');
    const nameInput = modal.querySelector('#numbers-result-name');
    assert.equal(harness.calls.traps.length, 1);
    assert.equal(harness.calls.traps[0].dialog, dialogCard);
    assert.equal(harness.calls.traps[0].options.initialFocus, nameInput);
    assert.equal(nameInput.focusCount, 1);
    assert.match(modal.innerHTML, /aria-label="Name for the leaderboard"/);

    harness.dialog.remove();
    assert.equal(harness.calls.focusTrapReleases, 1);
});

test('a lost result focuses Play Again and Escape returns focus to its selected mode', () => {
    const harness = createHarness();
    harness.calls.backWillPopState = true;
    harness.dialog.show(completedResult, { won: false });

    const modal = harness.document.querySelector('.numbers-result-modal');
    const restartButton = modal.querySelector('#numbers-result-restart');
    assert.equal(harness.calls.traps[0].options.initialFocus, restartButton);
    assert.equal(restartButton.focusCount, 1);

    harness.calls.traps[0].options.onEscape();
    assert.equal(harness.calls.back, 1);
    assert.equal(harness.calls.focusTrapReleases, 1);
    assert.equal(harness.activeWindow.listenerCount('popstate'), 1);
    harness.returnFocusTarget.visible = true;
    harness.activeWindow.dispatch('popstate');
    assert.equal(harness.returnFocusTarget.focusCount, 1);
    assert.deepEqual(harness.returnFocusTarget.lastFocusOptions, { preventScroll: true });
    assert.equal(harness.activeWindow.listenerCount('popstate'), 0);
});

test('synchronous menu navigation restores focus without leaving a popstate listener', () => {
    const harness = createHarness();
    harness.calls.backShowsMenu = true;
    harness.dialog.show(completedResult, { won: false });

    harness.document.querySelector('.numbers-result-modal').querySelector('#numbers-result-menu').click();

    assert.equal(harness.calls.back, 1);
    assert.equal(harness.returnFocusTarget.focusCount, 1);
    assert.equal(harness.activeWindow.listenerCount('popstate'), 0);
});

test('submits the typed player name and shows the QA save feedback', async () => {
    const harness = createHarness();
    harness.dialog.show(completedResult, { won: true });

    const modal = harness.document.querySelector('.numbers-result-modal');
    const nameInput = modal.querySelector('#numbers-result-name');
    const saveButton = modal.querySelector('#numbers-result-save');
    const saveStatus = modal.querySelector('#numbers-result-save-status');
    nameInput.value = '  Player One  ';
    await saveButton.click();

    assert.deepEqual(harness.calls.save, [['numbers11-20', 210, 'Player One', 'run-123']]);
    assert.deepEqual(harness.calls.feedback, [['qa', 'Player One', true]]);
    assert.equal(nameInput.disabled, true);
    assert.equal(saveButton.textContent, 'Saved in QA');
    assert.equal(saveStatus.textContent, 'Saved to the QA leaderboard.');
});

test('keeps score saving available after failure and accepts a later local retry', async () => {
    let attempt = 0;
    const harness = createHarness({
        saveToLeaderboard: async () => ({ saved: ++attempt > 1, destination: 'local', playerName: 'Saved Name' }),
        client: leaderboardClient
    });
    harness.dialog.show(completedResult, { won: true });
    const modal = harness.document.querySelector('.numbers-result-modal');
    const saveButton = modal.querySelector('#numbers-result-save');
    const saveStatus = modal.querySelector('#numbers-result-save-status');

    await saveButton.click();
    assert.equal(saveButton.disabled, false);
    assert.equal(saveButton.textContent, 'Try Again');
    assert.match(saveStatus.textContent, /Could not save your score/);

    await saveButton.click();
    assert.equal(saveButton.textContent, 'Saved on this device');
    assert.equal(saveStatus.textContent, 'Score saved on this device as Saved Name. We could not confirm whether it was added to the shared leaderboard.');
});

test('a lost round omits score submission and keeps the result actions', async () => {
    const harness = createHarness();
    harness.dialog.show(completedResult, { won: false });
    const modal = harness.document.querySelector('.numbers-result-modal');

    assert.match(modal.innerHTML, /Game Over/);
    assert.equal(modal.querySelector('#numbers-result-save'), null);
    await modal.querySelector('#numbers-result-restart').click();
    await modal.querySelector('#numbers-result-menu').click();
    assert.equal(harness.calls.restart, 1);
    assert.equal(harness.calls.back, 1);
});

test('explains possible internet delay on verified runs only', () => {
    const verifiedHarness = createHarness();
    verifiedHarness.dialog.show(completedResult, { won: true });
    const verifiedModal = verifiedHarness.document.querySelector('.numbers-result-modal');

    assert.match(verifiedModal.innerHTML, /time for an online score may include internet delay/i);
    assert.match(verifiedModal.innerHTML, /role="note"/);

    const deviceOnlyHarness = createHarness();
    deviceOnlyHarness.dialog.show({ ...completedResult, leaderboardRunId: null }, { won: true });
    const deviceOnlyModal = deviceOnlyHarness.document.querySelector('.numbers-result-modal');

    assert.doesNotMatch(deviceOnlyModal.innerHTML, /numbers-result-network-note/);
});
