import { expect, test } from '@playwright/test';
import { checkSavedAnswers } from './checkSavedAnswers';
import { nextClick, waitForStudyEndMessage } from './utils';

test('Test website component with previous button', async ({ page }) => {
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

  await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();

  // Click on the next button
  await nextClick(page);

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
  await nextClick(page);

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
  await nextClick(page);
  await expect(iframeContent).toBeVisible();

  // Go to previous page
  await page.getByRole('button', { name: 'Previous', exact: true }).click();

  // Check answer is correctly saved
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('4');

  await nextClick(page);
  await expect(iframeContent).toBeVisible();

  await nextClick(page);

  // Check that the end of study text renders
  await waitForStudyEndMessage(page);

  const uploaded = await page.getByText('Thank you for completing the study. You may close this window now.');
  await expect(uploaded).toBeVisible();

  await checkSavedAnswers(page, 'demo-html');
});
