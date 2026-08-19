/* eslint-disable no-await-in-loop */
import { expect, test } from '@playwright/test';
import {
  nextClick,
  readParticipantRecording,
  readStoredValue,
  resetClientStudyState,
  seekReplay,
  waitForStudyEndMessage,
} from './utils';

test('Test vega component with reactive response', async ({ page }) => {
  await resetClientStudyState(page);
  await page.goto('/demo-vega');

  await expect(page.getByRole('heading', { name: 'Vega Stimuli Demo' })).toBeVisible();
  await expect(page.getByText(/demo study.*stimuli.*vega/i)).toBeVisible();

  await nextClick(page);

  await expect(page.getByText('Click on the bar with the highest value.')).toBeVisible();

  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  await expect(nextButton).toBeEnabled();

  const firstSelectedAnswer = page.locator('[class*="mantine-InputWrapper-root"]').filter({ hasText: 'You selected:' }).locator('li').first();
  const firstChart = page.locator('main .vega-embed:visible canvas.marks').first();
  await expect(firstChart).toBeVisible();

  // Get the dimensions of the first chart to calculate click positions
  const firstBox = await firstChart.boundingBox();
  expect(firstBox).not.toBeNull();
  const firstWidth = firstBox!.width;
  const firstHeight = firstBox!.height;

  // Vega renders on canvas, so try a grid of clicks until any answer is selected.
  const firstChartPositions = [];
  for (let x = 12; x <= Math.floor(firstWidth) - 12; x += 16) {
    for (let y = 12; y <= Math.floor(firstHeight) - 12; y += 16) {
      firstChartPositions.push({ x, y });
    }
  }
  for (let x = 20; x <= Math.floor(firstWidth) - 20; x += 16) {
    for (let y = 20; y <= Math.floor(firstHeight) - 20; y += 16) {
      firstChartPositions.push({ x, y });
    }
  }

  let firstSelection = '';
  for (const position of firstChartPositions) {
    await firstChart.click({ position, force: true });
    if (await firstSelectedAnswer.count()) {
      firstSelection = (await firstSelectedAnswer.innerText()).trim();
      if (firstSelection.length > 0) {
        break;
      }
    }
  }

  expect(firstSelection.length).toBeGreaterThan(0);
  await expect(firstSelectedAnswer).toBeVisible();

  const firstConfidenceSlider = page.getByRole('slider').first();
  await firstConfidenceSlider.focus();
  await firstConfidenceSlider.press('ArrowRight');

  await expect(nextButton).toBeEnabled();
  await nextClick(page);

  await expect(page.getByText('Select the movie with the highest Worldwide Gross.')).toBeVisible();
  const replayPath = new URL(page.url()).pathname;

  const fieldSelects = page.locator('main select');
  await expect(fieldSelects.nth(0)).toBeVisible();
  await page.waitForTimeout(150);
  await fieldSelects.nth(0).selectOption({ label: 'US Gross' });
  await page.waitForTimeout(150);
  await fieldSelects.nth(1).selectOption({ label: 'Worldwide Gross' });
  await page.waitForTimeout(150);

  // Get the dimensions of the second chart to calculate click positions
  const secondChart = page.locator('main .vega-embed:visible canvas.marks').first();
  await expect(secondChart).toBeVisible();
  const secondBox = await secondChart.boundingBox();
  expect(secondBox).not.toBeNull();
  const secondWidth = secondBox!.width;
  const secondHeight = secondBox!.height;

  // Vega renders on canvas, so try a grid of clicks until any answer is selected.
  const pointPositions = [];
  for (let x = 15; x <= Math.floor(secondWidth) - 15; x += 18) {
    for (let y = 15; y <= Math.floor(secondHeight) - 15; y += 18) {
      pointPositions.push({ x, y });
    }
  }
  for (let x = 24; x <= Math.floor(secondWidth) - 24; x += 18) {
    for (let y = 24; y <= Math.floor(secondHeight) - 24; y += 18) {
      pointPositions.push({ x, y });
    }
  }

  const secondSelectedAnswer = page.locator('[class*="mantine-InputWrapper-root"]').filter({ hasText: 'You selected:' }).locator('li').first();
  let secondSelection = '';

  for (const position of pointPositions) {
    await secondChart.click({ position, force: true });
    if (await secondSelectedAnswer.count()) {
      secondSelection = (await secondSelectedAnswer.innerText()).trim();
      if (secondSelection.length > 0) {
        break;
      }
    }
  }

  expect(secondSelection.length).toBeGreaterThan(0);

  const secondConfidenceSlider = page.getByRole('slider').first();
  await secondConfidenceSlider.focus();
  await secondConfidenceSlider.press('ArrowRight');

  await expect(nextButton).toBeEnabled();
  await nextClick(page);

  await waitForStudyEndMessage(page);

  await expect.poll(async () => (
    await readParticipantRecording(page, 'demo-vega', 'vegademo2_2')
  )?.participantId ?? '', { timeout: 15000 }).not.toBe('');
  const recording = await readParticipantRecording(page, 'demo-vega', 'vegademo2_2');
  if (!recording) {
    throw new Error('No recorded Vega replay found');
  }

  const provenanceKey = `dev-demo-vega/provenance/${recording.participantId}_vegademo2_2`;
  await expect.poll(
    async () => await readStoredValue(page, provenanceKey),
    { timeout: 15000 },
  ).not.toBeNull();
  const provenanceBeforeReplay = await readStoredValue(page, provenanceKey);
  await page.goto(`${replayPath}?participantId=${recording.participantId}&revisitPageId=e2e-vega-replay`);

  const replaySelects = page.locator('main select');
  await expect(replaySelects).toHaveCount(2);
  await seekReplay(page, recording.startTime, recording.endTime, recording.endTime);
  await expect(replaySelects.nth(0)).toHaveValue('US Gross');
  await expect(replaySelects.nth(1)).toHaveValue('Worldwide Gross');
  expect(await replaySelects.nth(0).evaluate((element) => element.closest('[inert]') !== null)).toBe(true);

  await seekReplay(page, recording.startTime, recording.endTime, recording.startTime);
  await expect(replaySelects.nth(0)).toHaveValue('IMDB Rating');
  await expect(replaySelects.nth(1)).toHaveValue('Rotten Tomatoes Rating');

  await seekReplay(page, recording.startTime, recording.endTime, recording.endTime);
  await expect(replaySelects.nth(0)).toHaveValue('US Gross');
  await expect(replaySelects.nth(1)).toHaveValue('Worldwide Gross');
  expect(await readStoredValue(page, provenanceKey)).toEqual(provenanceBeforeReplay);
});
