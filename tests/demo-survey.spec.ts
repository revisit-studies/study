/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'Question Types and Form Elements Demo' })
    .getByText('Go to Study')
    .click();

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

  const radios = await page.locator('input[value="Highly Unsatisfied"]');
  for (let i = 0; i < await radios.count(); i += 1) {
    await radios.nth(i).click();
  }

  const checkboxes1 = await page.locator('input[value="Has Legs"]');
  const checkboxes2 = await page.locator('input[value="Has Wings"]');
  for (let i = 0; i < await checkboxes1.count(); i += 1) {
    await checkboxes1.nth(i).click();
  }
  for (let i = 0; i < 2; i += 1) {
    await checkboxes2.nth(i).click();
  }

  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check that the thank you message is displayed
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
