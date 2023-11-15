import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Question Types and Form Elements Demo' }).click();

  // Check for introduction page
  const introText = await page.getByText('Welcome to our study. This is an example survey study. It asks basic questions o');
  await expect(introText).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // Fill the survey
  await page.getByPlaceholder('Enter your preference').click();
  await page.getByRole('option', { name: 'Bar', exact: true }).click();
  await page.getByPlaceholder('Enter your age here, range from 0 - 100').fill('12');
  await page.getByLabel('7').check();
  await page.getByPlaceholder('Enter your answer here').fill('ads');
  await page.getByPlaceholder('Enter your long comments here').fill('asdf');
  await page.getByText('0BadMidGood').click();
  await page.getByRole('checkbox', { name: 'Option 2' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Check that the thank you message is displayed
  const endText = await page.getByText('Thank you for completing the study. You may close this window now.');
  await expect(endText).toBeVisible();
});
