import { expect, test } from '@playwright/test';

test('next participant button is unavailable when study browser is unmounted', async ({ page }) => {
  await page.goto('/test-library');

  const appAside = page.getByTestId('app-aside');
  await expect(appAside.getByRole('button', { name: 'Next Participant' })).toBeVisible();

  await page.locator('.studyBrowserMenuDropdown').click();
  await page.getByRole('menuitem', { name: 'Study Browser' }).click();

  await expect(appAside).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next Participant' })).toHaveCount(0);
});
