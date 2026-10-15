const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const setNames = [
    ...Array.from({ length: 10 }, (_, index) => `Verbs${index + 1}`),
    ...Array.from({ length: 10 }, (_, index) => `Past${index + 1}`)
];

function loadVocabularySets() {
    const source = fs.readFileSync(path.join(projectRoot, 'js/words-data.js'), 'utf8');
    const context = {};
    const exports = setNames.map((name) => `vocabularyData${name}`);

    vm.runInNewContext(
        `${source}\nglobalThis.vocabularySets = [${exports.join(', ')}];\nglobalThis.vocabularyModes = vocabularyGameModes;`,
        context
    );
    return JSON.parse(JSON.stringify({ sets: context.vocabularySets, modes: context.vocabularyModes }));
}

test('Words data contains ten complete verb and ten complete past-tense sets', () => {
    const { sets } = loadVocabularySets();

    assert.equal(sets.length, 20);
    for (const [setIndex, set] of sets.entries()) {
        assert.equal(set.length, 10, `${setNames[setIndex]} should contain ten words`);

        for (const [wordIndex, word] of set.entries()) {
            assert.equal(word.id, wordIndex, `${setNames[setIndex]} word IDs should be sequential`);
            assert.equal(typeof word.english, 'string');
            assert.ok(word.english.trim(), `${setNames[setIndex]} should have an English word`);
            assert.equal(typeof word.portuguese, 'string');
            assert.ok(word.portuguese.trim(), `${setNames[setIndex]} should have a translation`);
        }
    }
});

test('each simple-past set stays aligned with its corresponding verb set', () => {
    const { sets } = loadVocabularySets();

    for (let index = 0; index < 10; index += 1) {
        const verbs = sets[index];
        const past = sets[index + 10];

        assert.deepEqual(
            past.map(({ id, english }) => ({ id, english })),
            verbs.map(({ id, english }) => ({ id, english })),
            `${setNames[index + 10]} must match ${setNames[index]} by word and order`
        );
    }
});

test('all twenty Words menu modes point to the matching data set and game type', () => {
    const { sets, modes } = loadVocabularySets();
    const modeNames = Object.keys(modes);

    assert.equal(modeNames.length, 20);
    for (let index = 0; index < 10; index += 1) {
        assert.equal(modes[`verbs${index + 1}`].type, 'present');
        assert.deepEqual(modes[`verbs${index + 1}`].data, sets[index]);
        assert.equal(modes[`past${index + 1}`].type, 'past');
        assert.deepEqual(modes[`past${index + 1}`].data, sets[index + 10]);
    }
});

test('index loads vocabulary data before the Words module and game logic', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    const dataScript = html.indexOf('<script src="js/words-data.js"></script>');
    const vocabularyScript = html.indexOf('<script src="js/vocabulary-game.js"></script>');
    const gameScript = html.indexOf('<script src="js/game.js"></script>');

    assert.notEqual(dataScript, -1, 'index should load words-data.js');
    assert.notEqual(vocabularyScript, -1, 'index should load vocabulary-game.js');
    assert.notEqual(gameScript, -1, 'index should load game.js');
    assert.ok(dataScript < vocabularyScript, 'words-data.js must load before vocabulary-game.js');
    assert.ok(vocabularyScript < gameScript, 'vocabulary-game.js must load before game.js');
});

test('all twenty Words menu cards have a data mode for JavaScript activation', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    const cardModes = [...html.matchAll(/class="game-card" data-words-mode="([^"]+)"/g)]
        .map((match) => match[1]);
    const expectedModes = [
        ...Array.from({ length: 10 }, (_, index) => `verbs${index + 1}`),
        ...Array.from({ length: 10 }, (_, index) => `past${index + 1}`)
    ];

    assert.deepEqual(cardModes, expectedModes);
});
