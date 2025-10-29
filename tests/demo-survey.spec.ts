/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'Form Elements Demo' })
    .getByText('Go to Study')
    .click();

  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Fill the survey: Form Elements

  // Number input
  await page.getByPlaceholder('Enter your age here, range from 0 - 100').fill('12');

  // Slider
  await page.locator('.mantine-Slider-track').click();

  // Short text
  await page.getByPlaceholder('Enter your answer here').fill('test');

  // Long text
  await page.getByPlaceholder('Enter your long comments here').fill('test long text');

  // Dropdown
  await page.getByPlaceholder('Enter your preference').click();
  await page.getByRole('option', { name: 'Bar', exact: true }).click();

  // Multiselect dropdown
  await page.getByPlaceholder('Enter your responses').click();
  await page.getByRole('option', { name: 'Line', exact: true }).click();
  const minDropdownSelectionsText = await page.getByText('Please select at least 2 options');
  await expect(minDropdownSelectionsText).toBeVisible();
  await page.getByRole('option', { name: 'Scatter', exact: true }).click();

  // Vertical Checkbox
  await page.getByRole('checkbox', { name: 'Option 2' }).nth(0).click();
  const minSelectionsText = await page.getByText('Please select at least 2 options');
  await expect(minSelectionsText).toBeVisible();
  await page.getByRole('checkbox', { name: 'Option 1' }).nth(0).click();
  await page.getByRole('checkbox', { name: 'Option 3' }).nth(0).click();
  const maxSelectionsText = await page.getByText('Please select at most 2 options');
  await expect(maxSelectionsText).toBeVisible();
  await page.getByRole('checkbox', { name: 'Option 1' }).nth(0).click();

  // Horizontal Checkbox
  await page.getByRole('checkbox', { name: 'Option 2' }).nth(1).click();
  await page.getByRole('checkbox', { name: 'Option 3' }).nth(1).click();

  // Vertical Radio
  await page.getByRole('radio', { name: 'Option 2' }).nth(0).click();

  // Horizontal Radio
  await page.getByRole('radio', { name: 'Option 2' }).nth(1).click();

  // Button
  await page.getByRole('radio', { name: 'Option 4' }).nth(0).click();

  // Likert scale
  await page.getByRole('radio', { name: '5' }).nth(0).click();

  // Matrix radio
  const radios1 = await page.locator('input[value="Highly Unsatisfied"]');
  for (let i = 0; i < await radios1.count(); i += 1) {
    await radios1.nth(i).click();
  }

  // Matrix checkbox
  const checkboxes1 = await page.locator('input[value="Has Legs"]');
  const checkboxes2 = await page.locator('input[value="Has Wings"]');
  for (let i = 0; i < await checkboxes1.count(); i += 1) {
    await checkboxes1.nth(i).click();
  }
  for (let i = 0; i < 2; i += 1) {
    await checkboxes2.nth(i).click();
  }

  // Go to the next page
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Fill the survey: Randomizing Options

  // Matrix radio
  const radios2 = await page.locator('input[value="Highly Unsatisfied"]');
  for (let i = 0; i < await radios2.count(); i += 1) {
    await radios2.nth(i).click();
  }

  // Matrix checkbox
  const checkboxes3 = await page.locator('input[value="Answer 1"]');
  for (let i = 0; i < await checkboxes3.count(); i += 1) {
    await checkboxes3.nth(i).click();
  }

  // Vertical Checkbox
  await page.getByRole('checkbox', { name: 'Option 2' }).nth(0).click();
  await page.getByRole('checkbox', { name: 'Option 3' }).nth(0).click();

  // Horizontal Checkbox
  await page.getByRole('checkbox', { name: 'Option 2' }).nth(1).click();
  await page.getByRole('checkbox', { name: 'Option 3' }).nth(1).click();

  // Vertical Radio
  await page.getByRole('radio', { name: 'Option 4' }).nth(0).click();

  // Horizontal Radio
  await page.getByRole('radio', { name: 'Option 4' }).nth(1).click();

  // Button
  await page.getByRole('radio', { name: 'Option 4' }).nth(2).click();

  // Go to the next page
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Fill the survey: Randomizing Questions

  // Dropdown
  await page.getByPlaceholder('Select an option').click();
  await page.getByRole('option', { name: 'Option 1', exact: true }).click();

  // Likert
  await page.getByRole('radio', { name: '5' }).nth(0).click();

  // Short text
  await page.getByPlaceholder('Enter your answer here').fill('test');

  // Radio
  await page.getByRole('radio', { name: 'Option 2' }).nth(0).click();

  // Slider
  await page.locator('.mantine-Slider-track').click();

  // Go to the next page
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Ranking Widgets
  // Go to the next page
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Fill the survey: Sidebar Form Elements

  // Number input
  await page.getByPlaceholder('Enter your age here, range from 0 - 100').fill('12');

  // Slider
  await page.locator('.mantine-Slider-track').click();

  // Short text
  await page.getByPlaceholder('Enter your answer here').fill('test');

  // Long text
  await page.getByPlaceholder('Enter your long comments here').fill('test long text');

  // Dropdown
  await page.getByPlaceholder('Enter your preference').click();
  await page.getByRole('option', { name: 'Bar', exact: true }).click();

  // Multiselect dropdown
  await page.getByPlaceholder('Enter your responses').click();
  await page.getByRole('option', { name: 'Line', exact: true }).click();
  await page.getByRole('option', { name: 'Scatter', exact: true }).click();

  // Vertical Checkbox
  await page.getByRole('checkbox', { name: 'Option 2' }).nth(0).click();
  await page.getByRole('checkbox', { name: 'Option 1' }).nth(0).click();

  // Vertical Radio
  await page.getByRole('radio', { name: 'Option 2' }).nth(0).click();

  // Button
  await page.getByRole('radio', { name: 'Option 1' }).nth(1).click();

  // Likert scale
  await page.getByRole('radio', { name: '6' }).nth(0).click();

  // Go to the next page
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check that the thank you message is displayed
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
