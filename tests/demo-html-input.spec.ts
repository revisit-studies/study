import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');

  // Click on html-input
  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'Passing Data from reVISit to HTML and back' })
    .getByText('Go to Study')
    .click();

  // Check that the page contains the introduction text
  const introText = await page.getByText('Welcome to our study. This is an example study to show how to embed html element');
  await expect(introText).toBeVisible({ timeout: 5000 });

  // Click on the next button
  await page.getByRole('button', { name: 'Next', exact: true }).click();

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
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check the page contains the question
  const questionText2 = await page.getByText('Click on the smallest bar');
  await expect(questionText2).toBeVisible();

  // Check the page contains the visualization
  const vis2 = await page.frameLocator('#root iframe').getByRole('img');
  await expect(vis2).toBeVisible();

  // Select a bar
  await page.frameLocator('#root iframe').locator('rect:nth-child(4)').click();

  // Check that the bar is selected and the response is filled
  const responseValue2 = await page.getByText('1.3');
  await expect(responseValue2).toBeVisible();

  // Click on the next button
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check that the end of study text renders
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
