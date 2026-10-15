const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function createClassList() {
    const classes = new Set();
    return {
        add(...names) { names.forEach(name => classes.add(name)); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        contains(name) { return classes.has(name); },
        values() { return [...classes]; }
    };
}

function loadFeedback({ element = true } = {}) {
    const title = { textContent: '' };
    const copy = { textContent: '' };
    const classes = createClassList();
    const feedback = {
        classList: classes,
        offsetWidth: 0,
        querySelector(selector) {
            if (selector === '.phase5-round-feedback-title') return title;
            if (selector === '.phase5-round-feedback-copy') return copy;
            return null;
        }
    };
    const timers = new Map();
    let nextTimerId = 0;
    const document = {
        getElementById(id) {
            return id === 'numbers-round-feedback' && element ? feedback : null;
        }
    };
    const context = vm.createContext({ window: {} });
    const source = fs.readFileSync(path.join(ROOT, 'js/numbers-round-feedback.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'numbers-round-feedback.js' });
    const module = context.window.EnglishNextLevelNumbersRoundFeedback;
    const api = module.create({
        document,
        duration: 950,
        scheduleTimeout(callback, delay) {
            const id = nextTimerId++;
            timers.set(id, { callback, delay, cancelled: false });
            return id;
        },
        cancelTimeout(id) {
            const timer = timers.get(id);
            if (timer) timer.cancelled = true;
        }
    });

    return { api, classes, copy, feedback, timers, title };
}

test('successful answer feedback shows the score and hides after its timer', () => {
    const { api, classes, copy, timers, title } = loadFeedback();

    api.showScore(245, 2.0);

    assert.equal(title.textContent, '+245');
    assert.equal(copy.textContent, 'Excellent');
    assert.equal(classes.contains('is-success'), true);
    assert.equal(classes.contains('is-visible'), true);
    assert.equal([...timers.values()][0].delay, 950);

    [...timers.values()][0].callback();
    assert.equal(classes.contains('is-visible'), false);
    assert.equal(classes.contains('is-success'), true);
});

test('incorrect answer feedback shows the retry message and error style', () => {
    const { api, classes, copy, title } = loadFeedback();

    api.showWrong();

    assert.equal(title.textContent, 'Try again');
    assert.equal(copy.textContent, 'Choose another number');
    assert.equal(classes.contains('is-error'), true);
    assert.equal(classes.contains('is-success'), false);
    assert.equal(classes.contains('is-visible'), true);
});

test('a new feedback message cancels the previous timer and replaces its content', () => {
    const { api, classes, timers, title } = loadFeedback();

    api.showScore(100, 1.0);
    const oldTimer = timers.get(0);
    api.showWrong();

    assert.equal(oldTimer.cancelled, true);
    assert.equal(title.textContent, 'Try again');
    assert.equal(classes.contains('is-error'), true);
    assert.equal([...timers.values()].filter(timer => !timer.cancelled).length, 1);
});

test('clear cancels the active timer and removes feedback classes', () => {
    const { api, classes, timers } = loadFeedback();

    api.showWrong();
    api.clear();

    assert.equal(timers.get(0).cancelled, true);
    assert.deepEqual(classes.values(), []);
});

test('score feedback retains all speed-message thresholds', () => {
    const { api, copy } = loadFeedback();

    for (const [bonus, expected] of [
        [1.8, 'Great'],
        [1.5, 'Good'],
        [1.2, 'Keep going'],
        [1.81, 'Excellent'],
        [1.51, 'Great'],
        [1.21, 'Good']
    ]) {
        api.showScore(100, bonus);
        assert.equal(copy.textContent, expected, `bonus ${bonus}`);
    }
});

test('missing feedback markup is safe and does not schedule a timer', () => {
    const { api, timers } = loadFeedback({ element: false });

    api.showScore(100, 2.0);
    api.showWrong();
    api.clear();

    assert.equal(timers.size, 0);
});

test('index loads the feedback module before the Numbers game and the service worker caches it', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const scriptPaths = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
    const feedbackIndex = scriptPaths.indexOf('js/numbers-round-feedback.js');
    const gameIndex = scriptPaths.indexOf('js/numbers-game.js');
    const serviceWorker = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');

    assert.notEqual(feedbackIndex, -1);
    assert.ok(feedbackIndex < gameIndex);
    assert.match(serviceWorker, /\.\/js\/numbers-round-feedback\.js/);
});
