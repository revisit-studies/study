import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dynamic React Stimuli and Provenance Tracking' }).click();

  // Check for introduction page
  const introText = await page.getByRole('heading', { name: 'Introduction' });
  await expect(introText).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // Check click accuracy test
  const questionText = await page.getByText('Task:');
  await expect(questionText).toBeVisible();

  const emptyAnswers = await page.getByRole('listitem');
  await expect(await emptyAnswers.count()).toEqual(0);

  await page.getByRole('main').getByRole('img').click();

  const oneAnswer = await page.getByRole('listitem');
  await expect(await oneAnswer.count()).toEqual(1);

  await page.getByRole('button', { name: 'Next' }).click();

  // Check that the thank you message is displayed
  await page.getByText('Please wait while your answers are uploaded.').click();
});
