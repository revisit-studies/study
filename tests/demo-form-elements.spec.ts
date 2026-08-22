/* eslint-disable no-await-in-loop */
import { test, expect, Page } from '@playwright/test';
import {
  nextClick,
  readStoredComponentTiming,
  seekReplay,
  waitForStudyEndMessage,
} from './utils';

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

async function fillTimePicker(page: Page, prompt: string, value: string) {
  const [hours, minutes, seconds] = value.split(':');
  await page.getByLabel(`${prompt} hours`).fill(hours);
  await page.getByLabel(`${prompt} minutes`).fill(minutes);
  if (seconds !== undefined) {
    await page.getByLabel(`${prompt} seconds`).fill(seconds);
  }
}

async function expectTimePickerValue(page: Page, prompt: string, value: string) {
  const [hours, minutes, seconds] = value.split(':');
  await expect(page.getByLabel(`${prompt} hours`)).toHaveValue(hours);
  await expect(page.getByLabel(`${prompt} minutes`)).toHaveValue(minutes);
  if (seconds !== undefined) {
    await expect(page.getByLabel(`${prompt} seconds`)).toHaveValue(seconds);
  }
}

async function advanceToSidebarFormElements(page: Page) {
  const sidebarAgeInput = page.locator('input[placeholder="Enter your age here, range from 0 to 100"]:visible').first();

  for (let i = 0; i < 3; i += 1) {
    if (await sidebarAgeInput.isVisible().catch(() => false)) {
      return sidebarAgeInput;
    }

    const nextButton = page.getByRole('button', { name: 'Next', exact: true });
    const canAdvance = await nextButton.isVisible().catch(() => false)
      && await nextButton.isEnabled().catch(() => false);
    if (canAdvance) {
      await nextClick(page).catch(() => { });
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

  const shortSidebarReplayPath = new URL(page.url()).pathname;
  await nextClick(page);

  // Fill the survey: Form Elements

  // Number input
  const ageInput = page.getByPlaceholder('Enter your age here, range from 0 to 100');
  await expect(ageInput).toBeVisible({ timeout: 10000 });
  await ageInput.fill('120');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
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

  // Country dropdown
  const countryDropdown = page.getByPlaceholder('Select a country');
  await countryDropdown.fill('United Sta');
  await page.getByRole('option', { name: /United States$/ }).click();
  await expect(countryDropdown).toHaveValue(/United States/);

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

  // Fill the survey: Text Validation
  await expect(page.getByText('Text Validation', { exact: true })).toBeVisible();
  const textValidationReplayPath = new URL(page.url()).pathname;
  const regexInput = page.getByPlaceholder('ABC-123');
  await regexInput.fill('^[A-Z]{3}-\\d{3}$');
  await nextClick(page);
  await expect(
    page.getByText('Please enter a value that matches the required format.'),
  ).toBeVisible();
  await regexInput.fill('ABC-123');
  await page.getByPlaceholder('ABC-123').fill('ABC-123');
  await page.getByPlaceholder('I use ReVISit for...').fill('I use ReVISit');
  await page.getByPlaceholder('Describe a valid response...').fill('This response works');
  await page.getByPlaceholder('ReVISit', { exact: true }).fill('ReVISit');
  await page.getByPlaceholder('Anything except TEST').fill('ReVISit');
  await page.getByPlaceholder('3–10 characters').fill('valid');
  await page.getByPlaceholder('20–100 characters').fill('This response has enough characters.');
  await page.getByPlaceholder('2–5 words').fill('two words');
  await page.getByPlaceholder('4–10 words').fill('This has four words');
  await page.getByPlaceholder('test@revisit.dev').fill('test@revisit.dev');
  await page.getByPlaceholder('+800-0000-0000').fill('+800-0000-0000');
  await page.getByPlaceholder('800-000-0000').fill('800-000-0000');
  await page.getByPlaceholder('https://revisit.dev').fill('https://revisit.dev');
  await page.getByLabel('Date with a custom placeholder.').fill('06/24/2026');
  await page.getByLabel('Date with a minimum.').fill('06/24/2026');
  await page.getByLabel('Date with a maximum.').fill('06/24/2026');
  await page.getByLabel('Date within a range.').fill('06/24/2026');
  await page.getByLabel('Date with a required value.').fill('06/24/2026');
  await expect(page.getByLabel('Month picker.')).toContainText('06/2026');
  await expect(page.getByLabel('Year picker.')).toContainText('2026');
  await fillTimePicker(page, 'Time without seconds.', '14:28');
  await fillTimePicker(page, 'Time with a minimum.', '14:28');
  await fillTimePicker(page, 'Time with a maximum.', '14:28');
  await fillTimePicker(page, 'Time within a range.', '14:28');
  await fillTimePicker(page, 'Time with seconds.', '14:28:30');
  await fillTimePicker(page, 'Time with seconds within a range.', '14:28:30');
  await fillTimePicker(page, 'Time with a required value.', '14:28');
  await expect(page.getByLabel('Time in 12-hour format. hours')).toHaveValue('02');
  await expect(page.getByLabel('Time in 12-hour format. minutes')).toHaveValue('28');
  await expect(page.getByLabel('Time in 12-hour format. am/pm')).toHaveValue('PM');
  await nextClick(page);

  // Default Values should be fully answerable via defaults
  await expect(page.getByText('Default Values Demo')).toBeVisible();
  await expect(page.getByLabel('Date default')).toHaveValue('06/24/2026');
  await expect(page.getByLabel('Month default')).toContainText('06/2026');
  await expect(page.getByLabel('Year default')).toContainText('2026');
  await expectTimePickerValue(page, 'Time default', '14:28:30');
  await expect(page.getByPlaceholder('Select a country')).toHaveValue(/United States/);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await nextClick(page);

  // Custom Response page
  await expect(page.getByText('Custom Response')).toBeVisible();
  const customResponseNextButton = page.getByRole('button', { name: 'Next', exact: true });
  await expect(customResponseNextButton).toBeEnabled();
  await page.getByRole('button', { name: 'Bar', exact: true }).click();
  await customResponseNextButton.click();
  await expect(page.getByText('Set confidence to at least 70 to continue.')).toBeVisible();
  await page.getByLabel('Confidence').fill('80');
  await page.getByLabel('Rationale').fill('Useful for comparing categories');
  await expect(page.getByText('"chartType":"Bar"')).toBeVisible();
  await expect(customResponseNextButton).toBeEnabled();
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
  const sidebarReplayPath = new URL(page.url()).pathname;
  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toBeVisible();
  expect(await sidebar.evaluate((element) => getComputedStyle(element).overflowY)).not.toBe('auto');

  await sidebarAgeInput.fill('120');
  await sidebarAgeInput.press('Tab');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
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
  await page.getByRole('radio', { name: '5' }).nth(0).click();

  // Go to the next page
  await nextClick(page);

  // Check that the thank you message is displayed
  await waitForStudyEndMessage(page);

  await expect.poll(() => readStoredComponentTiming(page, 'Text Validation')).not.toBeNull();
  const textValidationTiming = await readStoredComponentTiming(page, 'Text Validation');
  await expect.poll(() => readStoredComponentTiming(page, 'Sidebar Form Elements')).not.toBeNull();
  const sidebarTiming = await readStoredComponentTiming(page, 'Sidebar Form Elements');
  if (!textValidationTiming || !sidebarTiming) {
    throw new Error('Form element timing was not stored');
  }

  const replaySearch = `participantId=${encodeURIComponent(sidebarTiming.participantId)}&revisitPageId=e2e-sidebar-replay`;
  await page.goto(`${textValidationReplayPath}?${replaySearch}`);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await seekReplay(
    page,
    textValidationTiming.startTime,
    textValidationTiming.endTime,
    textValidationTiming.endTime,
  );
  await expect(page.getByLabel('Date within a range.')).toHaveValue('06/24/2026');
  await expect(page.getByLabel('Month picker.')).toContainText('06/2026');
  await expect(page.getByLabel('Year picker.')).toContainText('2026');
  await expectTimePickerValue(page, 'Time with seconds within a range.', '14:28:30');

  await page.goto(`${sidebarReplayPath}?${replaySearch}`);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  const replaySidebar = page.locator('.sidebar');
  const replayFooter = page.locator('footer');
  await expect(replaySidebar).toBeVisible();
  expect(await replaySidebar.evaluate((element) => getComputedStyle(element).overflowY)).not.toBe('auto');
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await replaySidebar.evaluate((element) => element.scrollTop)).toBe(0);

  const replaySidebarBox = await replaySidebar.boundingBox();
  const replayFooterBox = await replayFooter.boundingBox();
  expect(replaySidebarBox).not.toBeNull();
  expect(replayFooterBox).not.toBeNull();
  expect((replaySidebarBox?.y ?? 0) + (replaySidebarBox?.height ?? 0))
    .toBeLessThanOrEqual((replayFooterBox?.y ?? 0) + 1);

  await page.goto(`${shortSidebarReplayPath}?${replaySearch}`);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  const shortSidebar = page.locator('.sidebar');
  await expect(shortSidebar).toBeVisible();
  const shortSidebarLayout = await shortSidebar.evaluate((element) => ({
    alignSelf: getComputedStyle(element).alignSelf,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(shortSidebarLayout.alignSelf).not.toBe('flex-start');
  expect(shortSidebarLayout.scrollHeight).toBeLessThanOrEqual(shortSidebarLayout.clientHeight);
});
