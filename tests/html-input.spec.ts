import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');

  // Click on html-input
  await page.getByRole('button', { name: 'Passing Data into reVISit from HTML' }).click();

  // Check that the page contains the introduction text
  const introText = await page.getByText('Welcome to our study. This is an example study to show how to embed html element');
  await expect(introText).toBeVisible();

  // Click on the next button
  await page.getByRole('button', { name: 'Next' }).click();

  // Check the page contains the question
  const questionText = await page.getByText('Click on the largest bar');
  await expect(questionText).toBeVisible();

  // Check the page contains the visualization
  const vis = await page.frameLocator('#root iframe').getByRole('img');
  await expect(vis).toBeVisible();

  // Select a bar
  await page.frameLocator('#root iframe').locator('rect:nth-child(4)').click();

  // Check that the bar is selected and the response is filled
  const responseValue = await page.getByText('1.3');
  await expect(responseValue).toBeVisible();

  // Click on the next button
  await page.getByRole('button', { name: 'Next' }).click();

  // Check that the end of study text renders
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
