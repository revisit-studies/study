import { expect, test } from '@playwright/test';

test('html demo works as intended', async ({ page }) => {
  await page.goto('/');

  // Click on html-demo
  await page.getByRole('button', { name: 'HTML as a Stimulus' }).click();

  // Check that the page contains the introduction text
  const introText = await page.getByText('Welcome to our study. This is an example study to show how to embed html element');
  await expect(introText).toBeVisible();

  // Click on the next button
  await page.getByRole('button', { name: 'Next' }).click();

  // Check the page contains the question
  const questionText = await page.getByText('How many bars have a value greater than 1?');
  await expect(questionText).toBeVisible();

  // Check the page contains the visualization
  const vis = await page.frameLocator('#root iframe').getByRole('img');
  await expect(vis).toBeVisible();

  // Fill the response
  const input = await page.getByPlaceholder('0-7');
  await expect(input).toBeVisible();
  await input.fill('2');

  // Click on the next button
  await page.getByRole('button', { name: 'Next' }).click();

  // Check that the end of study text renders
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
