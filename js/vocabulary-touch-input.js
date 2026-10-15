// Touch drag-and-drop input for the Words matching activity.

(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelVocabularyTouchInput = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    function create({ document, onCompleteMatch = () => {} } = {}) {
        let touchActive = false;
        let touchSourceElement = null;
        let touchClone = null;

        function clearEnglishCardVisuals() {
            document.querySelectorAll('.english-item').forEach(item => {
                item.classList.remove('drag-over', 'dragging-source');
                item.style.opacity = '';
                item.style.transform = '';
                item.style.backgroundColor = '';
                item.style.color = '';
            });
        }

        function reset() {
            if (touchSourceElement) {
                touchSourceElement.style.opacity = '1';
                touchSourceElement.style.transform = '';
                touchSourceElement.classList.remove('dragging-source');
            }
            touchClone?.remove();
            touchClone = null;
            touchActive = false;
            touchSourceElement = null;
            clearEnglishCardVisuals();
            document.body.classList.remove('dragging');
        }

        function handleTouchStart(event) {
            if (event.cancelable) event.preventDefault();

            const target = event.target.closest('.english-item');
            if (!target || target.classList.contains('locked')) return;

            touchActive = true;
            touchSourceElement = target;

            target.style.opacity = '0.5';
            target.style.transform = 'scale(0.98)';
            target.style.transition = 'all 0.2s ease';
            target.classList.add('dragging-source');

            touchClone = target.cloneNode(true);
            touchClone.style.position = 'fixed';
            touchClone.style.top = `${event.touches[0].clientY - 20}px`;
            touchClone.style.left = `${event.touches[0].clientX - 50}px`;
            touchClone.style.width = `${target.offsetWidth}px`;
            touchClone.style.opacity = '0.7';
            touchClone.style.pointerEvents = 'none';
            touchClone.style.zIndex = '9999';
            touchClone.style.transform = 'scale(1.05)';
            touchClone.style.transition = 'transform 0.1s ease';
            document.body.appendChild(touchClone);
            document.body.classList.add('dragging');
        }

        function handleTouchMove(event) {
            if (!touchActive || !touchClone) return;
            if (event.cancelable) event.preventDefault();

            const touch = event.touches[0];
            touchClone.style.top = `${touch.clientY - 20}px`;
            touchClone.style.left = `${touch.clientX - 50}px`;

            const elementsUnderTouch = document.elementsFromPoint(touch.clientX, touch.clientY);
            let targetItem = null;
            for (const element of elementsUnderTouch) {
                if (element.classList?.contains('english-item') && !element.classList.contains('locked')) {
                    targetItem = element;
                    break;
                }
            }

            clearEnglishCardVisuals();
            if (targetItem && targetItem !== touchSourceElement) {
                targetItem.classList.add('drag-over');
                targetItem.style.backgroundColor = '#c9a13b';
                targetItem.style.color = 'white';
                targetItem.style.transform = 'scale(1.02)';
                targetItem.style.transition = 'all 0.1s ease';
            }
        }

        function handleTouchEnd(event) {
            if (!touchActive) {
                clearEnglishCardVisuals();
                return;
            }
            if (event.cancelable) event.preventDefault();

            if (touchSourceElement) {
                touchSourceElement.style.opacity = '1';
                touchSourceElement.style.transform = '';
                touchSourceElement.classList.remove('dragging-source');
            }
            touchClone?.remove();
            touchClone = null;

            if (touchSourceElement?.classList.contains('locked')) {
                reset();
                return;
            }

            const touch = event.changedTouches[0];
            const elementsUnderTouch = document.elementsFromPoint(touch.clientX, touch.clientY);
            let targetPortuguese = null;
            for (const element of elementsUnderTouch) {
                if (element.classList?.contains('portuguese-item') && !element.classList.contains('locked')) {
                    targetPortuguese = element;
                    break;
                }
            }

            if (targetPortuguese && touchSourceElement) {
                const englishId = parseInt(touchSourceElement.getAttribute('data-id'));
                const portugueseId = parseInt(targetPortuguese.getAttribute('data-id'));
                onCompleteMatch(englishId, portugueseId);
            }

            reset();
        }

        function handleTouchCancel() {
            reset();
        }

        return Object.freeze({ handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, reset });
    }

    return Object.freeze({ create });
});
