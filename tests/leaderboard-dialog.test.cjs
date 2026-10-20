const test = require('node:test');
const assert = require('node:assert/strict');
const dialogModule = require('../js/leaderboard-dialog.js');
const leaderboardClient = require('../js/leaderboard-client.js');

class FakeElement {
    constructor(document, tagName = 'div') {
        this.document = document;
        this.tagName = tagName;
        this.children = [];
        this.attributes = new Map();
        this.listeners = new Map();
        this.dataset = {};
        this.isConnected = false;
        this.parentElement = null;
        this._className = '';
        this._innerHTML = '';
        this._textContent = '';
        this.classList = {
            add: (...names) => this.setClasses([...this.getClasses(), ...names]),
            remove: (...names) => this.setClasses(this.getClasses().filter(name => !names.includes(name))),
            contains: name => this.getClasses().includes(name)
        };
    }

    get className() { return this._className; }
    set className(value) {
        this._className = String(value);
        if (this._className.split(/\s+/).includes('leaderboard-modal')) this.initializeModal();
    }

    get textContent() { return this._textContent; }
    set textContent(value) { this._textContent = String(value); }
    get innerHTML() {
        if (this._innerHTML !== '') return this._innerHTML;
        return this._textContent
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
    set innerHTML(value) {
        this._innerHTML = String(value);
        this.children = [];
    }

    getClasses() { return this._className.split(/\s+/).filter(Boolean); }
    setClasses(names) { this._className = [...new Set(names)].join(' '); }

    initializeModal() {
        this.queryNodes = new Map([
            ['#leaderboard-scope-label', new FakeElement(this.document)],
            ['#leaderboard-dialog-title', new FakeElement(this.document, 'h2')],
            ['#leaderboard-tabs', new FakeElement(this.document)],
            ['#leaderboard-mode-label', new FakeElement(this.document)],
            ['#leaderboard-list', new FakeElement(this.document)],
            ['.close-modal', new FakeElement(this.document, 'button')],
            ['[role="dialog"]', new FakeElement(this.document)]
        ]);
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        if (this.isConnected) child.connect();
        return child;
    }

    connect() {
        this.isConnected = true;
        this.children.forEach(child => child.connect());
    }

    remove() {
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        }
        this.parentElement = null;
        this.disconnect();
    }

    disconnect() {
        this.isConnected = false;
        this.children.forEach(child => child.disconnect());
    }

    querySelector(selector) { return this.queryNodes?.get(selector) || null; }
    querySelectorAll(selector) {
        if (selector === '.tab-btn') {
            return this.querySelector('#leaderboard-tabs')?.children || [];
        }
        return [];
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) || null; }
    addEventListener(type, handler) {
        const handlers = this.listeners.get(type) || [];
        handlers.push(handler);
        this.listeners.set(type, handlers);
    }
    dispatch(type, event) {
        for (const handler of this.listeners.get(type) || []) handler(event);
    }
    focus() { this.document.activeElement = this; }
}

function createDocument() {
    const document = {
        activeElement: null,
        createElement(tagName) { return new FakeElement(document, tagName); },
        querySelector(selector) {
            if (selector === '.leaderboard-modal') {
                return document.body.children.find(element => element.classList.contains('leaderboard-modal')) || null;
            }
            return null;
        }
    };
    document.body = new FakeElement(document, 'body');
    document.body.appendChild = child => {
        child.parentElement = document.body;
        document.body.children.push(child);
        child.connect();
        return child;
    };
    return document;
}

