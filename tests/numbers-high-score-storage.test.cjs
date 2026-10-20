const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const modeIds = ['numbers', 'numbers11-20', 'tens'];

function loadStorage() {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const scriptPaths = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
    const storageIndex = scriptPaths.indexOf('js/numbers-high-score-storage.js');
    const profileIndex = scriptPaths.indexOf('js/numbers-high-score-profile.js');
    const gameIndex = scriptPaths.indexOf('js/numbers-game.js');

    assert.notEqual(storageIndex, -1, 'index should load the Numbers high-score storage module');
    assert.notEqual(profileIndex, -1, 'index should load the Numbers high-score profile module');
    assert.ok(storageIndex < profileIndex, 'high-score storage must load before profile selection');
    assert.ok(profileIndex < gameIndex, 'high-score profile must load before the Numbers game');

    const context = vm.createContext({ window: {}, console });
    const source = fs.readFileSync(path.join(root, 'js/numbers-high-score-storage.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'numbers-high-score-storage.js' });
    return context.window.EnglishNextLevelNumbersHighScoreStorage;
}

function createStorage(initial = null, { failRead = false, failWrite = false } = {}) {
    let value = initial;
    return {
        getItem() {
            if (failRead) throw new Error('read denied');
            return value;
        },
        setItem(_key, nextValue) {
            if (failWrite) throw new Error('write denied');
            value = String(nextValue);
        },
        get value() { return value; }
    };
}

test('Numbers high-score storage creates one zero score per supported mode', () => {
    const { createEmptyScores } = loadStorage();
    assert.deepEqual({ ...createEmptyScores(modeIds) }, {
        numbers: 0,
        'numbers11-20': 0,
        tens: 0
    });
});

test('Numbers high-score storage reads only supported modes and normalizes scores', () => {
    const { loadScores } = loadStorage();
    const storage = createStorage(JSON.stringify({
        numbers: '12.8',
        'numbers11-20': -4,
        tens: 'bad',
        unknown: 900
    }));

    assert.deepEqual({ ...loadScores(storage, 'scores', modeIds) }, {
        numbers: 12,
        'numbers11-20': 0,
        tens: 0
    });
});

test('Numbers high-score storage recovers from malformed or unavailable local data', () => {
    const { loadScores } = loadStorage();
    const warnings = [];
    const logger = { warn(message) { warnings.push(message); } };

    assert.deepEqual({ ...loadScores(() => createStorage('{broken'), 'scores', modeIds, logger) }, {
        numbers: 0,
        'numbers11-20': 0,
        tens: 0
    });
    assert.deepEqual({ ...loadScores(() => createStorage(null, { failRead: true }), 'scores', modeIds, logger) }, {
        numbers: 0,
        'numbers11-20': 0,
        tens: 0
    });
    assert.deepEqual({ ...loadScores(() => { throw new Error('storage blocked'); }, 'scores', modeIds, logger) }, {
        numbers: 0,
        'numbers11-20': 0,
        tens: 0
    });
    assert.equal(warnings.length, 3);
});

test('Numbers high-score storage reports whether saving succeeded', () => {
    const { saveScores } = loadStorage();
    const value = { numbers: 42 };
    const storage = createStorage();

    assert.equal(saveScores(() => storage, 'scores', value), true);
    assert.equal(storage.value, JSON.stringify(value));
    assert.equal(saveScores(() => createStorage(null, { failWrite: true }), 'scores', value, { warn() {} }), false);
    assert.equal(saveScores(() => { throw new Error('storage blocked'); }, 'scores', value, { warn() {} }), false);
});
