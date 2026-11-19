import { test, expect } from '@playwright/test';
import { nextClick, resetClientStudyState, showOptionalLandingSections } from './utils';

test('shows the timeout warning and auto-advances to the next component', async ({ page }) => {
  await resetClientStudyState(page);
  await showOptionalLandingSections(page);
  await page.goto('/');
  await page
    .getByRole('region', { name: 'Tests', exact: true })
    .locator('.mantine-Card-root')
    .filter({ hasText: 'Component Timeout Auto-Advance Test' })
    .getByRole('button', { name: 'Go to Study', exact: true })
    .click();

  await expect(page.getByText('Press next to begin the timeout auto-advance test.')).toBeVisible();
  await nextClick(page);

  await expect(page.getByText('Do not answer this question. It should automatically advance.')).toBeVisible();
  await expect(page.getByText(/Custom timeout warning: advancing in \d+ second(?:s)? without saving this component\./)).toBeVisible({ timeout: 2500 });

  await expect(page.getByText('Timeout auto-advance test complete.')).toBeVisible();
});
