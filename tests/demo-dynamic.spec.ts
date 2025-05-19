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
  await expect(introText).toBeVisible({ });
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check for dynamic blocks
  const dynamicBlocks = await page.getByRole('heading', { name: 'Dynamic Blocks' });
  await expect(dynamicBlocks).toBeVisible({ timeout: 500 });

  let expectedLeft = 30;
  let expectedRight = 70;

  const previousAnswers: {
    answer: { buttonResponse: string };
    parameters: { left: number; right: number };
  }[] = [];

  for (let i = 0; i < trialLen; i += 1) {
    await page.waitForSelector('text=Left square saturation:', { timeout: 3000 });
    await page.waitForSelector('text=Right square saturation:', { timeout: 3000 });

    // Extract and parse current saturation values
    const leftText = await page.locator('text=Left square saturation:').last().textContent() || '';
    const rightText = await page.locator('text=Right square saturation:').last().textContent() || '';

    const leftValue = parseInt(leftText.match(/\d+/)![0], 10);
    const rightValue = parseInt(rightText.match(/\d+/)![0], 10);

    await expect(leftValue).toBe(expectedLeft);
    await expect(rightValue).toBe(expectedRight);

    const choice = (leftValue === rightValue) ? 'Same' : (leftValue > rightValue ? 'Left' : 'Right');

    await page.getByRole('radio', { name: choice }).click();
    await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Store the current answer
    previousAnswers.push({
      answer: { buttonResponse: choice },
      parameters: { left: leftValue, right: rightValue },
    });

    expectedLeft = previousAnswers.reduce((leftVal, answer) => {
      const isCorrect = (answer.answer.buttonResponse === 'Left' && answer.parameters.left > answer.parameters.right)
                        || (answer.answer.buttonResponse === 'Right' && answer.parameters.right > answer.parameters.left)
                        || (answer.answer.buttonResponse === 'Same' && answer.parameters.left === answer.parameters.right);
      return isCorrect ? Math.min(100, leftVal + 10) : Math.max(0, leftVal - 10);
    }, 30);

    expectedRight = previousAnswers.reduce((rightVal, answer) => {
      const isCorrect = (answer.answer.buttonResponse === 'Right' && answer.parameters.right > answer.parameters.left)
                        || (answer.answer.buttonResponse === 'Left' && answer.parameters.left > answer.parameters.right)
                        || (answer.answer.buttonResponse === 'Same' && answer.parameters.left === answer.parameters.right);
      return isCorrect ? Math.max(0, rightVal - 10) : Math.min(100, rightVal + 10);
    }, 70);

    // If Same was correct, exit dynamic block
    if (choice === 'Same' && leftValue === rightValue) {
      break;
    }

    await page.waitForTimeout(1000);
  }
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
