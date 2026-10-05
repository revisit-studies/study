import { test, expect } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  readParticipantRecording,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('Test website component with reactive response', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Passing Data from reVISit to HTML and back');

  await expect(page.getByText(/example study.*embed html elements/i)).toBeVisible();

  // Click on the next button
  await nextClick(page);

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
  await nextClick(page);

  // Check the page contains the question
  const questionText2 = await page.getByText('Click on the smallest bar');
  await expect(questionText2).toBeVisible();

  // Check the page contains the visualization
  const vis2 = await page.frameLocator('#root iframe').getByRole('img');
  await expect(vis2).toBeVisible();

  // Select the smallest bar
  await page.frameLocator('#root iframe').locator('rect:nth-child(7)').click();

  // Check that the bar is selected and the response is filled
  const responseValue2 = await page.getByText('-0.3');
  await expect(responseValue2).toBeVisible();

  // Click on the next button
  await nextClick(page);

  // The final HTML trial submits the selection and advances without Next.
  await expect(page.getByText('Click a bar to automatically continue.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeHidden();
  await page.frameLocator('#root iframe').locator('.bar').nth(2).click();
  await waitForStudyEndMessage(page);
  await expect.poll(async () => (
    await readParticipantRecording(page, 'demo-html-input', 'bar-chart-auto-advance_3')
  )?.answer).toEqual({ barChart: 1.2 });
});
