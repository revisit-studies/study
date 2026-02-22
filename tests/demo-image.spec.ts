import { test, expect } from '@playwright/test';
import { nextClick, waitForStudyEndMessage } from './utils';

test('Test image component', async ({ page }) => {
  await page.goto('/');

  // Click on image-demo
  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'Simple Images as Stimuli: Decision-Making with Uncertainty Visualizations' })
    .getByText('Go to Study')
    .click();

  await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();

  // Click on the next button
  await nextClick(page);

  // Check the page contains the question
  const question1Text = await page.getByText('Will you issue blankets to the alpacas?');
  await expect(question1Text).toBeVisible();

  // Check the page contains the visualization
  const img1 = await page.getByRole('main').getByRole('img');
  await expect(img1).toBeVisible();

  // Select a response and click next
  await page.getByLabel('Yes').check();
  await nextClick(page);

  // Check the page contains the question
  const question2Text = await page.getByText('Will you issue blankets to the alpacas?');
  await expect(question2Text).toBeVisible();

  // Check the page contains the visualization
  const img2 = await page.getByRole('main').getByRole('img');
  await expect(img2).toBeVisible();

  // Select a response and click next
  await page.getByLabel('No').check();
  await page.keyboard.press('Enter');

  // Check the page contains the question
  const question3Text = await page.getByText('Will you issue blankets to the alpacas?');
  await expect(question3Text).toBeVisible();

  // Check the page contains the visualization
  const img3 = await page.getByRole('main').getByRole('img');
  await expect(img3).toBeVisible();

  // Select a response and click next
  await page.getByLabel('Yes').check();
  await nextClick(page);

  // Check the page contains the visualization
  const img4 = await page.getByRole('main').getByRole('img');
  await expect(img4).toBeVisible();

  // Select a response and click next
  await nextClick(page);

  // Check that the end of study text renders
  await waitForStudyEndMessage(page);
});
