// Coordinates the client side of a server-verified Numbers run.

window.EnglishNextLevelNumbersRunSession = (() => {
    function create({
        getClient,
        getCurrentRun,
        getCurrentMode,
        isGameActive,
        findNumberByWord,
        logger = console
    } = {}) {
        function prepare(serverRun) {
            const currentMode = getCurrentMode();
            if (!serverRun || serverRun.mode !== currentMode ||
                !Number.isSafeInteger(serverRun.questionCount) || serverRun.questionCount < 1 ||
                serverRun.questionCount > 10) return null;

            return {
                ...serverRun,
                questions: Array(serverRun.questionCount).fill(null),
                questionIndex: 0,
                pendingAnswers: Promise.resolve(),
                pendingQuestionStart: Promise.resolve(),
                shownQuestionValues: new Set(),
                valid: true
            };
        }

        function startQuestion(run, questionIndex) {
            const client = getClient();
            if (!run?.valid || !client) return Promise.resolve(null);

            const previousAnswers = run.pendingAnswers;
            run.pendingQuestionStart = previousAnswers.then(async () => {
                if (!run.valid || getCurrentRun() !== run || !isGameActive()) return null;
                const result = await client.startQuestion(run.runId, questionIndex);
                if (!run.valid || getCurrentRun() !== run || !isGameActive()) return null;
                const number = findNumberByWord(result.question.word);
                if (!number || !result.question.options.includes(number.value)) {
                    throw new Error('The server question does not match the local Numbers data.');
                }
                run.questions[questionIndex] = {
                    word: result.question.word,
                    value: number.value,
                    options: [...result.question.options]
                };
                return run.questions[questionIndex];
            }).catch(error => {
                run.valid = false;
                logger.warn('Numbers question start could not be verified; keeping this score on this device.', error);
                return null;
            });
            return run.pendingQuestionStart;
        }

        function queueAnswer(run, questionIndex, answerValue, expectedCorrect) {
            const client = getClient();
            if (!run?.valid || !client) return;

            let attemptId;
            try {
                attemptId = client.createAttemptId();
            } catch (error) {
                run.valid = false;
                logger.warn('Numbers run could not create an idempotency ID; keeping this score on this device.', error);
                return;
            }

            const previousAnswers = run.pendingAnswers;
            const questionStart = run.pendingQuestionStart;
            run.pendingAnswers = Promise.all([previousAnswers, questionStart]).then(async () => {
                if (!run.valid || getCurrentRun() !== run) return null;
                const result = await client.recordAnswer(run.runId, questionIndex, answerValue, attemptId);
                const expectedIndex = expectedCorrect ? questionIndex + 1 : questionIndex;
                if (result.correct !== expectedCorrect || result.questionIndex !== expectedIndex) {
                    throw new Error('The server answer state no longer matches this Numbers run.');
                }
                return result;
            }).catch(error => {
                run.valid = false;
                logger.warn('Numbers run could not be validated; keeping this score on this device.', error);
                return null;
            });
        }

        async function finish(run) {
            await run.pendingAnswers;
            if (!run.valid) throw new Error('At least one answer could not be verified.');
            const result = await getClient().finish(run.runId);
            return { result, mode: run.mode, runId: run.runId };
        }

        function invalidate(run) {
            if (run) run.valid = false;
        }

        return Object.freeze({ prepare, startQuestion, queueAnswer, finish, invalidate });
    }

    return Object.freeze({ create });
})();
