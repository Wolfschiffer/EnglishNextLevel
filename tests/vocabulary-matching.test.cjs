const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/vocabulary-matching.js');

function createCard(id, side, locked = false) {
    const classes = new Set([`${side}-item`]);
    if (locked) classes.add('locked');

    return {
        attributes: { 'data-id': String(id) },
        classList: {
            contains: (name) => classes.has(name),
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name),
            toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
        },
        style: { opacity: '1' },
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; },
        closest(selector) {
            const className = selector.slice(1);
            return classes.has(className) ? this : null;
        },
        focus() { this.focused = true; }
    };
}

function createHarness(wordCount = 2) {
    const englishWords = Array.from({ length: wordCount }, (_, index) => ({
        id: index + 1,
        text: `word ${index + 1}`,
        locked: false
    }));
    const portugueseWords = Array.from({ length: wordCount }, (_, index) => ({
        id: index + 1,
        text: `palavra ${index + 1}`,
        locked: false
    }));
    const englishCards = englishWords.map((item) => createCard(item.id, 'english'));
    const portugueseCards = portugueseWords.map((item) => createCard(item.id, 'portuguese'));
    let matchCount = 0;
    let awardCount = 0;
    let finishCount = 0;
    let correctFeedbackCount = 0;
    let wrongSoundCount = 0;
    let renderCount = 0;
    const pronouncedPortugueseIds = [];
    const messages = [];

    function createList(cards) {
        return {
            querySelectorAll(selector) {
                return selector.includes(':not(.locked)')
                    ? cards.filter((card) => !card.classList.contains('locked'))
                    : cards;
            },
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        };
    }

    const api = create({
        window: {},
        document: {
            querySelectorAll(selector) { return selector === '.english-item' ? englishCards : []; }
        },
        englishList: createList(englishCards),
        portugueseList: createList(portugueseCards),
        getEnglishWords: () => englishWords,
        getPortugueseWords: () => portugueseWords,
        getMatchCount: () => matchCount,
        setMatchCount: (value) => { matchCount = value; },
        getGameFinished: () => finishCount > 0,
        showMessage: (message, type) => messages.push({ message, type }),
        playWrongSound: () => { wrongSoundCount += 1; },
        awardPoints: () => { awardCount += 1; },
        finishGame: () => { finishCount += 1; },
        playMatchedPastPronunciation: (portugueseId) => pronouncedPortugueseIds.push(portugueseId),
        renderLists: () => {
            renderCount += 1;
            englishWords.forEach((word) => {
                if (word.locked) englishCards.find((card) => Number(card.getAttribute('data-id')) === word.id)?.classList.add('locked');
            });
            portugueseWords.forEach((word) => {
                if (word.locked) portugueseCards.find((card) => Number(card.getAttribute('data-id')) === word.id)?.classList.add('locked');
            });
        },
        handleCorrectFeedback: () => { correctFeedbackCount += 1; }
    });

    return {
        api,
        englishWords,
        portugueseWords,
        englishCards,
        portugueseCards,
        messages,
        getMatchCount: () => matchCount,
        getAwardCount: () => awardCount,
        getFinishCount: () => finishCount,
        getCorrectFeedbackCount: () => correctFeedbackCount,
        getWrongSoundCount: () => wrongSoundCount,
        getRenderCount: () => renderCount,
        pronouncedPortugueseIds
    };
}

function createDataTransfer() {
    return {
        values: [],
        effectAllowed: '',
        dropEffect: '',
        setData(type, value) { this.values.push([type, value]); }
    };
}

test('desktop drag and drop completes a correct pair and clears drag visuals', () => {
    const harness = createHarness();
    const source = harness.englishCards[0];
    const target = harness.portugueseCards[0];
    const dataTransfer = createDataTransfer();

    harness.api.handleDragStart({ target: source, dataTransfer });
    harness.api.handleDrop({ target, dataTransfer, preventDefault() {} });

    assert.deepEqual(dataTransfer.values, [['text/plain', '1']]);
    assert.equal(dataTransfer.effectAllowed, 'move');
    assert.equal(harness.getMatchCount(), 1);
    assert.equal(harness.getAwardCount(), 1);
    assert.equal(harness.getCorrectFeedbackCount(), 1);
    assert.equal(harness.englishWords.find((item) => item.id === 1).locked, true);
    assert.equal(harness.portugueseWords.find((item) => item.id === 1).locked, true);
    assert.equal(source.style.opacity, '1');
});

test('desktop drag and drop reports a wrong available pair without locking it', () => {
    const harness = createHarness();
    const dataTransfer = createDataTransfer();

    harness.api.handleDragStart({ target: harness.englishCards[0], dataTransfer });
    harness.api.handleDrop({ target: harness.portugueseCards[1], dataTransfer, preventDefault() {} });

    assert.equal(harness.getMatchCount(), 0);
    assert.equal(harness.getAwardCount(), 0);
    assert.equal(harness.getWrongSoundCount(), 1);
    assert.match(harness.messages.at(-1).message, /try again/i);
});

test('desktop drag and drop ignores locked or invalid targets', () => {
    const harness = createHarness();
    const source = harness.englishCards[0];
    const target = harness.portugueseCards[0];
    const dataTransfer = createDataTransfer();
    const invalidTarget = createCard(99, 'other');
    target.classList.add('locked');
    harness.portugueseWords[0].locked = true;

    harness.api.handleDragStart({ target: source, dataTransfer });
    harness.api.handleDrop({ target, dataTransfer, preventDefault() {} });
    harness.api.handleDragStart({ target: source, dataTransfer });
    harness.api.handleDrop({ target: invalidTarget, dataTransfer, preventDefault() {} });

    assert.equal(harness.getMatchCount(), 0);
    assert.equal(harness.getAwardCount(), 0);
    assert.equal(harness.getWrongSoundCount(), 0);
});

test('repeating an already completed pair does not score or finish it twice', () => {
    const harness = createHarness();

    assert.equal(harness.api.completeMatch(1, 1), true);
    assert.equal(harness.api.completeMatch(1, 1), false);

    assert.equal(harness.getMatchCount(), 1);
    assert.equal(harness.getAwardCount(), 1);
    assert.equal(harness.getFinishCount(), 0);
    assert.equal(harness.getCorrectFeedbackCount(), 1);
});

test('matching passes the paired Portuguese ID to the Simple Past pronunciation callback', () => {
    const harness = createHarness();

    assert.equal(harness.api.completeMatch(2, 2), true);

    assert.deepEqual(harness.pronouncedPortugueseIds, [2]);
});

test('completing the final pair finalizes the set exactly once', () => {
    const harness = createHarness();

    assert.equal(harness.api.completeMatch(1, 1), true);
    assert.equal(harness.api.completeMatch(2, 2), true);
    assert.equal(harness.api.completeMatch(2, 2), false);

    assert.equal(harness.getMatchCount(), 2);
    assert.equal(harness.getAwardCount(), 2);
    assert.equal(harness.getFinishCount(), 1);
    assert.equal(harness.getCorrectFeedbackCount(), 2);
    assert.equal(harness.getRenderCount(), 2);
});
