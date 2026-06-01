import { expect, test } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
} from './utils';

test.describe('analysis, settings, and response smoke coverage', () => {
  test('analysis empty state and settings auth gate render from top-level routes', async ({ page }) => {
    await page.goto('/analysis/stats/');
    await expect(page.getByText('Select a study from the header menu to view analysis data.')).toBeVisible({ timeout: 15000 });

    await page.goto('/settings/');
    await expect(page.getByText(/Sign In With/i)).toBeVisible({ timeout: 15000 });
  });

  test('participant response page renders real inputs from a demo study', async ({ page }) => {
    await page.setViewportSize({
      width: 1400,
      height: 900,
    });

    await resetClientStudyState(page);
    await openStudyFromLanding(page, 'Demo Studies', 'Form Elements Demo');
    await nextClick(page);

    await expect(page.getByPlaceholder('Enter your age here, range from 0 - 100')).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder('Enter your answer here')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Option 2' }).first()).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Option 2' }).first()).toBeVisible();
  });
});
