/* eslint-disable no-await-in-loop */
import { expect, test } from '@playwright/test';
import {
  moveRankingItem,
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
} from './utils';

test('the answer feedback demo grades responses and advances through each feedback type', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Answer Validation and Feedback Demo');
  await nextClick(page);

  // Exact answers and lists: show incorrect feedback, then correct the responses.
  const exactNumber = page.getByPlaceholder('Exact number');
  const country = page.getByPlaceholder('Country name');
  const numberList = page.getByPlaceholder('Number from a list');
  await exactNumber.fill('3');
  await country.fill('Canada');
  await numberList.fill('6');
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(3);
  await exactNumber.fill('4');
  await country.fill('US');
  await numberList.fill('1');
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(3);
  await nextClick(page);

  // Numeric ranges: incorrect values produce feedback before valid endpoints.
  const inclusiveRange = page.getByPlaceholder('Inclusive range');
  const lowerBound = page.getByPlaceholder('Lower bound only');
  const upperBound = page.getByPlaceholder('Upper bound only');
  await inclusiveRange.fill('11');
  await lowerBound.fill('-1');
  await upperBound.fill('1');
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(3);
  await inclusiveRange.fill('-10');
  await lowerBound.fill('0');
  await upperBound.fill('0');
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await nextClick(page);

  // Alternative selections: test feedback, then choose correct answers in each widget.
  await page.getByRole('checkbox', { name: 'A', exact: true }).check();
  await page.getByRole('checkbox', { name: 'C', exact: true }).check();
  await page.getByRole('checkbox', { name: '4', exact: true }).check();
  const matrixCheckboxes = page.locator('#checkbox-matrix input[type="checkbox"]');
  await expect(matrixCheckboxes).toHaveCount(20);
  for (let row = 0; row < 5; row += 1) {
    await matrixCheckboxes.nth(row * 4).check();
  }

  const colorInput = page.locator('#dropdown-set input:not([type="hidden"])');
  const yellow = page.getByRole('option', { name: 'Yellow' });
  await colorInput.focus();
  await page.keyboard.press('ArrowDown');
  await expect(yellow).toBeVisible();
  await page.getByRole('option', { name: 'Red' }).click();
  await page.getByRole('option', { name: 'Green' }).click();
  await page.keyboard.press('Escape');
  await expect(yellow).toBeHidden();
  await moveRankingItem(page, 'A', 'available', 'selected');
  await moveRankingItem(page, 'C', 'available', 'selected');
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(5);

  await page.getByRole('checkbox', { name: 'A', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'D', exact: true }).check();
  for (const option of ['-4', '|4|', '16/4']) {
    await page.getByRole('checkbox', { name: option, exact: true }).check();
  }
  await page.locator('#checkbox-matrix').getByRole('button', { name: 'Clear selection' }).click();
  const acceptedTraits = [[1, 2], [1, 2], [1, 2], [1, 2, 3], [0, 2]];
  for (let row = 0; row < acceptedTraits.length; row += 1) {
    for (const column of acceptedTraits[row]) {
      await matrixCheckboxes.nth((row * 4) + column).check();
    }
  }

  await colorInput.focus();
  await page.keyboard.press('ArrowDown');
  await expect(yellow).toBeVisible();
  await page.getByRole('option', { name: 'Red' }).click();
  await yellow.click();
  await page.keyboard.press('Escape');
  await expect(yellow).toBeHidden();
  await moveRankingItem(page, 'C', 'selected', 'available');
  await moveRankingItem(page, 'B', 'available', 'selected');
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(5);
  await nextClick(page);

  // This component hides Check Answer, so Next submits each attempt and displays its hint.
  const hintedNumber = page.getByPlaceholder('Number between 150 and 160');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await expect(page.getByRole('button', { name: 'Check Answer', exact: true })).toHaveCount(0);
  await hintedNumber.fill('140');
  await next.click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('That is outside the range. You have unlimited attempts left.');
  for (let attempt = 0; attempt < 11; attempt += 1) {
    await next.click();
  }
  await expect(alert).toContainText('The answer is 155. Do what you will with that information.');
  await hintedNumber.fill('160');
  await next.click();
  await expect(alert).toContainText('You found the range on attempt 13.');
});
