import { test, expect } from '@playwright/test';
import { nextClick, resetClientStudyState } from './utils';

test('shows the timeout warning and auto-advances to the next component', async ({ page }) => {
  await resetClientStudyState(page);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Tests' }).click();
  await page
    .getByLabel('Tests')
    .locator('div')
    .filter({ hasText: 'Component Timeout Auto-Advance Test' })
    .getByText('Go to Study')
    .first()
    .click();

  await expect(page.getByText('Press next to begin the timeout auto-advance test.')).toBeVisible();
  await nextClick(page);

  await expect(page.getByText('Do not answer this question. It should automatically advance.')).toBeVisible();
  await expect(page.getByText(/Custom timeout warning: advancing in \d+ second(?:s)? without saving this component\./)).toBeVisible({ timeout: 2500 });

  await expect(page.getByText('Timeout auto-advance test complete.')).toBeVisible();
});
