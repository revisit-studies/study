/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  const trialLen = 2;
  await page.goto('/');

  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'Dynamic React Stimuli and Provenance Tracking' })
    .getByText('Go to Study')
    .click();

  // Check for introduction page
  const introText = await page.getByRole('heading', { name: 'Introduction' });
  await expect(introText).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check click accuracy test
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < trialLen; i++) {
    const questionText = await page.getByText('Task:');
    await expect(questionText).toBeVisible();

    const emptyAnswers = await page.getByRole('listitem');
    await expect(await emptyAnswers.count()).toEqual(0);

    await page.getByRole('main').getByRole('img').click();

    const oneAnswer = await page.getByRole('listitem');
    await expect(await oneAnswer.count()).toEqual(1);

    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  // Check that the thank you message is displayed
  await page.getByText('Please wait while your answers are uploaded.').click();
});
