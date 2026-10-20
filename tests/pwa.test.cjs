const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

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
    const localEntrypoints = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="((?:\.\/)?(?:js|css|functions\/shared)\/[^\"]+)"/g)]
        .map((match) => `./${match[1].replace(/^\.\//, '')}`);

    assert.ok(localEntrypoints.length > 0, 'index.html must reference local scripts or stylesheets');
    for (const asset of localEntrypoints) {
        assert.ok(cachedAssets.has(asset), `local app entrypoint must be available offline: ${asset}`);
    }
});

test('service worker uses a versioned app-shell cache and removes older versions', () => {
    assert.match(worker, /const CACHE_NAME = 'enl-shell-v\d+';/);
    assert.match(worker, /cacheName\.startsWith\('enl-shell-'\)[\s\S]*?caches\.delete\(cacheName\)/);
    assert.doesNotMatch(worker, /cacheExternalScripts|copyCachedExternalScript/);
});

test('service worker leaves remote SDK scripts and Firebase requests to the browser network', () => {
    const scriptSdkAssets = [...html.matchAll(/<script src="(https:\/\/www\.gstatic\.com\/firebasejs\/[^\"]+)"/g)]
        .map((match) => match[1]);

    assert.equal(scriptSdkAssets.length, 4);
    assert.match(worker, /'\.\/js\/spaced-review\.js'/);
    assert.match(worker, /requestUrl\.origin !== self\.location\.origin/);
    assert.doesNotMatch(worker, /firebasejs\/13\.0\.0|ts-fsrs@5\.4\.2/);
    assert.match(worker, /if \(request\.method !== 'GET'\) return/);
});

test('activation removes old CDN errors, serves the offline shell, and bypasses remote scripts', async () => {
    const scriptUrl = 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js';
    const currentCacheName = worker.match(/const CACHE_NAME = '(enl-shell-v(\d+))';/)?.[1];
    const currentVersion = Number(worker.match(/const CACHE_NAME = 'enl-shell-v(\d+)';/)?.[1]);
    const oldCacheName = `enl-shell-v${currentVersion - 1}`;
    const cacheStore = new Map();
    const oldEntries = new Map([[scriptUrl, { type: 'opaque', label: 'stale CDN error', clone() { return this; } }]]);
    cacheStore.set(oldCacheName, oldEntries);
    const listeners = new Map();
    const requestKey = (request) => typeof request === 'string' ? request : request.url;
    let networkFetchCount = 0;

    class FakeRequest {
        constructor(url, options = {}) {
            this.url = String(url);
            this.mode = options.mode || 'cors';
            this.destination = options.destination || '';
            this.method = options.method || 'GET';
        }
    }

    const cachesApi = {
        async open(name) {
            if (!cacheStore.has(name)) cacheStore.set(name, new Map());
            const entries = cacheStore.get(name);
            return {
                async addAll(assetUrls) {
                    for (const assetUrl of assetUrls) {
                        const label = assetUrl.endsWith('/index.html') ? 'cached index.html' : `cached ${assetUrl}`;
                        entries.set(assetUrl, { type: 'basic', label, clone() { return this; } });
                    }
                },
                async match(request) { return entries.get(requestKey(request)); },
                async put(request, response) { entries.set(requestKey(request), response); }
            };
        },
        async keys() { return [...cacheStore.keys()]; },
        async delete(name) { return cacheStore.delete(name); }
    };

    const self = {
        location: { origin: 'https://wolfschiffer.github.io' },
        registration: { scope: 'https://wolfschiffer.github.io/EnglishNextLevel/' },
        addEventListener(type, listener) { listeners.set(type, listener); },
        async skipWaiting() {},
        clients: { async claim() {} }
    };
    let networkOffline = false;
    const context = {
        self,
        caches: cachesApi,
        Request: FakeRequest,
        URL,
        Response: { error() { return { type: 'error' }; } },
        fetch: async () => {
            networkFetchCount += 1;
            if (networkOffline) throw new Error('offline');
            return { type: 'opaque', ok: false, clone() { return this; } };
        }
    };

    vm.runInNewContext(worker, context, { filename: 'service-worker.js' });

    let installPromise;
    listeners.get('install')({ waitUntil(promise) { installPromise = promise; } });
    await installPromise;

    assert.ok(currentCacheName, 'service worker should define the current shell cache');
    assert.equal(cacheStore.has(currentCacheName), true, 'install should create the current shell cache');
    assert.equal(networkFetchCount, 0, 'install should not fetch remote scripts that cannot be validated');

    let activatePromise;
    listeners.get('activate')({ waitUntil(promise) { activatePromise = promise; } });
    await activatePromise;
    assert.equal(cacheStore.has(oldCacheName), false, 'activation should remove the cache that may contain the old error');

    networkOffline = true;
    const navigationRequest = new FakeRequest(new URL('offline-route', self.registration.scope).href, {
        mode: 'navigate',
        destination: 'document'
    });
    let offlineNavigationResponse;
    listeners.get('fetch')({
        request: navigationRequest,
        respondWith(promise) { offlineNavigationResponse = promise; }
    });
    assert.equal(await offlineNavigationResponse.then((response) => response.label), 'cached index.html');

    const request = new FakeRequest(scriptUrl, { mode: 'no-cors', destination: 'script' });
    let wasIntercepted = false;
    listeners.get('fetch')({
        request,
        respondWith() { wasIntercepted = true; }
    });

    assert.equal(wasIntercepted, false, 'the browser should fetch remote scripts directly after recovery');
    assert.equal(cacheStore.get(currentCacheName).has(scriptUrl), false, 'remote scripts must not remain in the shell cache');
    assert.equal(networkFetchCount, 1, 'the service worker should make no network call for a bypassed remote script');
});
