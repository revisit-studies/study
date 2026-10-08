import { expect, test, Page } from '@playwright/test';
import { nextClick, openStudyFromLanding, resetClientStudyState } from './utils';

async function openComponent(page: Page, component: string, study = 'demo-answer-feedback') {
  await resetClientStudyState(page);
  await page.route(`**/${study}/config.json*`, async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.sequence.components = [config.sequence.components[0], component];
    await route.fulfill({ response, json: config });
  });
  await openStudyFromLanding(page, 'Demo Studies', study === 'demo-answer-feedback' ? 'Answer Validation and Feedback Demo' : 'Form Elements Demo');
  await nextClick(page);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
  if (component === 'Custom Feedback' || component === 'Answer Feedback') {
    await expect(page.getByRole('button', { name: 'Check Answer', exact: true })).toHaveCount(0);
  } else {
    await expect(page.getByRole('button', { name: 'Check Answer', exact: true })).toBeVisible();
  }
}

test('the registered demo discovers and grades exact answers and alternative lists', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Answer Validation and Feedback Demo');
  await nextClick(page);
  await page.getByPlaceholder('Exact number').fill('3');
  await page.getByPlaceholder('Country name').fill('Canada');
  await page.getByPlaceholder('Number from a list').fill('6');
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.getByPlaceholder('Exact number').fill('4');
  await page.getByPlaceholder('Country name').fill('US');
  await page.getByPlaceholder('Number from a list').fill('1');
  await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(3);
  await nextClick(page);
  await expect(page.getByPlaceholder('Inclusive range')).toBeVisible();
});

for (const endpoint of [-10, 10]) {
  test(`real numeric range config accepts inclusive endpoint ${endpoint} and open ranges`, async ({ page }) => {
    await openComponent(page, 'Numeric Ranges');
    await page.getByPlaceholder('Inclusive range').fill(String(endpoint < 0 ? -11 : 11));
    await page.getByPlaceholder('Lower bound only').fill('-1');
    await page.getByPlaceholder('Upper bound only').fill('1');
    await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(3);
    await page.getByPlaceholder('Inclusive range').fill(String(endpoint));
    await page.getByPlaceholder('Lower bound only').fill(endpoint < 0 ? '0' : '5');
    await page.getByPlaceholder('Upper bound only').fill(endpoint < 0 ? '-5' : '0');
    await page.getByRole('button', { name: 'Check Answer', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  });
}

test('range-only and one-sided answers reveal their accepted bounds after exhaustion', async ({ page }) => {
  await openComponent(page, 'Numeric Ranges');
  await page.getByPlaceholder('Inclusive range').fill('11');
  await page.getByPlaceholder('Lower bound only').fill('-1');
  await page.getByPlaceholder('Upper bound only').fill('1');
  const check = page.getByRole('button', { name: 'Check Answer', exact: true });
  await check.click();
  await check.click();
  await check.click();
  const alerts = page.getByRole('alert');
  await expect(alerts).toHaveCount(3);
  await expect(alerts.filter({ hasText: 'The correct answer was: -10 to 10 (inclusive).' })).toBeVisible();
  await expect(alerts.filter({ hasText: 'The correct answer was: at least 0.' })).toBeVisible();
  await expect(alerts.filter({ hasText: 'The correct answer was: at most 0.' })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('undefined');
  await expect(page.getByRole('alert')).toHaveCount(3);
  await expect(check).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
});

test('list-only answers reveal every accepted value after exhaustion', async ({ page }) => {
  await openComponent(page, 'Exact Answers and Lists');
  await page.getByPlaceholder('Exact number').fill('3');
  await page.getByPlaceholder('Country name').fill('Canada');
  await page.getByPlaceholder('Number from a list').fill('6');
  const check = page.getByRole('button', { name: 'Check Answer', exact: true });
  await check.click();
  await check.click();
  await check.click();
  const alerts = page.getByRole('alert');
  await expect(alerts.filter({ hasText: 'The correct answer was: United States or United States of America or USA or US.' })).toBeVisible();
  await expect(alerts.filter({ hasText: 'The correct answer was: 1 or 2 or 3 or 4 or 5.' })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('undefined');
  await expect(check).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
});

test('real unlimited attempts repeat the final hint and permit correcting the answer', async ({ page }) => {
  await openComponent(page, 'Unlimited Hints');
  const input = page.getByPlaceholder('Number between 150 and 160');
  const check = page.getByRole('button', { name: 'Check Answer', exact: true });
  const alert = page.getByRole('alert');
  await input.fill('140');
  await check.click();
  await expect(alert).toContainText('That is outside the range. You have unlimited attempts left.');
  await check.click();
  await expect(alert).toContainText('Hint: choose a number from 150 to 160, including the endpoints.');
  await check.click();
  await expect(alert).toContainText('Hint: choose a number from 150 to 160, including the endpoints.');
  await expect(input).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await input.fill('160');
  await check.click();
  await expect(alert).toContainText('You found the range on attempt 4.');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
});

test('the real form elements feedback page grades a range, a country list, and an alternative checkbox set', async ({ page }) => {
  await openComponent(page, 'Answer Feedback', 'demo-form-elements');
  await page.getByPlaceholder('Feedback estimate').fill('44');
  await page.getByPlaceholder('Feedback country').fill('Canada');
  await page.getByRole('checkbox', { name: 'A', exact: true }).check();
  await page.getByRole('checkbox', { name: 'C', exact: true }).check();
  const check = page.getByRole('button', { name: 'Next', exact: true });
  await check.click();
  await expect(page.getByRole('alert')).toHaveCount(3);
  await expect(page.getByRole('status')).toHaveText('partially correct');
  await check.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Hint: use United States' })).toBeVisible();
  await page.getByPlaceholder('Feedback estimate').fill('55');
  await page.getByPlaceholder('Feedback country').fill('USA');
  await page.getByRole('checkbox', { name: 'A', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'D', exact: true }).check();
  await check.click();
  await expect(page.getByRole('alert')).toHaveCount(3);
  await expect(page.getByRole('status')).toHaveText('correct');
  await expect(page.getByRole('alert').filter({ hasText: 'Yes, that country name is accepted!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
});
