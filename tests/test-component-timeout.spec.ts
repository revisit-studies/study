import { test, expect } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('shows the timeout warning and auto-advances to the next component', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Test Studies', 'Component Timeout Auto-Advance Test');

  await expect(page.getByText('Press next to begin the timeout auto-advance test.')).toBeVisible();
  await nextClick(page);

  await expect(page.getByText('Do not answer this question. It should automatically advance.')).toBeVisible();
  await expect(page.getByText(/Custom timeout warning: advancing in \d+ seconds without saving this component\./)).toBeVisible({ timeout: 2500 });

  await waitForStudyEndMessage(page);
  await expect(page.getByText('Timeout auto-advance test complete.')).toBeVisible();
});
