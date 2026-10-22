// Increment this when app-shell files change so returning visitors fetch the new build.
const CACHE_NAME = 'enl-shell-v58';

const SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/style.css',
    './css/topics.css',
    './css/topic-icons.css',
    './css/app-shell.css',
    './css/words-game.css',
    './css/progress.css',
    './css/mobile-nav.css',
    './js/debug.js',
    './js/firebase-environment.js',
    './js/firebase-offline-fallback.js',
    './js/auth-tabs.js',
    './js/password-reset.js',
    './js/email-verification.js',
    './js/auth-ui.js',
    './js/firebase-config.js',
    './js/leaderboard-storage.js',
    './js/leaderboard-client.js',
    './js/leaderboard-dialog.js',
    './js/numbers-leaderboard.js',
    './js/numbers-result-dialog.js',
    './js/numbers-run-client.js',
    './js/keyboard-accessibility.js',
    './js/words-data.js',
    './js/numbers-data.js',
    './js/numbers-run-session.js',
    './js/numbers-scoring.js',
    './js/numbers-high-score-storage.js',
    './js/numbers-high-score-profile.js',
    './js/audio-engines.js',
    './js/audio-settings.js',
    './js/vocabulary-scoring.js',
    './js/words-speech.js',
    './js/vocabulary-result-dialog.js',
    './js/vocabulary-start-dialog.js',
    './js/vocabulary-touch-input.js',
    './js/vocabulary-renderer.js',
    './js/vocabulary-matching.js',
    './js/vocabulary-game.js',
    './js/game.js',
    './js/category-navigation.js',
    './js/numbers-eagle.js',
    './js/numbers-image-loader.js',
    './js/numbers-round-feedback.js',
    './js/numbers-answer-options.js',
    './js/numbers-fallback-questions.js',
    './js/numbers-game.js',
    './functions/shared/progress-profile-data.js',
    './js/progress-profile-mutations.js',
    './js/progress-profile-summary.js',
    './js/progress-profile-renderer.js',
    './js/progress-profile.js',
    './js/spaced-review.js',
    './js/vendor/ts-fsrs-5.4.2.umd.js',
    './js/mobile-nav.js',
    './js/topics/data/kitchen.js',
    './js/topics/data/adjectives.js',
    './js/topics/data/feelings.js',
    './js/topics/data/house.js',
    './js/topics/data/bathroom.js',
    './js/topics/data/bedroom.js',
    './js/topics/data/livingRoom.js',
    './js/topics/data/body.js',
    './js/topics/data/summerClothes.js',
    './js/topics/data/winterClothes.js',
    './js/topics/data/transitionalClothes.js',
    './js/topics/data/airport.js',
    './js/topics/data/linkingWords.js',
    './js/topics/topics-data.js',
    './js/topics/match-pairs.js',
    './js/topics/speech-answer.js',
    './js/topics/speech-audio.js',
    './js/topics/speech-settings.js',
    './js/topics/speech-recognition.js',
    './js/topics/speech-page-lifecycle.js',
    './js/topics/speech-game.js',
    './js/topics/speech-ui.js',
    './js/topics/topics-menu.js',
    './js/topics/topic-stats.js',
    './js/pwa-register.js',
    './images/brand/eagle-logo.png',
    './images/pwa-icon-192.png',
    './images/pwa-icon-512.png',
    './images/brand/modes/icon-numbers.png',
    './images/brand/modes/icon-words.png',
    './images/brand/modes/icon-topics.png',
    './images/eagle-transparent.png',
    './images/flap_01.png',
    './images/flap_02.png',
    './images/flap_03.png',
    './images/flap_04.png',
    './images/flap_05.png',
    './images/flap_06.png',
    './images/flap_07.png',
    './images/flap_08.png',
    './images/flap_09.png',
    './images/flap_10.png',
    './images/flap_11.png',
    './images/flap_12.png',
    './images/flap_13.png',
    './images/flap_14.png',
    './images/flap_15.png',
    './images/flap_16.png',
    './images/flap_17.png',
    './images/flap_18.png',
    './images/eagle_center_01.png',
    './images/eagle_center_02.png',
    './images/eagle_center_03.png',
    './images/eagle_center_04.png',
    './images/eagle_center_05.png',
    './images/eagle_center_06.png',
    './images/eagle_center_07.png',
    './images/eagle_center_08.png',
    './images/eagle_center_09.png',
    './images/eagle_center_10.png',
    './images/eagle_center_11.png',
    './images/eagle_wrong_01.png',
    './images/eagle_wrong_02.png',
    './images/eagle_wrong_03.png',
    './images/eagle_wrong_04.png',
    './images/eagle_wrong_05.png',
    './images/eagle_wrong_06.png',
    './images/eagle_wrong_07.png',
    './images/eagle_wrong_08.png',
    './images/eagle_wrong_09.png',
    './images/eagle_wrong_10.png',
    './images/eagle_wrong_11.png',
    './images/eagle_wrong_12.png',
    './images/eagle_wrong_13.png',
    './images/eagle_wrong_14.png',
    './images/eagle_wrong_15.png',
    './images/eagle_wrong_16.png',
    './images/eagle_wrong_17.png',
    './images/eagle_wrong_18.png',
    './images/eagle_wrong_19.png',
    './images/topics/adjectives.png',
    './images/topics/airport.png',
    './images/topics/bathroom.png',
    './images/topics/bedroom.png',
    './images/topics/body.png',
    './images/topics/feelings.png',
    './images/topics/house.png',
    './images/topics/kitchen.png',
    './images/topics/level-advanced-cap.png',
    './images/topics/level-common-book.png',
    './images/topics/linking-words.png',
    './images/topics/living-room.png',
    './images/topics/spring-autumn-clothes.png',
    './images/topics/summer-clothes.png',
    './images/topics/winter-clothes.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        const appAssets = SHELL_ASSETS.map((asset) => new URL(asset, self.registration.scope).href);
        await cache.addAll(appAssets);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter((cacheName) => cacheName.startsWith('enl-shell-') && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const requestUrl = new URL(request.url);
    const scopeUrl = new URL(self.registration.scope);
    if (requestUrl.origin !== self.location.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) return;

    const isNavigation = request.mode === 'navigate';
    const isStaticAsset = ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination);
    if (!isNavigation && !isStaticAsset) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const response = await fetch(request);
            if (response.ok && new URL(response.url || request.url).origin === self.location.origin) {
                await cache.put(request, response.clone());
            }
            return response;
        } catch (error) {
            const cachedResponse = await cache.match(request, { ignoreSearch: true });
            if (cachedResponse) return cachedResponse;
            if (isNavigation) {
                return await cache.match(new URL('index.html', self.registration.scope).href) || Response.error();
            }
            return Response.error();
        }
    })());
});
