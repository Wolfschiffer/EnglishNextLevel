(function (root) {
    function create({
        document = root.document,
        englishList,
        portugueseList,
        getEnglishWords,
        getPortugueseWords,
        getGameType,
        createAudioButton,
        addCardPronunciation,
        setupKeyboardCard,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDrop,
        touchInput
    }) {
        function renderEnglishItem(item, index) {
            const element = document.createElement('div');

            if (item.locked) {
                element.className = 'vocab-item english-item locked';
                element.setAttribute('draggable', 'false');
            } else {
                element.className = 'vocab-item english-item';
                element.setAttribute('data-id', item.id);
                element.setAttribute('data-index', index);
                element.setAttribute('draggable', 'true');
                setupKeyboardCard(element, 'english', item.id);
                element.addEventListener('dragstart', handleDragStart);
                element.addEventListener('dragend', handleDragEnd);
                element.addEventListener('dragover', handleDragOver);
                element.addEventListener('drop', handleDrop);
                element.addEventListener('touchstart', touchInput.handleTouchStart, { passive: false });
                element.addEventListener('touchmove', touchInput.handleTouchMove, { passive: false });
                element.addEventListener('touchend', touchInput.handleTouchEnd);
                element.addEventListener('touchcancel', touchInput.handleTouchCancel);
            }

            const text = item.text || item.english || item.word || '?';
            appendText(element, text);
            addCardPronunciation(element, item.text, 'english');

            if (item.locked) {
                element.classList.add('has-audio');
                element.appendChild(createAudioButton(item.text, 'english', 'right'));
            }

            return element;
        }

        function renderPortugueseItem(item) {
            const element = document.createElement('div');

            if (item.locked) {
                element.className = 'vocab-item portuguese-item locked';
            } else {
                element.className = 'vocab-item portuguese-item';
                element.setAttribute('data-id', item.id);
                setupKeyboardCard(element, 'portuguese', item.id);
                element.setAttribute('draggable', 'false');
                element.addEventListener('dragover', event => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                });
                element.addEventListener('drop', handleDrop);
            }

            if (item.locked && getGameType() === 'past') {
                element.classList.add('has-audio');
                element.appendChild(createAudioButton(item.text, 'past', 'left'));
            } else if (item.locked) {
                element.classList.add('no-audio');
            }

            const text = item.text || item.portuguese || item.translation || '?';
            appendText(element, text);

            if (getGameType() === 'past') {
                addCardPronunciation(element, item.text, 'past');
            }

            return element;
        }

        function appendText(element, text) {
            const textSpan = document.createElement('span');
            textSpan.className = 'vocab-text';
            textSpan.textContent = text;
            element.appendChild(textSpan);
        }

        function sortLockedFirst(items) {
            const locked = items.filter(item => item.locked);
            const unlocked = items.filter(item => !item.locked);
            return [...locked, ...unlocked];
        }

        function clearEnglishListStyles() {
            document.querySelectorAll('.english-item').forEach(item => {
                item.classList.remove('drag-over', 'dragging-source');
                item.style.opacity = '';
                item.style.transform = '';
                item.style.backgroundColor = '';
                item.style.color = '';
            });
        }

        function render() {
            if (!englishList || !portugueseList) return;

            englishList.innerHTML = '';
            sortLockedFirst(getEnglishWords()).forEach((item, index) => {
                englishList.appendChild(renderEnglishItem(item, index));
            });

            portugueseList.innerHTML = '';
            sortLockedFirst(getPortugueseWords()).forEach(item => {
                portugueseList.appendChild(renderPortugueseItem(item));
            });

            clearEnglishListStyles();
        }

        return Object.freeze({ render });
    }

    root.EnglishNextLevelVocabularyRenderer = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
