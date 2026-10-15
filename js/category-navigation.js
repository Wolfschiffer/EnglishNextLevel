(() => {
    const categoryCards = [
        ['category-numbers', SCREENS.NUMBERS_MENU],
        ['category-words', SCREENS.WORDS_MENU],
        ['category-topics', SCREENS.TOPICS_MENU]
    ];

    categoryCards.forEach(([elementId, screen]) => {
        const card = document.getElementById(elementId);
        if (!card) return;

        card.addEventListener('click', () => navigateTo(screen));
        window.EnlKeyboardAccessibility?.makeButton?.(card, () => card.click());
    });

    document.getElementById('back-to-category-btn')?.addEventListener('click', goBack);
    document.getElementById('back-to-category-from-vocab')?.addEventListener('click', goBack);
})();
