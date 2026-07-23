import { expect, test } from '@playwright/test';

test('shows an actionable fallback when the global config request fails', async ({ page }) => {
  await page.route('**/global.json', (route) => route.abort('failed'));

  await page.goto('/?startup-error-regression=1');

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('heading', { name: 'ReVISit could not load' })).toBeFocused();
  const reloadButton = alert.getByRole('button', { name: 'Reload' });
  await expect(reloadButton).toBeVisible();

  const currentUrl = page.url();
  await reloadButton.click();

  await expect(alert).toBeVisible();
  expect(page.url()).toBe(currentUrl);
});
