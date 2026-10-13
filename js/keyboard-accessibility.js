(() => {
    document.querySelectorAll('.game-card[onclick]').forEach((card) => {
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        let spacePressed = false;

        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();

            if (event.repeat) return;
            if (event.key === 'Enter') {
                card.click();
                return;
            }

            spacePressed = true;
        });

        card.addEventListener('keyup', (event) => {
            if (event.key !== ' ' || !spacePressed) return;
            event.preventDefault();
            spacePressed = false;
            card.click();
        });

        card.addEventListener('blur', () => {
            spacePressed = false;
        });
    });
})();
