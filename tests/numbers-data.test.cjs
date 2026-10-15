const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getNumberPool } = require('../functions/numbers-run');

const root = path.join(__dirname, '..');

function loadNumbersData() {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const scriptPaths = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
    const dataIndex = scriptPaths.indexOf('js/numbers-data.js');
    const gameIndex = scriptPaths.indexOf('js/numbers-game.js');

    assert.notEqual(dataIndex, -1, 'index should load the Numbers data module');
    assert.ok(dataIndex < gameIndex, 'Numbers data must load before the Numbers game');

    const context = vm.createContext({
        window: { enlDebug() {} }
    });
    const source = fs.readFileSync(path.join(root, 'js/numbers-data.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'numbers-data.js' });

    return context.window.EnglishNextLevelNumbersData;
}

test('browser number pools match the server ranges', () => {
    const { gameData } = loadNumbersData();

    for (const [dataKey, mode] of [
        ['random21_99', 'random21_99'],
        ['random101_999', 'random101_999'],
        ['random1001_9999', 'random1001_9999']
    ]) {
        const actual = Array.from(gameData[dataKey], number => number.value).sort((a, b) => a - b);
        assert.deepEqual(actual, getNumberPool(mode), mode);
    }

    assert.ok(gameData.random1001_9999.every(number => number.value >= 1001 && number.value <= 9999));
    assert.ok(gameData.random1001_9999.some(number => number.value === 2000));
});

test('Mixed uses a unique pool and samples only supported numbers', () => {
    const { gameData, getMixedAdvancedPool } = loadNumbersData();
    const pool = getMixedAdvancedPool();
    const values = pool.map(number => number.value);
    const componentModes = [
        'numbers', 'numbers11-20', 'tens', 'random21_99', 'hundreds',
        'random101_999', 'thousands', 'random1001_9999'
    ];
    const expected = [...new Set(componentModes.flatMap(getNumberPool))].sort((a, b) => a - b);

    assert.equal(new Set(values).size, values.length);
    assert.deepEqual([...values].sort((a, b) => a - b), expected);
    assert.equal(gameData.mixedAdvanced.length, 50);
    assert.equal(new Set(gameData.mixedAdvanced.map(number => number.value)).size, 50);
    assert.ok(gameData.mixedAdvanced.every(number => expected.includes(number.value)));
});
