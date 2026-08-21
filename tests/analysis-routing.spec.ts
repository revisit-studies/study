import { expect, test } from '@playwright/test';

const emptyStateMessage = 'Select a study from the header menu to view analysis data.';
const emptyStateTimeout = 15000;

test.describe('analysis route fallbacks', () => {
  test('/analysis redirects to /analysis/stats', async ({ page }) => {
    await page.goto('/analysis/');
    await expect(page).toHaveURL(/\/analysis\/stats\/?$/);
  });

  test('/analysis/stats shows empty-state guidance', async ({ page }) => {
    await page.goto('/analysis/stats/');
    await expect(page.getByText(emptyStateMessage)).toBeVisible({ timeout: emptyStateTimeout });
  });
});
