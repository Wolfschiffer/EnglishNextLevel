const { defineConfig } = require('@playwright/test');

const baseURL = 'http://127.0.0.1:4173/EnglishNextLevel/';

module.exports = defineConfig({
    testDir: './browser-tests',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    workers: process.env.CI ? 1 : undefined,
    reporter: 'list',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    use: {
        baseURL,
        browserName: 'chromium',
        serviceWorkers: 'allow',
        viewport: { width: 390, height: 844 },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure'
    },
    webServer: {
        command: 'node scripts/serve-test-site.cjs',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 30_000,
        stdout: 'ignore',
        stderr: 'pipe'
    }
});
