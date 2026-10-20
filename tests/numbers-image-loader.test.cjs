const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const imageLoaderModule = require('../js/numbers-image-loader.js');

function createHarness() {
    class FakeImage {
        static instances = [];

        constructor() {
            this.src = '';
            FakeImage.instances.push(this);
        }
    }

    const images = { idle: null, flap: [], celebrate: [], wrong: [] };
    const loader = imageLoaderModule.create({
        ImageConstructor: FakeImage,
        images,
        logger: { error() {} }
    });

    return { loader, images, FakeImage };
}

test('image loader keeps its shared image object and delays gameplay sprites until requested', () => {
    const harness = createHarness();

    assert.strictEqual(harness.loader.images, harness.images);
    assert.equal(harness.FakeImage.instances.length, 0);

    harness.loader.loadEagleSprites();

    assert.equal(harness.images.flap.length, 18);
    assert.equal(harness.images.celebrate.length, 11);
    assert.equal(harness.images.wrong.length, 19);
    assert.equal(harness.images.flap[0].src, 'images/flap_01.png');
    assert.equal(harness.images.flap.at(-1).src, 'images/flap_18.png');
    assert.equal(harness.images.celebrate.at(-1).src, 'images/eagle_center_11.png');
    assert.equal(harness.images.wrong.at(-1).src, 'images/eagle_wrong_19.png');

    const loadedImageCount = harness.FakeImage.instances.length;
    harness.loader.loadEagleSprites();
    assert.equal(harness.FakeImage.instances.length, loadedImageCount);
});

test('idle image loads once during Numbers initialization', () => {
    const harness = createHarness();

    harness.loader.loadIdleImage();

    assert.equal(harness.FakeImage.instances.length, 1);
    assert.equal(harness.images.idle.src, 'images/flap_01.png');
});

test('index loads the image loader before Numbers and the service worker caches it', () => {
    const root = path.join(__dirname, '..');
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
    const loaderIndex = index.indexOf('<script src="js/numbers-image-loader.js"></script>');
    const gameIndex = index.indexOf('<script src="js/numbers-game.js"></script>');

    assert.notEqual(loaderIndex, -1);
    assert.ok(gameIndex > loaderIndex);
    assert.match(serviceWorker, /'\.\/js\/numbers-image-loader\.js'/);
    assert.match(serviceWorker, /const CACHE_NAME = 'enl-shell-v\d+';/);
});
