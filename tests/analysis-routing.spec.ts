import { expect, test } from '@playwright/test';

test.describe('analysis route fallbacks', () => {
  test('/analysis redirects to /analysis/stats and shows empty-state guidance', async ({ page }) => {
    await page.goto('/analysis/');
    await expect(page).toHaveURL(/\/analysis\/stats\/?$/);
    await expect(page.getByText('Select a study from the header menu to view analysis data.')).toBeVisible({ timeout: 15000 });
  });

  test('/analysis/stats shows empty-state guidance', async ({ page }) => {
    await page.goto('/analysis/stats/');
    await expect(page.getByText('Select a study from the header menu to view analysis data.')).toBeVisible({ timeout: 15000 });
  });
});
