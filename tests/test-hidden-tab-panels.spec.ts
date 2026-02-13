import { expect, test } from '@playwright/test';

test('inactive study tabs are removed from the DOM', async ({ page }) => {
  await page.goto('/');

  const testsDescription = page.getByText('These studies exist for testing purposes.');
  const librariesDescription = page.getByText('Here you can see an example of every library that we publish.');

  await page.getByRole('tab', { name: 'Tests' }).click();
  await expect(testsDescription).toBeVisible();
  await expect(librariesDescription).toHaveCount(0);

  await page.getByRole('tab', { name: 'Libraries' }).click();
  await expect(librariesDescription).toBeVisible();
  await expect(testsDescription).toHaveCount(0);
});
