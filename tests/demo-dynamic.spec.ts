/* eslint-disable no-plusplus, no-await-in-loop */
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

  for (let i = 0; i < trialLen; i++) {
    const questionText = await page.getByText('Choose the square with a high saturation');
    await expect(questionText).toBeVisible();

    await page.getByRole('radio', { name: 'Right' }).click();
    await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }

  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
