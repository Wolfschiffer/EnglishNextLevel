// Short-lived visual feedback for correct and incorrect Numbers answers.

window.EnglishNextLevelNumbersRoundFeedback = (() => {
    function create({
        document,
        scheduleTimeout = setTimeout,
        cancelTimeout = clearTimeout,
        duration = 950
    } = {}) {
        let feedbackTimer = null;

        function getFeedbackElement() {
            return document?.getElementById('numbers-round-feedback') ?? null;
        }

        function clearTimer() {
            if (feedbackTimer === null) return;
            cancelTimeout(feedbackTimer);
            feedbackTimer = null;
        }

        function show(type, title, copy) {
            clearTimer();
            const feedback = getFeedbackElement();
            if (!feedback) return;

            const titleElement = feedback.querySelector('.phase5-round-feedback-title');
            const copyElement = feedback.querySelector('.phase5-round-feedback-copy');

            feedback.classList.remove('is-visible', 'is-success', 'is-error');
            if (titleElement) titleElement.textContent = title;
            if (copyElement) copyElement.textContent = copy;
            feedback.classList.add(type === 'error' ? 'is-error' : 'is-success');

            // Restart the transition when two feedback messages happen quickly.
            void feedback.offsetWidth;
            feedback.classList.add('is-visible');

            feedbackTimer = scheduleTimeout(() => {
                feedback.classList.remove('is-visible');
                feedbackTimer = null;
            }, duration);
        }

        function showScore(points, timeBonus) {
            let bonusText = 'Keep going';
            if (timeBonus > 1.8) bonusText = 'Excellent';
            else if (timeBonus > 1.5) bonusText = 'Great';
            else if (timeBonus > 1.2) bonusText = 'Good';

            show('success', `+${points}`, bonusText);
        }

        function showWrong() {
            show('error', 'Try again', 'Choose another number');
        }

        function clear() {
            clearTimer();
            const feedback = getFeedbackElement();
            if (!feedback) return;
            feedback.classList.remove('is-visible', 'is-success', 'is-error');
        }

        return Object.freeze({ show, showScore, showWrong, clear });
    }

    return Object.freeze({ create });
})();
