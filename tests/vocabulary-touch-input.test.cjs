const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/vocabulary-touch-input.js');

function createClassList(initial = []) {
    const classes = new Set(initial);
    return {
        add(...names) { names.forEach((name) => classes.add(name)); },
        remove(...names) { names.forEach((name) => classes.delete(name)); },
        contains(name) { return classes.has(name); },
        values() { return [...classes]; }
    };
}

function createItem(classNames, id) {
    const classes = createClassList(classNames);
    return {
        attributes: new Map([['data-id', String(id)]]),
        classList: classes,
        style: {},
        offsetWidth: 120,
        getAttribute(name) { return this.attributes.get(name) ?? null; },
        closest(selector) { return selector === '.english-item' && classes.contains('english-item') ? this : null; },
        cloneNode() {
            const clone = { style: {}, removed: false, remove() { this.removed = true; } };
            return clone;
        }
    };
}

function createHarness() {
    const englishItems = [];
    const bodyClasses = createClassList();
    const clones = [];
    let elementsUnderPoint = [];
    const document = {
        body: {
            classList: bodyClasses,
            appendChild(element) { clones.push(element); }
        },
        querySelectorAll(selector) { return selector === '.english-item' ? englishItems : []; },
        elementsFromPoint() { return elementsUnderPoint; }
    };
    const completedMatches = [];
    const input = create({
        document,
        onCompleteMatch(englishId, portugueseId) {
            completedMatches.push([englishId, portugueseId]);
        }
    });

    function start(source, x = 20, y = 30) {
        input.handleTouchStart({
            cancelable: true,
            preventDefault() {},
            target: source,
            touches: [{ clientX: x, clientY: y }]
        });
    }

    function end(target, x = 40, y = 50) {
        elementsUnderPoint = target ? [target] : [];
        input.handleTouchEnd({
            cancelable: true,
            preventDefault() {},
            changedTouches: [{ clientX: x, clientY: y }]
        });
    }

    return {
        bodyClasses,
        clones,
        completedMatches,
        englishItems,
        end,
        input,
        setElementsUnderPoint(items) { elementsUnderPoint = items; },
        start
    };
}

test('touch start creates a pointer-following clone and marks the source as dragging', () => {
    const harness = createHarness();
    const source = createItem(['english-item'], 7);
    harness.englishItems.push(source);

    harness.start(source, 100, 200);

    assert.equal(source.style.opacity, '0.5');
    assert.equal(source.classList.contains('dragging-source'), true);
    assert.equal(harness.clones.length, 1);
    assert.equal(harness.clones[0].style.left, '50px');
    assert.equal(harness.clones[0].style.top, '180px');
    assert.equal(harness.bodyClasses.contains('dragging'), true);
});

test('touch move highlights an available English card under the pointer', () => {
    const harness = createHarness();
    const source = createItem(['english-item'], 1);
    const target = createItem(['english-item'], 2);
    harness.englishItems.push(source, target);
    harness.start(source);
    harness.setElementsUnderPoint([target]);

    harness.input.handleTouchMove({
        cancelable: true,
        preventDefault() {},
        touches: [{ clientX: 80, clientY: 90 }]
    });

    assert.equal(harness.clones[0].style.left, '30px');
    assert.equal(harness.clones[0].style.top, '70px');
    assert.equal(target.classList.contains('drag-over'), true);
    assert.equal(target.style.backgroundColor, '#c9a13b');
});

test('touch end sends numeric IDs for an available Portuguese match and clears drag state', () => {
    const harness = createHarness();
    const source = createItem(['english-item'], 17);
    const target = createItem(['portuguese-item'], 17);
    harness.englishItems.push(source);
    harness.start(source);
    harness.end(target);

    assert.deepEqual(harness.completedMatches, [[17, 17]]);
    assert.equal(harness.clones[0].removed, true);
    assert.equal(source.classList.contains('dragging-source'), false);
    assert.equal(source.style.opacity, '');
    assert.equal(harness.bodyClasses.contains('dragging'), false);
});

test('touch end without a target or on a locked Portuguese card cancels without matching', () => {
    for (const target of [null, createItem(['portuguese-item', 'locked'], 3)]) {
        const harness = createHarness();
        const source = createItem(['english-item'], 3);
        harness.englishItems.push(source);
        harness.start(source);
        harness.end(target);

        assert.deepEqual(harness.completedMatches, []);
        assert.equal(harness.clones[0].removed, true);
        assert.equal(harness.bodyClasses.contains('dragging'), false);
    }
});

test('locked sources and reset during a drag leave no active touch state', () => {
    const lockedHarness = createHarness();
    const lockedSource = createItem(['english-item', 'locked'], 4);
    lockedHarness.start(lockedSource);
    assert.equal(lockedHarness.clones.length, 0);
    assert.equal(lockedHarness.bodyClasses.contains('dragging'), false);

    const harness = createHarness();
    const source = createItem(['english-item'], 5);
    harness.englishItems.push(source);
    harness.start(source);
    harness.input.reset();

    assert.equal(harness.clones[0].removed, true);
    assert.equal(source.classList.contains('dragging-source'), false);
    assert.equal(harness.bodyClasses.contains('dragging'), false);
    harness.end(createItem(['portuguese-item'], 5));
    assert.deepEqual(harness.completedMatches, []);
});

test('touch cancel clears the clone and drag visuals without completing a match', () => {
    const harness = createHarness();
    const source = createItem(['english-item'], 6);
    harness.englishItems.push(source);
    harness.start(source);

    harness.input.handleTouchCancel();

    assert.equal(harness.clones[0].removed, true);
    assert.equal(source.classList.contains('dragging-source'), false);
    assert.equal(source.style.opacity, '');
    assert.equal(harness.bodyClasses.contains('dragging'), false);
    assert.deepEqual(harness.completedMatches, []);
});
