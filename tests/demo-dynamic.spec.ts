/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import {
  advanceStudyStep,
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('Previous follows the assigned sequence after between-subject filtering', async ({ page }) => {
  await page.route('**/demo-dynamic/config.json', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.factors = { arm: ['A', 'B'] };
    config.betweenSubjects = ['arm'];
    config.uiConfig.numSequences = 2;
    config.baseComponents = {
      assignedTrial: {
        type: 'questionnaire', instruction: 'Assigned trial {{arm}}', instructionLocation: 'aboveStimulus', response: [],
      },
    };
    config.components.HSLColorCodes.previousButton = true;
    config.components.final = {
      type: 'questionnaire', instruction: 'After the dynamic block', instructionLocation: 'aboveStimulus', response: [], previousButton: true,
    };
    config.sequence.components.splice(1, 0, {
      type: 'factor', id: 'assigned', factor: 'arm', components: 'assignedTrial',
    });
    config.sequence.components.push('final');
    await route.fulfill({ response, json: config });
  });
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Dynamic Blocks');
  await nextClick(page);
  await expect(page.getByText(/^Assigned trial [AB]$/)).toBeVisible();
  await nextClick(page);

  const dynamicUrls: string[] = [];
  for (const choice of ['Right', 'Right', 'Same']) {
    await expect(page.getByRole('heading', { name: 'Dynamic Blocks' })).toBeVisible();
    dynamicUrls.push(page.url());
    await page.getByRole('radio', { name: choice, exact: true }).click();
    await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await advanceStudyStep(page);
  }

  await expect(page.getByText('After the dynamic block', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page).toHaveURL(dynamicUrls[2]);
  await expect(page.getByText('Left square saturation: 50%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page).toHaveURL(dynamicUrls[1]);
  await expect(page.getByText('Left square saturation: 40%', { exact: true })).toBeVisible();
});

test('Test dynamic block', async ({ page }) => {
  const trialLen = 10;
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Dynamic Blocks');

  // Check for introduction page
  const introText = page.getByText(/sample study.*dynamic blocks/i);
  await expect(introText).toBeVisible({});
  await nextClick(page);

  // Check for dynamic blocks
  const dynamicBlocks = await page.getByRole('heading', { name: 'Dynamic Blocks' });
  await expect(dynamicBlocks).toBeVisible({ timeout: 15000 });

  let previousPair: { left: number; right: number } | null = null;

  for (let i = 0; i < trialLen; i += 1) {
    await page.waitForSelector('text=Left square saturation:', { timeout: 3000 });
    await page.waitForSelector('text=Right square saturation:', { timeout: 3000 });

    // Extract and parse current saturation values
    const leftText = await page.locator('text=Left square saturation:').last().textContent() || '';
    const rightText = await page.locator('text=Right square saturation:').last().textContent() || '';

    const leftValue = parseInt(leftText.match(/\d+/)![0], 10);
    const rightValue = parseInt(rightText.match(/\d+/)![0], 10);

    await expect(leftValue).toBeGreaterThanOrEqual(0);
    await expect(leftValue).toBeLessThanOrEqual(100);
    await expect(rightValue).toBeGreaterThanOrEqual(0);
    await expect(rightValue).toBeLessThanOrEqual(100);

    if (previousPair) {
      const leftDelta = Math.abs(leftValue - previousPair.left);
      const rightDelta = Math.abs(rightValue - previousPair.right);
      const hasValidStep = (leftDelta === 10 && rightDelta === 10)
        || (leftValue === rightValue);
      await expect(hasValidStep).toBe(true);
    }

    const choice = (leftValue === rightValue) ? 'Same' : (leftValue > rightValue ? 'Left' : 'Right');

    await page.getByRole('radio', { name: choice }).click();
    await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await nextClick(page);

    previousPair = { left: leftValue, right: rightValue };

    // If Same was correct, exit dynamic block
    if (choice === 'Same' && leftValue === rightValue) {
      break;
    }
  }
  await waitForStudyEndMessage(page);
});

test('nextOnEnter shows feedback once in the correct response location', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Dynamic Blocks');

  const introText = page.getByText(/sample study.*dynamic blocks/i);
  await expect(introText).toBeVisible({});
  await nextClick(page);

  const dynamicBlocks = await page.getByRole('heading', { name: 'Dynamic Blocks' });
  await expect(dynamicBlocks).toBeVisible({ timeout: 15000 });

  await page.waitForSelector('text=Left square saturation:', { timeout: 3000 });
  const leftText = await page.locator('text=Left square saturation:').last().textContent() || '';
  const rightText = await page.locator('text=Right square saturation:').last().textContent() || '';
  const leftValue = parseInt(leftText.match(/\d+/)![0], 10);
  const rightValue = parseInt(rightText.match(/\d+/)![0], 10);
  const choice = (leftValue === rightValue) ? 'Same' : (leftValue > rightValue ? 'Left' : 'Right');

  await page.getByRole('radio', { name: choice }).click();
  const trialUrl = page.url();
  await page.keyboard.press('Enter');

  const feedback = page.getByText('You have answered the question correctly.');
  await expect(feedback).toHaveCount(1);
  await expect(page.locator('.responseBlock-belowStimulus').getByText('You have answered the question correctly.')).toHaveCount(1);
  expect(page.url()).toBe(trialUrl);
  await expect(page.getByRole('button', { name: 'Check Answer', exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.url()).not.toBe(trialUrl);
});
