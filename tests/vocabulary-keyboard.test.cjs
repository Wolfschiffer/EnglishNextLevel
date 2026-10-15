const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create } = require('../js/vocabulary-matching.js');

function contrastRatio(foreground, background) {
    function luminance(hex) {
        const channels = hex.match(/[\da-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
        const [red, green, blue] = channels.map((channel) => channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4);
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }

    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
}

function createCard(id, side) {
    const classes = new Set([`${side}-item`]);
    return {
        attributes: { 'data-id': String(id) },
        classes,
        focused: false,
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; },
        classList: {
            contains: (name) => classes.has(name),
            toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
            add: (name) => classes.add(name),
            remove: (name) => classes.delete(name)
        },
        focus() { this.focused = true; }
    };
}

function createHarness(ids = [1, 2]) {
    const englishWords = ids.map((id) => ({ id, text: id === 1 ? 'to work' : `word ${id}`, locked: false }));
    const portugueseWords = ids.map((id) => ({ id, text: id === 1 ? 'trabalhar' : `palavra ${id}`, locked: false }));
    const englishCards = ids.map((id) => createCard(id, 'english'));
    const portugueseCards = ids.map((id) => createCard(id, 'portuguese'));
    const messages = [];
    const wrongSounds = [];
    let matchCount = 0;
    let gameFinished = false;
    let awardCount = 0;
    let renderCount = 0;
    let feedbackCount = 0;

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

    const englishList = createList(englishCards);
    const portugueseList = createList(portugueseCards);
    const document = {
        querySelectorAll(selector) {
            return selector === '.english-item' ? englishCards : [];
        }
    };
    const window = {
        EnlKeyboardAccessibility: {
            makeButton(element, onActivate) {
                element.setAttribute('role', 'button');
                element.tabIndex = 0;
                element.activate = onActivate;
            }
        }
    };
    const api = create({
        window,
        document,
        englishList,
        portugueseList,
        getEnglishWords: () => englishWords,
        getPortugueseWords: () => portugueseWords,
        getMatchCount: () => matchCount,
        setMatchCount: (value) => { matchCount = value; },
        getGameFinished: () => gameFinished,
        showMessage: (message, type) => messages.push({ message, type }),
        playWrongSound: () => wrongSounds.push('wrong'),
        awardPoints: () => { awardCount += 1; },
        finishGame: () => { gameFinished = true; },
        renderLists: () => {
            renderCount += 1;
            englishWords.forEach((word) => {
                const card = englishCards.find((candidate) => Number(candidate.getAttribute('data-id')) === word.id);
                if (word.locked) card.classList.add('locked');
            });
            portugueseWords.forEach((word) => {
                const card = portugueseCards.find((candidate) => Number(candidate.getAttribute('data-id')) === word.id);
                if (word.locked) card.classList.add('locked');
            });
        },
        handleCorrectFeedback: () => { feedbackCount += 1; }
    });

    return {
        api,
        englishWords,
        portugueseWords,
        englishCards,
        portugueseCards,
        messages,
        wrongSounds,
        getMatchCount: () => matchCount,
        getAwardCount: () => awardCount,
        getRenderCount: () => renderCount,
        getFeedbackCount: () => feedbackCount
    };
}

test('keyboard matching selects a source word and moves focus to the answer column', () => {
    const harness = createHarness();
    const sourceCard = harness.englishCards[0];
    const targetCard = harness.portugueseCards[0];

    harness.api.setupKeyboardCard(sourceCard, 'english', 1);
    sourceCard.activate();

    assert.equal(harness.api.getSelectedEnglishId(), 1);
    assert.equal(sourceCard.attributes['aria-pressed'], 'true');
    assert.equal(sourceCard.classes.has('selected'), true);
    assert.equal(targetCard.focused, true);
    assert.match(harness.messages[0].message, /to work selected/i);
});

test('keyboard matching reports wrong pairs and completes correct pairs', () => {
    const harness = createHarness();
    const sourceCard = harness.englishCards[0];
    const nextSourceCard = harness.englishCards[1];
    harness.api.setupKeyboardCard(sourceCard, 'english', 1);
    harness.api.setupKeyboardCard(harness.portugueseCards[0], 'portuguese', 1);

    sourceCard.activate();
    harness.api.handleKeyboardActivation('portuguese', 2);
    assert.equal(harness.api.getSelectedEnglishId(), 1, 'the selected source stays active after a wrong answer');
    assert.match(harness.messages.at(-1).message, /try again/i);
    assert.equal(harness.getMatchCount(), 0);

    harness.api.handleKeyboardActivation('portuguese', 1);
    assert.equal(harness.api.getSelectedEnglishId(), null);
    assert.equal(sourceCard.attributes['aria-pressed'], 'false');
    assert.equal(harness.getMatchCount(), 1);
    assert.equal(sourceCard.classList.contains('locked'), true);
    assert.equal(nextSourceCard.focused, true, 'focus moves to the next available source after a match');
});

test('keyboard matching asks for a source word before accepting an answer', () => {
    const harness = createHarness();

    harness.api.handleKeyboardActivation('portuguese', 1);

    assert.match(harness.messages[0].message, /select an english word first/i);
    assert.equal(harness.getMatchCount(), 0);
});

test('pointer matching does not move keyboard focus after a correct pair', () => {
    const harness = createHarness();

    harness.api.completeMatch(1, 1);

    assert.equal(harness.getMatchCount(), 1);
    assert.equal(harness.englishCards[0].focused, false);
});

test('index loads the Words matching module before the Words game', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    const matchingScript = html.indexOf('<script src="js/vocabulary-matching.js"></script>');
    const vocabularyScript = html.indexOf('<script src="js/vocabulary-game.js"></script>');

    assert.notEqual(matchingScript, -1);
    assert.notEqual(vocabularyScript, -1);
    assert.ok(matchingScript < vocabularyScript);
});

test('selected vocabulary cards keep readable contrast when hovered', () => {
    const css = fs.readFileSync(path.join(__dirname, '../css/words-game.css'), 'utf8');
    const selectedRule = css.match(/\.english-item\[aria-pressed="true"\]\s*\{([^}]*)\}/);
    const hoverRule = css.match(/\.english-item\[aria-pressed="true"\]:hover\s*\{([^}]*)\}/);
    assert.ok(selectedRule, 'selected cards should have a dedicated visual style');
    assert.ok(hoverRule, 'hover should preserve the selected card style');

    const selectedForeground = selectedRule[1].match(/(?:^|[;\n])\s*color:\s*(#[\da-f]{6})/i)?.[1];
    const selectedBackground = selectedRule[1].match(/(?:^|[;\n])\s*background:\s*(#[\da-f]{6})/i)?.[1];
    const hoverForeground = hoverRule[1].match(/(?:^|[;\n])\s*color:\s*(#[\da-f]{6})/i)?.[1];
    const hoverBackground = hoverRule[1].match(/(?:^|[;\n])\s*background:\s*(#[\da-f]{6})/i)?.[1];

    assert.ok(selectedForeground && selectedBackground);
    assert.ok(hoverForeground && hoverBackground);
    assert.ok(contrastRatio(selectedForeground, selectedBackground) >= 4.5);
    assert.ok(contrastRatio(hoverForeground, hoverBackground) >= 4.5);
});
