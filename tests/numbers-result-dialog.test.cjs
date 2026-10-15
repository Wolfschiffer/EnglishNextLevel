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
        this.parentElement = null;
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value);
        if (!this.className.split(/\s+/).includes('numbers-result-modal')) return;

        this.queryNodes.clear();
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
        return child;
    }

    querySelector(selector) { return this.queryNodes.get(selector) || null; }

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

    const calls = { save: [], feedback: [], restart: 0, back: 0 };
    const dependencies = {
        document,
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
        onBack: () => { calls.back++; },
        removeWinScreen() {},
        removeRestartButton() {},
        logger: { error() {} },
        ...overrides
    };

    return { dialog: resultDialogModule.create(dependencies), document, calls };
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
