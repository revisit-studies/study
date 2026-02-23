/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { checkSavedAnswers } from './checkSavedAnswers';
import {
  nextClick,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('Test library VLAT full sequence', async ({ page }) => {
  await resetClientStudyState(page);
  await page.goto('/library-vlat');

  await expect(page.getByRole('heading', { name: 'VLAT: Assessing Visual Literacy' })).toBeVisible();
  await nextClick(page);

  const questionArray = new Array(53).fill(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const idx of questionArray) {
    const questionText = page.getByText('Task:');
    await expect(questionText).toBeVisible();
    await expect(page.getByRole('main').getByRole('img')).toBeVisible();
    await page.locator('input[type="radio"]').first().click();
    await nextClick(page);
  }

  await waitForStudyEndMessage(page);

  await checkSavedAnswers(page, 'library-vlat');
});
