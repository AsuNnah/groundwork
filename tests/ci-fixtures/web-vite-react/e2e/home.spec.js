import { expect, test } from '@playwright/test';
test('home shows the sum', async ({ page }) => { await page.goto('/'); await expect(page.locator('h1')).toHaveText('1 + 2 = 3'); });
