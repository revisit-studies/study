import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'HTML as a Stimulus' }).click();
  await page.getByRole('tab', { name: 'All Trials View' }).click();

  await page.getByLabel('All Trials View').locator('a').filter({ hasText: 'barChart' }).click();
  await page.frameLocator('iframe').getByRole('img').click();

  await page.getByLabel('All Trials View').locator('a').filter({ hasText: 'introduction' }).click();
  const introText = await page.getByText('Welcome to our study. This is');
  await expect(introText).toBeVisible();

  await page.getByLabel('All Trials View').locator('a').filter({ hasText: 'end' }).click();
  const endText = await page.getByText('Please wait');
  await expect(endText).toBeVisible();
});
