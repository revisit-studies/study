/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { nextClick, waitForStudyEndMessage } from './utils';

test('Test React component with reactive response', async ({ page }) => {
  const trialLen = 2;
  await page.goto('/');

  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'React Stimulus and Provenance Tracking' })
    .getByText('Go to Study')
    .click();

  await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();
  await nextClick(page);

  // Check click accuracy test
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < trialLen; i++) {
    const questionText = await page.getByText('Task:');
    await expect(questionText).toBeVisible();

    const emptyAnswers = await page.getByRole('listitem');
    await expect(await emptyAnswers.count()).toEqual(0);

    await page.getByRole('main').getByRole('img').click();

    // Sleep for 100ms to allow the answer to register
    await page.waitForTimeout(100);

    const oneAnswer = await page.getByRole('listitem');
    await expect(await oneAnswer.count()).toEqual(1);

    await nextClick(page);
    await page.waitForTimeout(100);
  }
  // Check that the thank you message is displayed
  await waitForStudyEndMessage(page);
});
