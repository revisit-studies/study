/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/example-VLAT-full-randomized?PROLIFIC_ID=test');

  await page.getByRole('heading', { name: 'What is VLAT?' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.getByPlaceholder('Your Initials').fill('test');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  const questionArray = new Array(53).fill(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const idx of questionArray) {
    const questionText = await page.getByText('Task:');
    await expect(questionText).toBeVisible();
    const img = await page.getByRole('main').getByRole('img');
    await expect(img).toBeVisible();
    await page.locator('input[type="radio"]').nth(0).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }

  await page.getByPlaceholder('Enter your answer here.').click();
  await page.getByPlaceholder('Enter your answer here.').fill('no');
  await page.getByLabel('Did anything not render or display properly?*').fill('no');
  await page.getByLabel('Any other issues or anything you would like to tell us?*').fill('no');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.getByText('Please wait while your answers are uploaded.').click();
});
