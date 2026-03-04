/* eslint-disable no-await-in-loop */
import { test, expect, Page } from '@playwright/test';
import { nextClick, waitForStudyEndMessage } from './utils';

async function answerMatrixRadioRows(page: Page, responseId: string, rowCount: number) {
  for (let row = 0; row < rowCount; row += 1) {
    const rowRadios = page.locator(`input[type="radio"][name="radioInput${responseId}-${row}"]`);
    await expect(rowRadios.first()).toBeVisible();
    await rowRadios.first().click();
  }
}

async function answerMatrixCheckboxRows(
  page: Page,
  responseId: string,
  rowCount: number,
  columnCount: number,
  selectedColumns: number[] = [0],
) {
  const checkboxes = page.locator(`#${responseId} input[type="checkbox"]`);
  await expect(checkboxes).toHaveCount(rowCount * columnCount);

  for (let row = 0; row < rowCount; row += 1) {
    for (let i = 0; i < selectedColumns.length; i += 1) {
      const column = selectedColumns[i];
      await checkboxes.nth((row * columnCount) + column).click();
    }
  }
}

async function advanceToSidebarFormElements(page: Page) {
  const sidebarAgeInput = page.locator('input[placeholder="Enter your age here, range from 0 - 100"]:visible').first();

  for (let i = 0; i < 3; i += 1) {
    if (await sidebarAgeInput.isVisible().catch(() => false)) {
      return sidebarAgeInput;
    }

    const nextButton = page.getByRole('button', { name: 'Next', exact: true });
    const canAdvance = await nextButton.isVisible().catch(() => false)
      && await nextButton.isEnabled().catch(() => false);
    if (canAdvance) {
      await nextClick(page).catch(() => {});
      await page.waitForTimeout(150);
    }
  }

  await expect(sidebarAgeInput).toBeVisible({ timeout: 20000 });
  return sidebarAgeInput;
}

test('Test questionnaire component with responses and randomizing questions and responses', async ({ page }) => {
  await page.setViewportSize({
    width: 1400,
    height: 900,
  });

  await page.goto('/');
  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'Form Elements Demo' })
    .getByText('Go to Study')
    .click();

  await nextClick(page);

  // Fill the survey: Form Elements

  // Number input
  const ageInput = page.getByPlaceholder('Enter your age here, range from 0 - 100');
  await expect(ageInput).toBeVisible({ timeout: 10000 });
  await ageInput.fill('120');
  await expect(page.getByText('Please enter a value between 0 and 100')).toBeVisible();
  await ageInput.fill('12');

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
  await answerMatrixRadioRows(page, 'q-multi-satisfaction', 3);

  // Matrix checkbox
  await answerMatrixCheckboxRows(page, 'multi-custom', 5, 3);

  // Go to the next page
  await nextClick(page);

  // Default Values should be fully answerable via defaults
  await expect(page.getByText('Default Values Demo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await nextClick(page);

  // Fill the survey: Randomizing Options

  // Matrix radio
  await answerMatrixRadioRows(page, 'q-multi-satisfaction', 3);

  // Matrix checkbox
  await answerMatrixCheckboxRows(page, 'multi-custom', 3, 3);

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
  await nextClick(page);

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
  await nextClick(page);

  // Ranking Widgets
  // Go to the next page
  await nextClick(page);

  // Fill the survey: Sidebar Form Elements

  // Number input
  const sidebarAgeInput = await advanceToSidebarFormElements(page);
  await sidebarAgeInput.fill('120');
  await sidebarAgeInput.press('Tab');
  await expect(page.getByText('Please enter a value between 0 and 100')).toBeVisible();
  await sidebarAgeInput.fill('12');

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
  await nextClick(page);

  // Check that the thank you message is displayed
  await waitForStudyEndMessage(page);
});
