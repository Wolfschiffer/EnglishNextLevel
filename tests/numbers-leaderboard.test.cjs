const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/numbers-leaderboard.js'), 'utf8');

function createHarness() {
    const calls = [];
    const logger = { error: (...args) => calls.push(['error', ...args]) };
    const document = {
        createElement() {
            let text = '';
            return {
                set textContent(value) { text = String(value); },
                get innerHTML() {
                    return text
                        .replaceAll('&', '&amp;')
                        .replaceAll('<', '&lt;')
                        .replaceAll('>', '&gt;')
                        .replaceAll('"', '&quot;')
                        .replaceAll("'", '&#39;');
                }
            };
        }
    };
    const window = { document, console: logger };
    vm.runInContext(source, vm.createContext({ window }));
    return { calls, logger, window, api: window.EnglishNextLevelNumbersLeaderboard.create({ document, logger }) };
}

test('escapes text before it is inserted into leaderboard markup', () => {
    const { api } = createHarness();

    assert.equal(api.escapeHtml('<Ana & João>'), '&lt;Ana &amp; João&gt;');
});

test('saves through the QA destination and only submits a verified run when available', async () => {
    const { api, window } = createHarness();
    const submittedRunIds = [];
    let saveOptions;
    window.enlFirebaseEnvironment = 'qa';
    window.EnglishNextLevelNumbersRunClient = {
        canSubmitGlobally: () => true,
        async submitScore(runId) {
            submittedRunIds.push(runId);
            return { saved: true };
        }
    };
    window.EnglishNextLevelLeaderboardClient = {
        async saveLeaderboardScore(_mode, _score, _name, options) {
            saveOptions = options;
            return { saved: true, destination: options.cloudDestination };
        }
    };

    const result = await api.saveToLeaderboard('numbers', 120, 'Ana', 'run-qa-1');

    assert.deepEqual(result, { saved: true, destination: 'qa' });
    assert.equal(saveOptions.cloudDestination, 'qa');
    assert.deepEqual(await saveOptions.saveToCloud(), { saved: true });
    assert.deepEqual(submittedRunIds, ['run-qa-1']);
    assert.equal(typeof saveOptions.saveLocally, 'function');
});

test('uses local leaderboard storage for reads and fallback saves', () => {
    const { api, window } = createHarness();
    const storageCalls = [];
    window.EnglishNextLevelLeaderboardStorage = {
        readLocalLeaderboardResult(mode) {
            storageCalls.push(['read', mode]);
            return { scores: [], ok: true };
        },
        saveLocalLeaderboard(mode, score, name) {
            storageCalls.push(['save', mode, score, name]);
            return true;
        }
    };
    window.EnglishNextLevelLeaderboardClient = {
        async saveLeaderboardScore(mode, score, name, options) {
            return options.saveLocally(mode, score, name);
        }
    };
    let dialogDependencies;
    window.EnglishNextLevelLeaderboardDialog = {
        create(dependencies) {
            dialogDependencies = dependencies;
            return { async open() { return 'opened'; } };
        }
    };
    window.enlFirebaseEnvironment = 'qa';
    window.EnlKeyboardAccessibility = { trapDialogFocus() {} };
    window.firebase = { firestore: () => ({ ready: true }) };

    return Promise.all([
        api.saveToLeaderboard('numbers', 30, 'Ana'),
        api.showModal()
    ]).then(([saveResult]) => {
        assert.equal(saveResult, true);
        assert.equal(dialogDependencies.environment, 'qa');
        assert.equal(dialogDependencies.focusTrap, window.EnlKeyboardAccessibility);
        assert.equal(dialogDependencies.isCloudConfigured(), true);
        assert.deepEqual(dialogDependencies.getFirestore(), { ready: true });
        assert.deepEqual(dialogDependencies.readLocalScores('numbers'), { scores: [], ok: true });
        assert.deepEqual(storageCalls, [['save', 'numbers', 30, 'Ana'], ['read', 'numbers']]);
    });
});

test('returns a device-only failure when the leaderboard client is unavailable', async () => {
    const { api, calls } = createHarness();

    const result = await api.saveToLeaderboard('numbers', 10, 'Ana');

    assert.equal(result.saved, false);
    assert.equal(result.destination, 'none');
    assert.equal(calls[0][0], 'error');
});
