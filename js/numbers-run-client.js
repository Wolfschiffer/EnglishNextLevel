((root, factory) => {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelNumbersRunClient = api.createNumbersRunClient();
    }
})(typeof window !== 'undefined' ? window : globalThis, (root) => {
    const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{20}$/;
    const SUPPORTED_RUN_RULES_VERSION = 2;

    function createAttemptId() {
        if (typeof globalThis.crypto?.randomUUID === 'function') {
            return globalThis.crypto.randomUUID();
        }
        throw new Error('Secure attempt IDs are unavailable in this browser.');
    }

    function createNumbersRunClient(dependencies = {}) {
        const getCurrentUser = dependencies.getCurrentUser || (() => {
            if (root?.currentUser) return root.currentUser;
            try {
                return root?.firebase?.auth?.().currentUser || null;
            } catch {
                return null;
            }
        });
        const isGuest = dependencies.isGuest || (() => root?.isGuest === true);
        const callFunction = dependencies.callFunction || ((name, data) => {
            if (typeof root?.firebase?.functions !== 'function') {
                throw new Error('Firebase Functions is unavailable.');
            }
            return root.firebase.functions().httpsCallable(name)(data);
        });
        const makeAttemptId = dependencies.createAttemptId || createAttemptId;

        function canSubmitGlobally() {
            const user = getCurrentUser();
            return !isGuest() && Boolean(user?.uid && user.emailVerified === true);
        }

        function requireVerifiedUser() {
            if (!canSubmitGlobally()) {
                throw new Error('A verified account is required for a global Numbers score.');
            }
        }

        async function start(mode) {
            if (!canSubmitGlobally()) return null;
            if (typeof mode !== 'string' || !mode) throw new TypeError('A Numbers mode is required.');

            const response = await callFunction('startNumbersRun', { mode });
            const data = response?.data ?? response;
            if (!data || !RUN_ID_PATTERN.test(data.runId || '') || data.mode !== mode ||
                data.rulesVersion !== SUPPORTED_RUN_RULES_VERSION ||
                !Number.isSafeInteger(data.questionCount) || data.questionCount < 1 || data.questionCount > 10 ||
                Object.hasOwn(data, 'questions')) {
                throw new Error('The server returned an invalid Numbers run.');
            }

            return { runId: data.runId, mode, rulesVersion: data.rulesVersion, questionCount: data.questionCount };
        }

        async function startQuestion(runId, questionIndex) {
            requireVerifiedUser();
            if (!RUN_ID_PATTERN.test(runId || '') || !Number.isSafeInteger(questionIndex) || questionIndex < 0) {
                throw new TypeError('The Numbers question is invalid.');
            }
            const response = await callFunction('startNumbersQuestion', { runId, questionIndex });
            const result = response?.data ?? response;
            const question = result?.question;
            if (!result || result.started !== true || result.questionIndex !== questionIndex ||
                !question || typeof question.word !== 'string' || !question.word.trim() ||
                Object.hasOwn(question, 'value') || !Array.isArray(question.options) ||
                question.options.length !== 3 ||
                question.options.some(value => !Number.isSafeInteger(value) || value < 1 || value > 9999) ||
                new Set(question.options).size !== 3) {
                throw new Error('The server returned an invalid Numbers question start result.');
            }
            return {
                started: true,
                questionIndex,
                question: { word: question.word, options: [...question.options] }
            };
        }

        async function recordAnswer(runId, questionIndex, answerValue, attemptId = makeAttemptId()) {
            requireVerifiedUser();
            if (!RUN_ID_PATTERN.test(runId || '') || !Number.isSafeInteger(questionIndex) || questionIndex < 0 ||
                !Number.isSafeInteger(answerValue) || answerValue < 1 || answerValue > 9999 ||
                typeof attemptId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(attemptId)) {
                throw new TypeError('The Numbers answer attempt is invalid.');
            }
            const response = await callFunction('recordNumbersAnswer', {
                runId, questionIndex, answerValue, attemptId
            });
            const result = response?.data ?? response;
            if (!result || result.accepted !== true || typeof result.correct !== 'boolean' ||
                !Number.isSafeInteger(result.questionIndex) ||
                !Number.isSafeInteger(result.currentScore) ||
                !Number.isSafeInteger(result.livesRemaining) || typeof result.status !== 'string') {
                throw new Error('The server returned an invalid Numbers answer result.');
            }
            return result;
        }

        async function finish(runId) {
            requireVerifiedUser();
            if (!RUN_ID_PATTERN.test(runId || '')) throw new TypeError('The Numbers run ID is invalid.');
            const response = await callFunction('finishNumbersRun', { runId });
            const result = response?.data ?? response;
            if (!result || !Number.isSafeInteger(result.baseScore) ||
                !Number.isSafeInteger(result.finalScore) || result.finalScore < 0 ||
                !Number.isFinite(result.speedBonus) || !Number.isFinite(result.lifeBonus) ||
                !Number.isFinite(result.totalGameTime) || !Number.isSafeInteger(result.livesRemaining)) {
                throw new Error('The server returned an invalid final Numbers result.');
            }
            return result;
        }

        async function submitScore(runId) {
            requireVerifiedUser();
            if (!RUN_ID_PATTERN.test(runId || '')) throw new TypeError('The Numbers run ID is invalid.');
            const response = await callFunction('submitScore', { runId });
            return response?.data ?? response;
        }

        return { canSubmitGlobally, createAttemptId: makeAttemptId, start, startQuestion, recordAnswer, finish, submitScore };
    }

    return { createNumbersRunClient };
});
