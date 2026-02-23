/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

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
