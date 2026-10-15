const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadKeyboardAccessibility(cards, activeDocument = {}) {
    const source = fs.readFileSync(path.join(__dirname, '../js/keyboard-accessibility.js'), 'utf8');
    const window = {};
    activeDocument.querySelectorAll = (selector) => {
        assert.equal(selector, '.game-card[data-numbers-mode], .game-card[data-words-mode]');
        return cards;
    };
    vm.runInNewContext(source, {
        window,
        document: activeDocument
    });
    return window;
}

function createCard() {
    return {
        attributes: {},
        listeners: {},
        clickCount: 0,
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        addEventListener(type, listener) {
            this.listeners[type] = listener;
        },
        click() {
            this.clickCount += 1;
        }
    };
}

test('game cards expose button semantics and activate by keyboard once', () => {
    const card = createCard();
    loadKeyboardAccessibility([card]);

    assert.equal(card.attributes.role, 'button');
    assert.equal(card.tabIndex, 0);

    let prevented = false;
    card.listeners.keydown({
        key: 'Enter',
        repeat: false,
        preventDefault() { prevented = true; }
    });
    assert.equal(prevented, true);
    assert.equal(card.clickCount, 1);

    card.listeners.keydown({ key: 'Enter', repeat: true, preventDefault() {} });
    assert.equal(card.clickCount, 1);

    card.listeners.keydown({ key: ' ', repeat: false, preventDefault() {} });
    assert.equal(card.clickCount, 1);
    card.listeners.keydown({ key: ' ', repeat: true, preventDefault() {} });
    card.listeners.keyup({ key: ' ', preventDefault() {} });
    assert.equal(card.clickCount, 2);

    card.listeners.keydown({ key: ' ', repeat: false, preventDefault() {} });
    card.listeners.blur();
    card.listeners.keyup({ key: ' ', preventDefault() {} });
    assert.equal(card.clickCount, 2);

    card.listeners.keydown({ key: 'Tab', preventDefault() { assert.fail('Tab should not be handled'); } });
    assert.equal(card.clickCount, 2);
});

test('shared button helper activates callbacks once with Enter and Space', () => {
    const window = loadKeyboardAccessibility([]);
    const card = createCard();
    let activationCount = 0;
    window.EnlKeyboardAccessibility.makeButton(card, () => { activationCount += 1; });

    assert.equal(card.attributes.role, 'button');
    assert.equal(card.tabIndex, 0);

    card.listeners.keydown({ key: 'Enter', repeat: false, preventDefault() {} });
    card.listeners.keydown({ key: 'Enter', repeat: true, preventDefault() {} });
    assert.equal(activationCount, 1);

    card.listeners.keydown({ key: ' ', repeat: false, preventDefault() {} });
    card.listeners.keydown({ key: ' ', repeat: true, preventDefault() {} });
    card.listeners.keyup({ key: ' ', preventDefault() {} });
    assert.equal(activationCount, 2);
});

test('dialog focus trap starts inside, wraps with Tab, and closes on Escape', () => {
    const document = { activeElement: null };
    const first = createFocusableElement('close', document);
    const last = createFocusableElement('last-tab', document);
    const dialog = createDialog([first, last], document);
    const { trapDialogFocus } = loadKeyboardAccessibility([], document).EnlKeyboardAccessibility;
    let escapeCount = 0;

    const cleanup = trapDialogFocus(dialog, {
        initialFocus: first,
        onEscape: () => { escapeCount += 1; }
    });

    assert.equal(document.activeElement, first);

    let prevented = false;
    dialog.listeners.keydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(document.activeElement, last);

    dialog.listeners.keydown({ key: 'Tab', shiftKey: false, preventDefault() {} });
    assert.equal(document.activeElement, first);

    let escapePrevented = false;
    dialog.listeners.keydown({ key: 'Escape', preventDefault() { escapePrevented = true; } });
    assert.equal(escapePrevented, true);
    assert.equal(escapeCount, 1);

    cleanup();
    assert.equal(dialog.listeners.keydown, undefined);
});

function createFocusableElement(name, document) {
    return {
        name,
        disabled: false,
        hidden: false,
        attributes: {},
        getAttribute(attribute) { return this.attributes[attribute] || null; },
        getClientRects() { return [1]; },
        focus() { document.activeElement = this; }
    };
}

function createDialog(elements, document) {
    return {
        attributes: {},
        listeners: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
        addEventListener(type, callback) { this.listeners[type] = callback; },
        removeEventListener(type) { delete this.listeners[type]; },
        querySelectorAll() { return elements; },
        contains(element) { return element === this || elements.includes(element); },
        focus() { document.activeElement = this; }
    };
}