function createDependencies(overrides = {}) {
    const document = createDocument();
    const focusedElement = new FakeElement(document, 'button');
    focusedElement.connect();
    document.activeElement = focusedElement;
    let escapeHandler = null;
    let focusTrapReleased = false;
    const dependencies = {
        document,
        client: leaderboardClient,
        readLocalScores: () => ({ scores: [{ name: 'Alex', score: 12 }], ok: true }),
        focusTrap: {
            trapDialogFocus(_dialog, { initialFocus, onEscape }) {
                escapeHandler = onEscape;
                initialFocus.focus();
                return () => { focusTrapReleased = true; };
            }
        },
        environment: 'production',
        isCloudConfigured: () => false,
        getFirestore() { throw new Error('Cloud should not be read in this test.'); },
        logger: { error() {} },
        debug() {},
        ...overrides
    };
    return {
        document,
        focusedElement,
        dependencies,
        get escapeHandler() { return escapeHandler; },
        get focusTrapReleased() { return focusTrapReleased; }
    };
}

function createSnapshot(scores) {
    return {
        metadata: { fromCache: false },
        forEach(callback) {
            scores.forEach(score => callback({ data: () => score }));
        }
    };
}

function createFirestoreWithGet(get) {
    return {
        collection() {
            return {
                doc() {
                    return {
                        collection() {
                            return {
                                orderBy() { return this; },
                                limit() { return this; },
                                get
                            };
                        }
                    };
                }
            };
        }
    };
}

test('opens the leaderboard with tabs and safely escapes player names', async () => {
    const harness = createDependencies({
        readLocalScores: () => ({ scores: [{ name: '<img src=x onerror=alert(1)>', score: 12 }], ok: true })
    });
    const dialog = dialogModule.create(harness.dependencies);

    await dialog.open();

    const modal = harness.document.querySelector('.leaderboard-modal');
    assert.ok(modal);
    assert.equal(modal.querySelector('#leaderboard-scope-label').textContent, 'Device Leaderboards');
    assert.equal(modal.querySelector('#leaderboard-dialog-title').textContent, 'Device Leaderboards');
    assert.equal(modal.querySelector('#leaderboard-tabs').children.length, 9);
    assert.equal(modal.querySelector('#leaderboard-mode-label').textContent, '1–10');
    assert.match(modal.querySelector('#leaderboard-list').children[0].innerHTML, /&lt;img/);
    assert.doesNotMatch(modal.querySelector('#leaderboard-list').children[0].innerHTML, /<img/);
});

test('shows device scope when a configured cloud leaderboard cannot be loaded', async () => {
    const harness = createDependencies({
        isCloudConfigured: () => true,
        getFirestore: () => createFirestoreWithGet(() => Promise.reject(new Error('Cloud is unavailable.')))
    });

    await dialogModule.create(harness.dependencies).open();

    const modal = harness.document.querySelector('.leaderboard-modal');
    assert.equal(modal.querySelector('#leaderboard-scope-label').textContent, 'Device Leaderboards');
    assert.equal(modal.querySelector('#leaderboard-dialog-title').textContent, 'Device Leaderboards');
    assert.equal(modal.querySelector('.close-modal').getAttribute('aria-label'), 'Close device leaderboards');
});

test('shows device scope when Firestore returns a cached leaderboard', async () => {
    const cachedSnapshot = { ...createSnapshot([{ name: 'Old cloud score', score: 50 }]), metadata: { fromCache: true } };
    const harness = createDependencies({
        isCloudConfigured: () => true,
        getFirestore: () => createFirestoreWithGet(() => Promise.resolve(cachedSnapshot))
    });

    await dialogModule.create(harness.dependencies).open();

    const modal = harness.document.querySelector('.leaderboard-modal');
    assert.equal(modal.querySelector('#leaderboard-scope-label').textContent, 'Device Leaderboards');
    assert.match(modal.querySelector('#leaderboard-list').children[0].innerHTML, /Alex/);
    assert.doesNotMatch(modal.querySelector('#leaderboard-list').children[0].innerHTML, /Old cloud score/);
});

