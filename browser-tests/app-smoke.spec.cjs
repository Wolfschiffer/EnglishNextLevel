const fs = require('node:fs');
const path = require('node:path');
const { expect, test } = require('@playwright/test');

const baseURL = 'http://127.0.0.1:4173/EnglishNextLevel/';
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
