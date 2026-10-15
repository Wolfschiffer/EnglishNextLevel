(() => {
    const FOCUSABLE_SELECTOR = [
        'a[href]',
        'area[href]',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'button:not([disabled])',
        'iframe',
        'object',
        'embed',
        '[contenteditable="true"]',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    function makeButton(element, onActivate) {
        if (!element || typeof onActivate !== 'function') return;

        element.setAttribute('role', 'button');
        element.tabIndex = 0;
        let spacePressed = false;

        element.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();

            if (event.repeat) return;
            if (event.key === 'Enter') {
                onActivate(event);
                return;
            }

            spacePressed = true;
        });

        element.addEventListener('keyup', (event) => {
            if (event.key !== ' ' || !spacePressed) return;
            event.preventDefault();
            spacePressed = false;
            onActivate(event);
        });

        element.addEventListener('blur', () => {
            spacePressed = false;
        });

        return element;
    }

    function trapDialogFocus(dialog, options = {}) {
        if (!dialog || typeof dialog.addEventListener !== 'function') return () => {};

        if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');

        const getFocusableElements = () => Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR))
            .filter((element) => {
                if (element.disabled || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
                return typeof element.getClientRects !== 'function' || element.getClientRects().length > 0;
            });

        const focusableElements = getFocusableElements();
        const initialFocus = options.initialFocus;
        const target = initialFocus && dialog.contains(initialFocus)
            ? initialFocus
            : focusableElements[0] || dialog;
        target.focus?.();

        const handleKeydown = (event) => {
            if (event.key === 'Escape' && typeof options.onEscape === 'function') {
                event.preventDefault();
                options.onEscape();
                return;
            }

            if (event.key !== 'Tab') return;

            const elements = getFocusableElements();
            if (elements.length === 0) {
                event.preventDefault();
                dialog.focus?.();
                return;
            }

            const first = elements[0];
            const last = elements[elements.length - 1];
            const activeElement = document.activeElement;

            if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
                event.preventDefault();
                last.focus?.();
            } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
                event.preventDefault();
                first.focus?.();
            }
        };

        dialog.addEventListener('keydown', handleKeydown);
        return () => dialog.removeEventListener('keydown', handleKeydown);
    }

    const api = { makeButton, trapDialogFocus };
    window.EnlKeyboardAccessibility = api;
    if (typeof module === 'object' && module.exports) module.exports = api;

    document.querySelectorAll('.game-card[data-numbers-mode], .game-card[data-words-mode]').forEach((card) => {
        makeButton(card, () => card.click());
    });
})();
