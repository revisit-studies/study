import { test, expect } from '@playwright/test';
import { openStudyFromLanding, resetClientStudyState } from './utils';

test('mapped shortcuts work when a response option is focused', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Tests', 'Test Keymapper');

  const leftOption = page.getByRole('radio', { name: 'Left' });
  const rightOption = page.getByRole('radio', { name: 'Right' });
  await expect(leftOption).toBeVisible();
  await rightOption.focus();

  await page.keyboard.press('ArrowLeft');

  await expect(leftOption).toBeChecked();
  await expect(rightOption).not.toBeChecked();
});
