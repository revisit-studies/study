/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  const trialLen = 10;
  await page.goto('/');

  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'Dynamic Blocks' })
    .getByText('Go to Study')
    .click();

  // Check for introduction page
  const introText = await page.getByRole('heading', { name: 'Introduction' });
  await expect(introText).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check for dynamic blocks
  const dynamicBlocks = await page.getByRole('heading', { name: 'Dynamic Blocks' });
  await expect(dynamicBlocks).toBeVisible({ timeout: 5000 });

  let expectedLeft = 0;
  let expectedRight = 100;

  // Run 10 trials
  // The first 5 trials are correct, the next 5 are incorrect
  for (let i = 0; i < trialLen; i += 1) {
    const isCorrect = i < 5;

    // Extract and parse current saturation values
    const leftText = await page.locator('text=Left square saturation:').last().textContent() || '';
    const rightText = await page.locator('text=Right square saturation:').last().textContent() || '';

    const leftValue = parseInt(leftText.match(/\d+/)![0], 10);
    const rightValue = parseInt(rightText.match(/\d+/)![0], 10);

    await expect(leftValue).toBe(expectedLeft);
    await expect(rightValue).toBe(expectedRight);

    const choice = isCorrect ? 'Right' : 'Left';
    await page.getByRole('radio', { name: choice }).click();
    await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // If the answer was correct, increase the left saturation by 5 (max 50) and decrease the right saturation by 5 (min 50)
    // If the answer was incorrect, decrease the left saturation by 5 (min 0) and increase the right saturation by 5 (max 100)
    if (isCorrect) {
      expectedLeft = Math.min(50, expectedLeft + 5);
      expectedRight = Math.max(50, expectedRight - 5);
    } else {
      expectedLeft = Math.max(0, expectedLeft - 5);
      expectedRight = Math.min(100, expectedRight + 5);
    }

    await page.waitForTimeout(50);
  }
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
