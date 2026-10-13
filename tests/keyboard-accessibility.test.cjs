const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadKeyboardAccessibility(cards) {
    const source = fs.readFileSync(path.join(__dirname, '../js/keyboard-accessibility.js'), 'utf8');
    vm.runInNewContext(source, {
        document: {
            querySelectorAll(selector) {
                assert.equal(selector, '.game-card[onclick]');
                return cards;
            }
        }
    });
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
