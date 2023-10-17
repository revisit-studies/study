import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'VLAT (Visualization Literacy Assessment Test) A replication of the VLAT questionnaire, using image stimuli.' }).click();
  
  await page.getByRole('heading', { name: 'What is VLAT?' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  const questionArray = new Array(52).fill(null);
  for (const idx of questionArray) {
    const questionText = await page.getByText('Task:');
    await expect(questionText).toBeVisible();
    const img = await page.getByRole('main').getByRole('img');
    await expect(img).toBeVisible();
    await page.locator('input[type="radio"]').nth(0).click();
    await page.getByRole('button', { name: 'Next' }).click();
  }

  // Check that the thank you message is displayed
  await page.getByText('Thank you for completing the study. You may close this window now.').click();
});
