import { test, expect } from '@playwright/test';
import {
  advanceStudyStep as nextClick,
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('configured image keeps its width when the study sidebar is closed', async ({ page }) => {
  await resetClientStudyState(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/demo-image/config.json', async (route) => {
    const result = await route.fetch();
    const config = await result.json();
    config.uiConfig.withSidebar = false;
    await route.fulfill({ response: result, json: config });
  });
  await page.goto('/demo-image');
  await nextClick(page);

  const image = page.getByRole('main').getByRole('img');
  await expect(image).toBeVisible();
  expect((await image.boundingBox())?.width).toBeCloseTo(800, 0);
});

test('Test image component', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', [
    'Images as Stimuli: Decision-Making with Uncertainty Visualizations',
    'Simple Images as Stimuli: Decision-Making with Uncertainty Visualizations',
  ]);

  await expect(page.getByTestId('study-interface')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 });
  await expect(page.getByText(/use images as stimuli/i)).toBeVisible();

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
  await page.getByRole('radio', { name: 'No', exact: true }).check();
  await nextClick(page, () => page.keyboard.press('Enter'));

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
