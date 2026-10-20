const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/vocabulary-start-dialog.js');

function createHarness() {
    const overlayClasses = new Set();
    const bodyClasses = new Set();
    const listeners = new Map();
    const trapCalls = [];
    let releaseCount = 0;
    let backCalls = 0;
    const dialogElement = {};
    const overlay = {
        classList: {
            add(name) { overlayClasses.add(name); },
            remove(name) { overlayClasses.delete(name); },
            contains(name) { return overlayClasses.has(name); }
        },
        setAttribute(name, value) { this[name] = String(value); },
        querySelector(selector) { return selector === '[role="dialog"]' ? dialogElement : null; }
    };
    const body = {
        classList: {
            add(name) { bodyClasses.add(name); },
            remove(name) { bodyClasses.delete(name); },
            contains(name) { return bodyClasses.has(name); }
        }
    };
    const startButton = {
        focusCalls: 0,
        focus(options) { this.focusCalls += 1; this.lastFocusOptions = options; }
    };
    const backFocusTarget = {
        isConnected: true,
        visible: false,
        focusCalls: 0,
        focus(options) { this.focusCalls += 1; this.lastFocusOptions = options; },
        getClientRects() { return this.visible ? [{}] : []; }
    };
    const activeWindow = {
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || new Set();
            handlers.add(handler);
            listeners.set(type, handlers);
        },
        removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
        dispatch(type) { [...(listeners.get(type) || [])].forEach((handler) => handler()); },
        listenerCount(type) { return listeners.get(type)?.size || 0; }
    };
    const dialogController = create({
        body,
        overlay,
        startButton,
        activeWindow,
        getBackFocusTarget: () => backFocusTarget,
        getIsOtherModalActive: () => false,
        scheduleFrame(callback) { callback(); },
        focusTrap: {
            trapDialogFocus(receivedDialog, options) {
                trapCalls.push({ dialog: receivedDialog, options });
                options.initialFocus?.focus({ preventScroll: true });
                return () => { releaseCount += 1; };
            }
        },
        onBack() { backCalls += 1; return true; }
    });

    return {
        dialogController,
        overlay,
        overlayClasses,
        bodyClasses,
        dialogElement,
        startButton,
        backFocusTarget,
        activeWindow,
        trapCalls,
        releaseCount: () => releaseCount,
        backCalls: () => backCalls
    };
}

test('Vocabulary start dialog traps focus on START and releases it when hidden', () => {
    const harness = createHarness();

    assert.equal(harness.dialogController.show(), true);
    assert.equal(harness.overlayClasses.has('active'), true);
    assert.equal(harness.overlay['aria-hidden'], 'false');
    assert.equal(harness.bodyClasses.has('vocab-modal-open'), true);
    assert.equal(harness.trapCalls.length, 1);
    assert.strictEqual(harness.trapCalls[0].dialog, harness.dialogElement);
    assert.strictEqual(harness.trapCalls[0].options.initialFocus, harness.startButton);
    assert.equal(harness.startButton.focusCalls, 1);

    harness.dialogController.hide({ preserveReturnFocus: false });

    assert.equal(harness.overlayClasses.has('active'), false);
    assert.equal(harness.overlay['aria-hidden'], 'true');
    assert.equal(harness.bodyClasses.has('vocab-modal-open'), false);
    assert.equal(harness.releaseCount(), 1);
    assert.equal(harness.activeWindow.listenerCount('popstate'), 0);
});

test('Escape closes the Vocabulary start dialog and returns focus after back navigation', () => {
    const harness = createHarness();
    harness.dialogController.show();

    harness.trapCalls[0].options.onEscape();

    assert.equal(harness.overlay['aria-hidden'], 'true');
    assert.equal(harness.releaseCount(), 1);
    assert.equal(harness.backCalls(), 1);
    assert.equal(harness.backFocusTarget.focusCalls, 0);
    harness.backFocusTarget.visible = true;
    harness.activeWindow.dispatch('popstate');

    assert.equal(harness.backFocusTarget.focusCalls, 1);
    assert.deepEqual(harness.backFocusTarget.lastFocusOptions, { preventScroll: true });
    assert.equal(harness.activeWindow.listenerCount('popstate'), 0);
});

test('Browser Back preserves the Vocabulary focus return until the destination appears', () => {
    const harness = createHarness();
    harness.dialogController.show();
    harness.dialogController.hide();

    harness.backFocusTarget.visible = true;
    harness.activeWindow.dispatch('popstate');

    assert.equal(harness.backFocusTarget.focusCalls, 1);
    assert.equal(harness.activeWindow.listenerCount('popstate'), 0);
});

test('a hidden Vocabulary destination removes the focus listener on the first popstate', () => {
    const harness = createHarness();
    harness.dialogController.show();
    harness.dialogController.hide();
    harness.activeWindow.dispatch('popstate');

    harness.backFocusTarget.visible = true;
    harness.activeWindow.dispatch('popstate');

    assert.equal(harness.backFocusTarget.focusCalls, 0);
    assert.equal(harness.activeWindow.listenerCount('popstate'), 0);
});
