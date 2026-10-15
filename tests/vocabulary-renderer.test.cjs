const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/vocabulary-renderer.js'), 'utf8');

class FakeElement {
    constructor() {
        this.children = [];
        this.attributes = new Map();
        this.listeners = new Map();
        this.style = {};
        this._classes = new Set();
        this.textContent = '';
        this.classList = {
            add: (...names) => names.forEach(name => this._classes.add(name)),
            remove: (...names) => names.forEach(name => this._classes.delete(name)),
            contains: name => this._classes.has(name)
        };
    }

    set className(value) { this._classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this._classes].join(' '); }
    set innerHTML(_value) { this.children = []; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    addEventListener(type, handler, options) {
        const handlers = this.listeners.get(type) || [];
        handlers.push({ handler, options });
        this.listeners.set(type, handlers);
    }
    appendChild(child) { this.children.push(child); return child; }
}

function createHarness({ gameType = 'past' } = {}) {
    const englishList = new FakeElement();
    const portugueseList = new FakeElement();
    const document = {
        createElement: () => new FakeElement(),
        querySelectorAll(selector) {
            assert.equal(selector, '.english-item');
            return englishList.children.filter(element => element.classList.contains('english-item'));
        }
    };
    const keyboardCards = [];
    const pronunciationCards = [];
    const touchInput = {
        handleTouchStart() {},
        handleTouchMove() {},
        handleTouchEnd() {},
        handleTouchCancel() {}
    };
    const context = vm.createContext({ window: {} });
    vm.runInContext(source, context);
    const renderer = context.window.EnglishNextLevelVocabularyRenderer;
    return {
        englishList,
        portugueseList,
        keyboardCards,
        pronunciationCards,
        touchInput,
        renderer: renderer.create({
            document,
            englishList,
            portugueseList,
            getEnglishWords: () => [
                { id: 1, text: 'run', locked: false },
                { id: 2, text: 'go', locked: true }
            ],
            getPortugueseWords: () => [
                { id: 10, text: 'correu', locked: false },
                { id: 11, text: 'foi', locked: true }
            ],
            getGameType: () => gameType,
            createAudioButton(text, context, position) {
                const button = new FakeElement();
                button.audio = { text, context, position };
                return button;
            },
            addCardPronunciation(element, text, context) {
                pronunciationCards.push({ element, text, context });
            },
            setupKeyboardCard(element, side, id) {
                keyboardCards.push({ element, side, id });
            },
            handleDragStart() {},
            handleDragEnd() {},
            handleDragOver() {},
            handleDrop() {},
            touchInput
        })
    };
}

test('renders locked cards first and keeps drag, touch, keyboard, and audio handlers on the right cards', () => {
    const harness = createHarness();
    harness.renderer.render();

    const [lockedEnglish, activeEnglish] = harness.englishList.children;
    const [lockedPortuguese, activePortuguese] = harness.portugueseList.children;
    assert.equal(lockedEnglish.children[0].textContent, 'go');
    assert.equal(lockedPortuguese.children[1].textContent, 'foi');
    assert.equal(lockedEnglish.classList.contains('locked'), true);
    assert.equal(lockedEnglish.listeners.has('dragstart'), false);
    assert.equal(lockedEnglish.children[1].audio.context, 'english');
    assert.equal(activeEnglish.listeners.has('dragstart'), true);
    assert.equal(activeEnglish.listeners.has('touchstart'), true);
    assert.equal(activeEnglish.listeners.get('touchstart')[0].options.passive, false);
    assert.equal(activeEnglish.listeners.get('touchcancel')[0].handler, harness.touchInput.handleTouchCancel);
    assert.equal(activePortuguese.listeners.has('drop'), true);
    assert.deepEqual(harness.keyboardCards.map(({ side }) => side), ['english', 'portuguese']);
    assert.ok(harness.pronunciationCards.some(({ text, context }) => text === 'run' && context === 'english'));
    assert.ok(harness.pronunciationCards.some(({ text, context }) => text === 'foi' && context === 'past'));
    assert.equal(lockedPortuguese.classList.contains('has-audio'), true);
    assert.equal(lockedPortuguese.children[0].audio.context, 'past');
});

test('does not add pronunciation to translated Portuguese cards in present mode', () => {
    const harness = createHarness({ gameType: 'present' });
    harness.renderer.render();

    const [lockedPortuguese] = harness.portugueseList.children;
    assert.equal(lockedPortuguese.classList.contains('no-audio'), true);
    assert.equal(lockedPortuguese.classList.contains('has-audio'), false);
    assert.equal(harness.pronunciationCards.some(({ context }) => context === 'past'), false);
});
