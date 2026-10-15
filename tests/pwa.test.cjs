const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

test('PWA manifest stays relative to the GitHub Pages project path', () => {
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
    assert.match(html, /name="theme-color"/);
    assert.match(html, /js\/pwa-register\.js/);

    const iconsBySize = new Map(manifest.icons.map((icon) => [icon.sizes, icon]));
    for (const size of [192, 512]) {
        const icon = iconsBySize.get(`${size}x${size}`);
        assert.ok(icon, `manifest must include a ${size}x${size} install icon`);
        assert.equal(icon.type, 'image/png');
        assert.equal(icon.purpose, 'any');

        const iconPath = path.resolve(root, icon.src);
        assert.ok(iconPath.startsWith(`${root}${path.sep}`));
        assert.ok(fs.existsSync(iconPath), `${icon.src} must exist`);
        const png = fs.readFileSync(iconPath);
        assert.equal(png.readUInt32BE(16), size, `${icon.src} width must match its manifest size`);
        assert.equal(png.readUInt32BE(20), size, `${icon.src} height must match its manifest size`);
    }
});

test('service worker shell cache references only files that exist in the repository', () => {
    const assetsBlock = worker.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/);
    assert.ok(assetsBlock, 'service worker must define its static app shell');
    const assets = [...assetsBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);

    for (const asset of assets) {
        const localPath = path.resolve(root, asset.replace(/^\.\//, ''));
        assert.ok(localPath === root || localPath.startsWith(`${root}${path.sep}`), `${asset} must stay in the app`);
        assert.ok(fs.existsSync(localPath), `cached app asset must exist: ${asset}`);
    }

    const collectImageFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory()
            ? collectImageFiles(entryPath)
            : [path.relative(root, entryPath).split(path.sep).join('/')];
    });
    const unusedDuplicateImages = new Set([
        'images/eagle-logo.png.png',
        'images/icon-numbers.png',
        'images/icon-topics.png',
        'images/icon-words.png'
    ]);
    const allImages = collectImageFiles(path.join(root, 'images'))
        .filter((asset) => !unusedDuplicateImages.has(asset))
        .map((asset) => `./${asset}`)
        .sort();
    const cachedImages = assets.filter((asset) => asset.startsWith('./images/')).sort();
    assert.deepEqual(cachedImages, allImages, 'every local image should be available after a fresh offline install');
});

test('service worker shell cache includes every local JavaScript and stylesheet loaded by index.html', () => {
    const assetsBlock = worker.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/);
    assert.ok(assetsBlock, 'service worker must define its static app shell');
    const cachedAssets = new Set([...assetsBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
    const localEntrypoints = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="((?:\.\/)?(?:js|css)\/[^\"]+)"/g)]
        .map((match) => `./${match[1].replace(/^\.\//, '')}`);

    assert.ok(localEntrypoints.length > 0, 'index.html must reference local scripts or stylesheets');
    for (const asset of localEntrypoints) {
        assert.ok(cachedAssets.has(asset), `local app entrypoint must be available offline: ${asset}`);
    }
});

test('service worker uses a versioned shell cache and removes older versions', () => {
    assert.match(worker, /const CACHE_NAME = 'enl-shell-v\d+';/);
    assert.match(worker, /cacheName\.startsWith\('enl-shell-'\)[\s\S]*?caches\.delete\(cacheName\)/);
    assert.match(worker, /async function copyCachedExternalScript\(/);
    assert.match(worker, /targetCache\.put\(request, cachedResponse\.clone\(\)\)/);
    assert.match(worker, /if \(response\.type === 'opaque'\) \{[\s\S]*?if \(await copyCachedExternalScript\(cache, request\)\) return;[\s\S]*?await cache\.put\(request, response\.clone\(\)\)/);
});

test('service worker caches pinned Firebase SDK files but bypasses Firebase data requests', () => {
    const sdkAssets = [...worker.matchAll(/'((?:https:\/\/www\.gstatic\.com\/firebasejs\/)[^']+)'/g)]
        .map((match) => match[1]);
    const scriptSdkAssets = [...html.matchAll(/<script src="(https:\/\/www\.gstatic\.com\/firebasejs\/[^\"]+)"/g)]
        .map((match) => match[1]);

    assert.deepEqual(sdkAssets, scriptSdkAssets);
    assert.match(worker, /https:\/\/cdn\.jsdelivr\.net\/npm\/ts-fsrs@5\.4\.2\/dist\/index\.umd\.js/);
    assert.match(worker, /'\.\/js\/spaced-review\.js'/);
    assert.match(worker, /requestUrl\.origin !== self\.location\.origin/);
    assert.match(worker, /FIREBASE_SDK_ASSETS\.includes\(url\.href\)/);
    assert.match(worker, /if \(request\.method !== 'GET'\) return/);
});

test('runtime opaque CDN responses preserve a cached pinned script', () => {
    assert.match(worker, /if \(response\.type === 'opaque'\) \{\s*const cachedResponse = await cache\.match\(request\);\s*if \(cachedResponse\) return cachedResponse;/);
    assert.match(worker, /if \(await copyCachedExternalScript\(cache, request\)\) \{\s*return await cache\.match\(request\) \|\| response;\s*\}/);
});
