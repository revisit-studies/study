import { test, expect } from '@playwright/test';

test('test', async ({ browser }) => {
  const page = await browser.newPage();
  await page.setViewportSize({
    width: 1200,
    height: 800,
  });

  await page.goto('/');

  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'HTML as a Stimulus' })
    .nth(0)
    .getByText('Go to Study')
    .click();
  await page.getByRole('tab', { name: 'All Trials View' }).click();

  await page.getByLabel('All Trials View').locator('a').filter({ hasText: 'barChart' }).click();
  const iframe = await page.frameLocator('iframe').getByRole('img');
  await expect(iframe).toBeVisible();

  await page.getByLabel('All Trials View').locator('a').filter({ hasText: 'introduction' }).click();
  const introText = await page.getByText('Welcome to our study. This is');
  await expect(introText).toBeVisible();

  await page.getByLabel('All Trials View').locator('a').filter({ hasText: 'end' }).click();
  const endText = await page.getByText('Please wait');
  await expect(endText).toBeVisible();
});
