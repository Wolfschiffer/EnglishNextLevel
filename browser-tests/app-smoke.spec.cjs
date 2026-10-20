const fs = require('node:fs');
const path = require('node:path');
const { expect, test } = require('@playwright/test');

const testPort = require('../scripts/test-port.cjs');
const baseURL = `http://127.0.0.1:${testPort}/EnglishNextLevel/`;
const appOrigin = new URL(baseURL).origin;
const firebaseSdkStub = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'firebase-sdk-stub.js'),
    'utf8'
);

async function isolateBrowserNetwork(context, { provideFirebaseStub = false } = {}) {
    await context.route('**/*', async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin === appOrigin) return route.continue();

        if (provideFirebaseStub &&
            requestUrl.origin === 'https://www.gstatic.com' &&
            requestUrl.pathname.startsWith('/firebasejs/13.0.0/')) {
            return route.fulfill({
                status: 200,
                contentType: 'text/javascript; charset=utf-8',
                body: firebaseSdkStub
            });
        }

        return route.abort('blockedbyclient');
    });
}

async function expectNoHorizontalOverflow(page) {
    const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectNoHorizontalOverflowAtWidths(page, widths) {
    for (const width of widths) {
        await page.setViewportSize({ width, height: 844 });
        await expectNoHorizontalOverflow(page);
    }
}

test('login tabs work by keyboard at a 390 px viewport without overflow', async ({ page }) => {
    await isolateBrowserNetwork(page.context(), { provideFirebaseStub: true });
    await page.goto('./');

    await expect(page.getByRole('heading', { name: 'English Next Level' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Login' })).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.enlFirebaseEnvironment)).toBe('test');
    expect(await page.evaluate(() => window.EnlFirebaseEnvironment.current.firebaseConfig.projectId))
        .toBe('demo-english-next-level');

    await page.getByRole('tab', { name: 'Login' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Register' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#register-form')).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Login' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#login-form')).toBeVisible();
    await expectNoHorizontalOverflow(page);
});

test('guest can navigate between the home, Words, and Topics screens on mobile', async ({ page }) => {
    await isolateBrowserNetwork(page.context(), { provideFirebaseStub: true });
    await page.goto('./');

    await page.getByRole('button', { name: 'Continue as Guest' }).click();
    await expect(page.locator('#category-container')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Open Words' }).click();
    await expect(page.locator('#words-menu-container')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.locator('#simple-verbs-btn').click();
    await expect(page.locator('#simple-verbs-submenu')).toBeVisible();
    await page.locator('#simple-verbs-submenu .game-card[data-words-mode="verbs1"]').click();
    await expect(page.locator('#vocab-game-container')).toBeVisible();
    await expect(page.locator('#vocab-start-overlay')).toHaveAttribute('aria-hidden', 'false');
    await page.locator('#vocab-start-btn').click();
    await expect(page.locator('#vocab-start-overlay')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#english-words-list .english-item')).toHaveCount(10);
    await expect(page.locator('#portuguese-words-list .portuguese-item')).toHaveCount(10);

    const englishCard = page.locator('#english-words-list .english-item').first();
    const wordId = await englishCard.getAttribute('data-id');
    await englishCard.focus();
    await englishCard.press('Enter');
    const matchingPortugueseCard = page.locator(
        `#portuguese-words-list .portuguese-item[data-id="${wordId}"]`
    );
    await matchingPortugueseCard.focus();
    await matchingPortugueseCard.press('Enter');
    await expect(page.locator('#vocab-matches')).toHaveText('1');
    await expect(page.locator('#english-words-list .english-item.locked')).toHaveCount(1);
    await expect(page.locator('#portuguese-words-list .portuguese-item.locked')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);

    await page.locator('#back-to-category-from-vocab').click();
    await expect(page.locator('#words-menu-container')).toBeVisible();
    await expect(page.locator('#simple-verbs-submenu')).toBeVisible();
    await page.locator('#back-to-category-from-words').click();
    await expect(page.locator('#simple-verbs-btn')).toBeVisible();
    await expect(page.locator('#simple-verbs-submenu')).toBeHidden();
    await page.locator('#back-to-category-from-words').click();
    await expect(page.locator('#category-container')).toBeVisible();
    await page.getByRole('button', { name: 'Open Topics' }).click();
    await expect(page.locator('#topics-menu-container')).toBeVisible();
    await expectNoHorizontalOverflow(page);
});

test('guest can start a Numbers round and answer on mobile', async ({ page }) => {
    await isolateBrowserNetwork(page.context(), { provideFirebaseStub: true });
    await page.goto('./');

    await page.getByRole('button', { name: 'Continue as Guest' }).click();
    await page.getByRole('button', { name: 'Open Numbers' }).click();
    await expect(page.locator('#numbers-menu-container')).toBeVisible();

    await page.locator('#numbers-menu-container [data-numbers-mode="numbers"]').click();
    await expect(page.locator('#game-container')).toBeVisible();
    await page.locator('#start-game-btn').click();

    const prompt = page.locator('#wordDisplay');
    await expect(prompt).not.toHaveText('Ready?');
    await expect(page.locator('#game-platforms .platform')).toHaveCount(3);

    const word = (await prompt.textContent()).trim();
    const correctValue = await page.evaluate((currentWord) => {
        return window.EnglishNextLevelNumbersData.gameData.numbers
            .find((number) => number.word === currentWord)?.value ?? null;
    }, word);
    expect(correctValue).not.toBeNull();

    await page.locator(`#game-platforms .platform[data-value="${correctValue}"]`).click();
    await expect(page.locator('#score')).not.toHaveText('0');
    await expectNoHorizontalOverflow(page);
});

test('guest home, Words, and Numbers screens fit common viewport widths', async ({ page }) => {
    const viewportWidths = [320, 390, 560, 768, 821, 980, 1280];
    const mobileViewport = { width: 390, height: 844 };

    await isolateBrowserNetwork(page.context(), { provideFirebaseStub: true });
    await page.goto('./');
    await page.getByRole('button', { name: 'Continue as Guest' }).click();
    await expectNoHorizontalOverflowAtWidths(page, viewportWidths);

    await page.setViewportSize(mobileViewport);
    await page.getByRole('button', { name: 'Open Words' }).click();
    await expectNoHorizontalOverflowAtWidths(page, viewportWidths);

    await page.setViewportSize(mobileViewport);
    await page.locator('#simple-verbs-btn').click();
    await page.locator('#simple-verbs-submenu .game-card[data-words-mode="verbs1"]').click();
    await page.locator('#vocab-start-btn').click();
    await expectNoHorizontalOverflowAtWidths(page, viewportWidths);

    await page.setViewportSize(mobileViewport);
    await page.locator('#back-to-category-from-vocab').click();
    await page.locator('#back-to-category-from-words').click();
    await page.locator('#back-to-category-from-words').click();
    await page.getByRole('button', { name: 'Open Numbers' }).click();
    await expectNoHorizontalOverflowAtWidths(page, viewportWidths);

    await page.setViewportSize(mobileViewport);
    await page.locator('#numbers-menu-container [data-numbers-mode="numbers"]').click();
    await page.locator('#start-game-btn').click();
    await expectNoHorizontalOverflowAtWidths(page, viewportWidths);
});

test('guest Topics and Speak screens fit common viewport widths', async ({ page }) => {
    const viewportWidths = [320, 390, 560, 768, 821, 980, 1280];
    const mobileViewport = { width: 390, height: 844 };

    await isolateBrowserNetwork(page.context(), { provideFirebaseStub: true });
    await page.addInitScript(() => {
        window.__enlRecognitionStartCalls = 0;
        class SpeechRecognitionStub {
            start() {
                window.__enlRecognitionStartCalls += 1;
            }

            abort() {}
            stop() {}
        }
        window.SpeechRecognition = SpeechRecognitionStub;
        window.webkitSpeechRecognition = SpeechRecognitionStub;
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Continue as Guest' }).click();
    await page.getByRole('button', { name: 'Open Topics' }).click();
    await expectNoHorizontalOverflowAtWidths(page, viewportWidths);

    await page.setViewportSize(mobileViewport);
    await page.locator('#topics-grid [data-topic-id="kitchen"]').click();
    await expect(page.locator('#topic-level-container')).toBeVisible();
    await expectNoHorizontalOverflowAtWidths(page, viewportWidths);

    await page.setViewportSize(mobileViewport);
    await page.locator('#topic-level-container [data-topic-level="common"]').click();
    await expect(page.locator('#topic-game-menu-container')).toBeVisible();
    await expectNoHorizontalOverflowAtWidths(page, viewportWidths);

    for (const [width, expectedColumns] of [[320, 1], [360, 1], [361, 2], [390, 2]]) {
        await page.setViewportSize({ width, height: 844 });
        await expectNoHorizontalOverflow(page);
        const columnCount = await page.locator('#topic-volume-grid')
            .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length);
        expect(columnCount).toBe(expectedColumns);

        if (width === 320) {
            const volumeLabelLineCounts = await page.locator('#topic-volume-grid .topic-volume-copy strong')
                .evaluateAll((labels) => labels.map((label) => {
                    const range = document.createRange();
                    range.selectNodeContents(label);
                    return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
                }));
            expect(volumeLabelLineCounts).toEqual([1, 1]);
        }
    }

    await page.setViewportSize(mobileViewport);
    await page.locator('#topic-game-menu-container [data-topic-game="speak"]').click();
    await expect(page.locator('#topic-speak-container')).toBeVisible();
    await expect(page.locator('#topic-speak-start-overlay')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#topic-speak-start-title')).toBeVisible();
    await expect(page.locator('#topic-speak-start-title')).toHaveText('Ready?');
    await expectNoHorizontalOverflowAtWidths(page, viewportWidths);
    expect(await page.evaluate(() => window.__enlRecognitionStartCalls)).toBe(0);
});

test('installed app shell can reload and navigate as a guest offline', async ({ browser }) => {
    const context = await browser.newContext({
        serviceWorkers: 'allow',
        viewport: { width: 390, height: 844 }
    });

    try {
        await isolateBrowserNetwork(context);
        const page = await context.newPage();
        await page.goto('./');
        await page.evaluate(() => navigator.serviceWorker.ready);

        await expect.poll(() => page.evaluate(async () => {
            const cacheNames = await caches.keys();
            return cacheNames.some((cacheName) => cacheName.startsWith('enl-shell-'));
        })).toBe(true);

        await page.reload();
        await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
        await context.setOffline(true);
        await page.reload();

        await expect(page.getByRole('button', { name: 'Continue as Guest' })).toBeVisible();
        await page.getByRole('button', { name: 'Continue as Guest' }).click();
        await page.getByRole('button', { name: 'Open Topics' }).click();
        await expect(page.locator('#topics-menu-container')).toBeVisible();
        await expectNoHorizontalOverflow(page);
    } finally {
        await context.close();
    }
});
