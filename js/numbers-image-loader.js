((root, factory) => {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelNumbersImageLoader = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, (root) => {
    function create(dependencies = {}) {
        const ImageConstructor = dependencies.ImageConstructor || root.Image;
        const images = dependencies.images || { idle: null, flap: [], celebrate: [], wrong: [] };
        const debug = dependencies.debug || (() => {});
        const logger = dependencies.logger || root.console;
        let eagleSpritesLoaded = false;

        function loadIdleImage() {
            debug('Loading idle eagle image...');

            images.idle = new ImageConstructor();
            images.idle.src = 'images/flap_01.png';
            images.idle.onload = () => debug('✅ Idle image loaded');
            images.idle.onerror = () => logger?.error?.('❌ Failed: images/flap_01.png');
        }

        function loadEagleSprites() {
            if (eagleSpritesLoaded) return;

            debug('Loading eagle sprites...');

            images.flap = [];
            images.celebrate = [];
            images.wrong = [];

            for (let index = 1; index <= 18; index++) {
                const image = new ImageConstructor();
                const number = index.toString().padStart(2, '0');
                image.src = `images/flap_${number}.png`;
                image.onerror = () => logger?.error?.(`❌ Failed: images/flap_${number}.png`);
                images.flap.push(image);
            }

            for (let index = 1; index <= 11; index++) {
                const image = new ImageConstructor();
                const number = index.toString().padStart(2, '0');
                image.src = `images/eagle_center_${number}.png`;
                image.onerror = () => logger?.error?.(`❌ Failed: images/eagle_center_${number}.png`);
                images.celebrate.push(image);
            }

            for (let index = 1; index <= 19; index++) {
                const image = new ImageConstructor();
                const number = index.toString().padStart(2, '0');
                image.src = `images/eagle_wrong_${number}.png`;
                image.onerror = () => logger?.error?.(`❌ Failed: images/eagle_wrong_${number}.png`);
                images.wrong.push(image);
            }

            eagleSpritesLoaded = true;
            debug('✅ Eagle sprites loading started');
        }

        return Object.freeze({ images, loadIdleImage, loadEagleSprites });
    }

    return Object.freeze({ create });
});
