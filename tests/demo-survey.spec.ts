import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Question Types and Form Elements Demo' }).click();

  // Check for introduction page
  const introText = await page.getByText('Welcome to our study. This is an example survey study. It asks basic questions o');
  await expect(introText).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Fill the survey
  await page.getByPlaceholder('Enter your preference').click();
  await page.getByRole('option', { name: 'Bar', exact: true }).click();
  await page.getByPlaceholder('Enter your age here, range from 0 - 100').fill('12');
  await page.getByLabel('7').check();
  await page.getByPlaceholder('Enter your answer here').fill('ads');
  await page.getByPlaceholder('Enter your long comments here').fill('asdf');
  await page.locator('.mantine-Slider-track').click();

  await page.getByRole('checkbox', { name: 'Option 2' }).click();
  const minSelectionsText = await page.getByText('Please select at least 2 options');
  await expect(minSelectionsText).toBeVisible();
  await page.getByRole('checkbox', { name: 'Option 1' }).click();
  await page.getByRole('checkbox', { name: 'Option 3' }).click();
  const maxSelectionsText = await page.getByText('Please select at most 2 options');
  await expect(maxSelectionsText).toBeVisible();
  await page.getByRole('checkbox', { name: 'Option 1' }).click();

  await page.getByRole('radio', { name: 'Option 2' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check that the thank you message is displayed
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
