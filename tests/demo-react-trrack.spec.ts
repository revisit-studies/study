/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('Test React Stroop component with reactive response', async ({ page }) => {
  const trials = [
    { word: 'RED', answer: 'BLUE' },
    { word: 'GREEN', answer: 'PINK' },
  ] as const;

  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'React Stimulus with Trrack library');

  await expect(page.getByText(/Stroop color test/i)).toBeVisible();
  await nextClick(page);

  for (const { word, answer } of trials) {
    await expect(page.getByText('Task:')).toBeVisible();
    await expect(page.getByText(word, { exact: true })).toBeVisible();

    const listItems = page.getByRole('listitem');
    await expect(listItems).toHaveCount(0);

    const textInput = page.getByRole('textbox');
    await textInput.fill(answer);

    await page.waitForTimeout(100);

    await expect(listItems).toHaveCount(1);
    await expect(listItems.first()).toHaveText(answer);

    await nextClick(page);
    await page.waitForTimeout(100);
  }

  await waitForStudyEndMessage(page);
});