test('ignores an older cloud response after switching leaderboard tabs', async () => {
    const pendingReads = new Map();
    const harness = createDependencies({
        isCloudConfigured: () => true,
        getFirestore() {
            return {
                collection(name) {
                    assert.equal(name, 'leaderboards');
                    return {
                        doc(modeId) {
                            return {
                                collection(subcollection) {
                                    assert.equal(subcollection, 'scores');
                                    return {
                                        orderBy() { return this; },
                                        limit() { return this; },
                                        get() {
                                            return new Promise(resolve => pendingReads.set(modeId, resolve));
                                        }
                                    };
                                }
                            };
                        }
                    };
                }
            };
        }
    });
    const opening = dialogModule.create(harness.dependencies).open();
    const modal = harness.document.querySelector('.leaderboard-modal');
    const newerTab = modal.querySelector('#leaderboard-tabs').children.find(tab => tab.dataset.mode === 'numbers11-20');
    newerTab.onclick();

    pendingReads.get('numbers')(createSnapshot([{ name: 'Old tab', score: 1 }]));
    await opening;
    pendingReads.get('numbers11-20')(createSnapshot([{ name: 'Selected tab', score: 2 }]));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(modal.querySelector('#leaderboard-mode-label').textContent, '11–20');
    assert.equal(modal.querySelector('#leaderboard-scope-label').textContent, 'Global Leaderboards');
    assert.match(modal.querySelector('#leaderboard-list').children[0].innerHTML, /Selected tab/);
    assert.doesNotMatch(modal.querySelector('#leaderboard-list').children[0].innerHTML, /Old tab/);
});

test('ignores a pending cloud response after closing and reopening the leaderboard', async () => {
    const pendingReads = [];
    const harness = createDependencies({
        isCloudConfigured: () => true,
        getFirestore: () => createFirestoreWithGet(() => new Promise(resolve => pendingReads.push(resolve)))
    });
    const dialog = dialogModule.create(harness.dependencies);

    const firstOpening = dialog.open();
    const firstModal = harness.document.querySelector('.leaderboard-modal');
    const firstList = firstModal.querySelector('#leaderboard-list');
    assert.equal(firstList.innerHTML, '<div class="leaderboard-empty" role="status">Loading...</div>');

    assert.equal(dialog.close({ restoreFocus: false }), true);
    const secondOpening = dialog.open();
    const secondModal = harness.document.querySelector('.leaderboard-modal');
    const secondList = secondModal.querySelector('#leaderboard-list');

    pendingReads[0](createSnapshot([{ name: 'Stale closed dialog score', score: 99 }]));
    await firstOpening;
    assert.equal(secondModal.isConnected, true);
    assert.equal(secondList.innerHTML, '<div class="leaderboard-empty" role="status">Loading...</div>');
    assert.equal(secondList.children.length, 0);

    pendingReads[1](createSnapshot([{ name: 'Current dialog score', score: 12 }]));
    await secondOpening;

    assert.match(secondList.children[0].innerHTML, /Current dialog score/);
    assert.doesNotMatch(secondList.children[0].innerHTML, /Stale closed dialog score/);
    dialog.close({ restoreFocus: false });
});

test('Escape closes the dialog and restores focus to the opener', async () => {
    const harness = createDependencies();
    await dialogModule.create(harness.dependencies).open();
    const modal = harness.document.querySelector('.leaderboard-modal');

    harness.escapeHandler();

    assert.equal(modal.isConnected, false);
    assert.equal(harness.document.activeElement, harness.focusedElement);
    assert.equal(harness.focusTrapReleased, true);
});

test('navigation can close the dialog without restoring focus to the hidden opener', async () => {
    const harness = createDependencies();
    const dialog = dialogModule.create(harness.dependencies);
    await dialog.open();
    const modal = harness.document.querySelector('.leaderboard-modal');

    assert.equal(dialog.close({ restoreFocus: false }), true);

    assert.equal(modal.isConnected, false);
    assert.equal(harness.focusTrapReleased, true);
    assert.notStrictEqual(harness.document.activeElement, harness.focusedElement);
    assert.equal(dialog.close({ restoreFocus: false }), false);
});
