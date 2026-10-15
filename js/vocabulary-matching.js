// Owns pointer and keyboard input, validation, and completion for Words pairs.
(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelVocabularyMatching = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    function create({
        window = globalThis,
        document = window.document,
        englishList,
        portugueseList,
        getEnglishWords = () => [],
        getPortugueseWords = () => [],
        getMatchCount = () => 0,
        setMatchCount = () => {},
        getGameFinished = () => false,
        showMessage = () => {},
        playWrongSound = () => {},
        awardPoints = () => {},
        finishGame = () => {},
        playMatchedPastPronunciation = () => {},
        renderLists = () => {},
        handleCorrectFeedback = () => {}
    } = {}) {
        let selectedEnglishId = null;
        let draggedElement = null;

        function normalizeId(id) {
            const value = Number(id);
            return Number.isFinite(value) ? value : null;
        }

        function findAvailableItem(items, id) {
            const normalizedId = normalizeId(id);
            if (normalizedId === null) return null;
            return items.find((item) => Number(item.id) === normalizedId && !item.locked) || null;
        }

        function updateKeyboardSelection(id) {
            selectedEnglishId = id == null ? null : normalizeId(id);
            englishList?.querySelectorAll('.english-item:not(.locked)').forEach((item) => {
                const isSelected = Number(item.getAttribute('data-id')) === selectedEnglishId;
                item.setAttribute('aria-pressed', String(isSelected));
                item.classList.toggle('selected', isSelected);
            });
        }

        function handleKeyboardActivation(side, itemId) {
            const normalizedId = normalizeId(itemId);
            if (normalizedId === null) return;

            if (side === 'english') {
                const word = findAvailableItem(getEnglishWords(), normalizedId);
                if (!word) return;

                if (selectedEnglishId === normalizedId) {
                    updateKeyboardSelection(null);
                    showMessage('Word selection cleared.', 'success');
                    return;
                }

                updateKeyboardSelection(normalizedId);
                showMessage(`${word.text || word.english || 'Word'} selected. Now choose its match.`, 'success');
                portugueseList?.querySelector('.portuguese-item:not(.locked)')?.focus();
                return;
            }

            if (side !== 'portuguese') return;
            if (selectedEnglishId === null) {
                showMessage('Select an English word first.', 'error');
                return;
            }

            completeMatch(selectedEnglishId, normalizedId, { focusNext: true });
        }

        function setupKeyboardCard(element, side, itemId) {
            if (side === 'english') element.setAttribute('aria-pressed', 'false');
            window.EnlKeyboardAccessibility?.makeButton(element, () => {
                handleKeyboardActivation(side, Number(itemId));
            });
        }

        function clearDragStyles() {
            document.querySelectorAll('.english-item').forEach((item) => {
                item.classList.remove('drag-over');
            });
        }

        function clearDragState() {
            if (draggedElement) draggedElement.style.opacity = '1';
            clearDragStyles();
            draggedElement = null;
        }

        function reset() {
            clearDragState();
            updateKeyboardSelection(null);
        }

        function handleDragStart(event) {
            const source = event.target?.closest?.('.english-item');
            if (!source || source.classList.contains('locked')) return;

            draggedElement = source;
            source.style.opacity = '0.5';

            const englishId = source.getAttribute('data-id');
            if (englishId == null) {
                clearDragState();
                return;
            }

            event.dataTransfer?.setData('text/plain', englishId);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        }

        function handleDragEnd() {
            clearDragState();
        }

        function handleDragOver(event) {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

            const target = event.target?.closest?.('.english-item');
            if (!target || target === draggedElement || target.classList.contains('locked')) return;

            clearDragStyles();
            target.classList.add('drag-over');
        }

        function handleDrop(event) {
            event.preventDefault();
            const source = draggedElement;
            const target = event.target?.closest?.('.portuguese-item');

            if (source && !source.classList.contains('locked') && target && !target.classList.contains('locked')) {
                completeMatch(source.getAttribute('data-id'), target.getAttribute('data-id'));
            }

            clearDragState();
        }

        function lockAndMoveToTop(englishId, portugueseId) {
            const englishWords = getEnglishWords();
            const portugueseWords = getPortugueseWords();
            const normalizedEnglishId = normalizeId(englishId);
            const normalizedPortugueseId = normalizeId(portugueseId);
            if (normalizedEnglishId === null || normalizedPortugueseId === null) return false;

            const englishIndex = englishWords.findIndex((item) => Number(item.id) === normalizedEnglishId && !item.locked);
            const portugueseIndex = portugueseWords.findIndex((item) => Number(item.id) === normalizedPortugueseId && !item.locked);
            if (englishIndex === -1 || portugueseIndex === -1) return false;

            const [movedEnglish] = englishWords.splice(englishIndex, 1);
            const [movedPortuguese] = portugueseWords.splice(portugueseIndex, 1);
            movedEnglish.locked = true;
            movedPortuguese.locked = true;

            const lockedCount = englishWords.filter((item) => item.locked).length;
            englishWords.splice(lockedCount, 0, movedEnglish);
            portugueseWords.splice(lockedCount, 0, movedPortuguese);

            const nextMatchCount = Number(getMatchCount()) + 1;
            setMatchCount(nextMatchCount);
            awardPoints();

            if (nextMatchCount === englishWords.length) finishGame();
            return true;
        }

        function completeMatch(englishId, portugueseId, { focusNext = false } = {}) {
            const normalizedEnglishId = normalizeId(englishId);
            const normalizedPortugueseId = normalizeId(portugueseId);
            if (normalizedEnglishId === null || normalizedPortugueseId === null) return false;

            const englishWord = findAvailableItem(getEnglishWords(), normalizedEnglishId);
            const portugueseWord = findAvailableItem(getPortugueseWords(), normalizedPortugueseId);
            if (!englishWord || !portugueseWord) return false;

            if (normalizedEnglishId !== normalizedPortugueseId) {
                playWrongSound();
                showMessage('Try again', 'error');
                return false;
            }

            if (!lockAndMoveToTop(normalizedEnglishId, normalizedPortugueseId)) return false;

            updateKeyboardSelection(null);
            playMatchedPastPronunciation(normalizedPortugueseId);
            renderLists();
            handleCorrectFeedback();

            if (focusNext && !getGameFinished()) {
                englishList?.querySelector('.english-item:not(.locked)')?.focus();
            }
            return true;
        }

        return Object.freeze({
            completeMatch,
            handleDragStart,
            handleDragEnd,
            handleDragOver,
            handleDrop,
            handleKeyboardActivation,
            setupKeyboardCard,
            reset,
            getSelectedEnglishId: () => selectedEnglishId
        });
    }

    return Object.freeze({ create });
});
