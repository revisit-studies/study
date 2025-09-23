import { expect, test } from '@playwright/test';

test('html demo works as intended with previous button', async ({ browser }) => {
  const page = await browser.newPage();
  await page.setViewportSize({
    width: 1200,
    height: 800,
  });

  await page.goto('/');

  // Click on html-demo
  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'HTML as a Stimulus' })
    .nth(0)
    .getByText('Go to Study')
    .click();

  // Check that the page contains the introduction text
  const introText = await page.getByText('Welcome to our study. This is an example study to show how to embed html element');
  await expect(introText).toBeVisible({ timeout: 5000 });

  // Click on the next button
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check the page contains the question
  const questionText = await page.getByText('How many bars have a value greater than 1?');
  await expect(questionText).toBeVisible();

  // Check the page contains the visualization
  const vis = await page.frameLocator('#root iframe').getByRole('img');
  await expect(vis).toBeVisible();

  // Fill the response
  const input = await page.locator('input[data-path="html-response"]');
  await expect(input).toBeVisible();
  await input.fill('2');
  await expect(input).toHaveValue('2');

  // Click on the next button
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  const iframeContent = await page.frameLocator('iframe').getByRole('link', { name: 'Try The Demo' });
  await expect(iframeContent).toBeVisible();

  // Go to previous page
  await page.getByRole('button', { name: 'Previous', exact: true }).click();

  // Check answer is correctly saved
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('2');

  // Update answer to 4
  await input.fill('4');
  await expect(input).toHaveValue('4');

  // Click on the next button
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(iframeContent).toBeVisible();

  // Go to previous page
  await page.getByRole('button', { name: 'Previous', exact: true }).click();

  // Check answer is correctly saved
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('4');

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(iframeContent).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check that the end of study text renders
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
