const { test, expect, chromium } = require('@playwright/test'), path = require('path');
test('extension loads: service worker runs and the content script tags the page', async () => {
  const ext = path.join(__dirname, '..', 'extension');
  const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  expect(sw.url()).toMatch(/^chrome-extension:\/\/.+\/sw\.js$/);
  const page = await ctx.newPage();
  await page.route('https://fixture.test/', r => r.fulfill({ body: '<p>hi</p>', contentType: 'text/html' }));
  await page.goto('https://fixture.test/');
  await expect(page.locator('html')).toHaveAttribute('data-fixture', 'loaded');
  await ctx.close();
});
