import { expect, test } from '@playwright/test';

test('shows detected browser size in small-resolution warning', async ({ browser }) => {
  const page = await browser.newPage();
  await page.setViewportSize({
    width: 350,
    height: 700,
  });

  await page.goto('/');

  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'HTML as a Stimulus' })
    .nth(0)
    .getByText('Go to Study')
    .click();

  await expect(page.getByRole('heading', { name: 'Screen Resolution Warning' })).toBeVisible();
  await expect(page.getByText('Detected: Width: 350px Height: 700px')).toBeVisible();
});
