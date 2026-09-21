/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { resetClientStudyState } from './utils';

test.beforeEach(async ({ page }) => {
  await resetClientStudyState(page);
});

test('default answer widths leave questions and long text full width', async ({ page }) => {
  await page.goto('/demo-form-elements/reviewer-Form%20Elements');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  await expect(page.locator('#q-numerical input[type="text"]')).toHaveCSS('width', '150px');
  await expect(page.locator('#q-short-text input')).toHaveCSS('width', '280px');
  await expect(page.locator('#q-dropdown .mantine-Input-wrapper')).toHaveCSS('width', '280px');
  const widths = await page.locator('#q-long-text').evaluate((response) => ({
    response: response.getBoundingClientRect().width,
    field: response.querySelector('textarea')!.getBoundingClientRect().width,
    numericalQuestion: document.querySelector('#q-numerical')!.getBoundingClientRect().width,
  }));
  expect(widths.field).toBeCloseTo(widths.response, 0);
  expect(widths.numericalQuestion).toBeGreaterThan(240);
});

test('date and telephone inputs use the xs width', async ({ page }) => {
  await page.goto('/demo-form-elements/reviewer-Text%20Validation');
  for (const id of ['date-range-response', 'month-picker-response', 'year-picker-response', 'built-in-validation-phone-number', 'built-in-validation-us-phone-number']) {
    await expect(page.locator(`#${id} .mantine-Input-wrapper`)).toHaveCSS('width', '150px');
  }
});

test('compact multiselect keeps one pill and search on one row while allowing more pills to wrap', async ({ page }) => {
  await page.route('**/demo-form-elements/config.json', async (route) => {
    const result = await route.fetch();
    const config = await result.json();
    config.components['Default Values'].response.find((response: { id: string }) => response.id === 'default-dropdown-multiselect').style = { width: '280px' };
    await route.fulfill({ response: result, json: config });
  });
  await page.goto('/demo-form-elements/reviewer-Default%20Values');
  const response = page.locator('#default-dropdown-multiselect');
  const wrapper = response.locator('.mantine-Input-wrapper');
  const search = response.locator('input:not([type="hidden"])');
  await expect(wrapper).toHaveCSS('width', '280px');
  await expect(response.locator('.mantine-Pill-label')).toHaveText(['Line']);
  const geometry = await wrapper.evaluate((field) => {
    const pill = field.querySelector('.mantine-Pill-root')!.getBoundingClientRect();
    const input = field.querySelector('input:not([type="hidden"])')!.getBoundingClientRect();
    return { pillCenter: pill.top + pill.height / 2, searchCenter: input.top + input.height / 2, height: field.getBoundingClientRect().height };
  });
  expect(Math.abs(geometry.pillCenter - geometry.searchCenter)).toBeLessThanOrEqual(1);

  await search.fill('Bar');
  await expect(page.getByRole('option', { name: 'Pie', exact: true })).toHaveCount(0);
  await page.getByRole('option', { name: 'Bar', exact: true }).click();
  await search.fill('Scatter');
  await page.getByRole('option', { name: 'Scatter', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(response.locator('.mantine-Pill-label')).toHaveText(['Line', 'Bar', 'Scatter']);
  expect((await wrapper.boundingBox())!.height).toBeGreaterThan(geometry.height);
  await response.locator('.mantine-Pill-root').filter({ hasText: 'Bar' }).locator('.mantine-Pill-remove').click();
  await expect(response.locator('.mantine-Pill-label')).toHaveText(['Line', 'Scatter']);
  await wrapper.locator('[data-position="right"] button').click();
  await expect(response.locator('.mantine-Pill-label')).toHaveCount(0);
  await expect(search).toHaveValue('');
});

test('full responses cap at 1600px while explicit widths and unrelated fields remain unrestricted', async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 1000 });
  await page.route('**/demo-form-elements/config.json', async (route) => {
    const result = await route.fetch();
    const config = await result.json();
    for (const id of ['q-long-text', 'q-numerical']) {
      config.components['Form Elements'].response.find((response: { id: string }) => response.id === id).style = { width: '1800px' };
    }
    await route.fulfill({ response: result, json: config });
  });
  await page.goto('/demo-form-elements/reviewer-Form%20Elements');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  for (const id of ['q-slider', 'q-likert', 'q-multi-satisfaction', 'multi-custom']) {
    await expect(page.locator(`#${id}`)).toHaveCSS('width', '1600px');
  }
  for (const id of ['q-long-text', 'q-numerical']) {
    await expect(page.locator(`#${id}`)).toHaveCSS('width', '1800px');
    await expect(page.locator(`#${id} .mantine-Input-wrapper`)).toHaveCSS('width', '1800px');
  }
  // A clone outside any response detects accidental global Input wrapper rules.
  const unrelatedWidth = await page.locator('#q-numerical .mantine-Input-wrapper').evaluate((field) => {
    const unrelated = field.cloneNode(true) as HTMLElement;
    unrelated.style.width = '1800px';
    document.body.appendChild(unrelated);
    const { width } = unrelated.getBoundingClientRect();
    unrelated.remove();
    return width;
  });
  expect(unrelatedWidth).toBe(1800);

  await page.goto('/demo-form-elements/reviewer-Custom%20Response');
  await expect(page.locator('#custom-response-demo')).toHaveCSS('width', '1600px');
});

for (const example of [
  { id: 'time-standard-response', format: '24h', seconds: false },
  { id: 'time-12-hour-response', format: '12h', seconds: false },
  { id: 'time-seconds-response', format: '24h', seconds: true },
  { id: 'time-seconds-response', format: '12h', seconds: true },
]) {
  test(`180px time input fits ${example.format} with seconds ${example.seconds}`, async ({ page }) => {
    if (example.format === '12h' && example.seconds) {
      await page.route('**/demo-form-elements/config.json', async (route) => {
        const result = await route.fetch();
        const config = await result.json();
        config.components['Text Validation'].response.find((response: { id: string }) => response.id === example.id).format = '12h';
        await route.fulfill({ response: result, json: config });
      });
    }
    await page.goto('/demo-form-elements/reviewer-Text%20Validation');
    const response = page.locator(`#${example.id}`);
    const wrapper = response.locator('.mantine-Input-wrapper');
    await expect(wrapper).toHaveCSS('width', '180px');
    const inputs = response.locator('input:not([type="hidden"])');
    await expect(inputs).toHaveCount(2 + Number(example.seconds) + Number(example.format === '12h'));
    await inputs.nth(0).fill('02');
    await inputs.nth(1).fill('28');
    if (example.seconds) {
      await inputs.nth(2).fill('30');
    }
    if (example.format === '12h') {
      await inputs.last().fill('PM');
    }
    await response.locator('label').click();
    await page.keyboard.press('Tab');
    const geometry = await wrapper.evaluate((field) => {
      const bounds = field.getBoundingClientRect();
      const clear = field.querySelector('button')!.getBoundingClientRect();
      const lastInput = Array.from(field.querySelectorAll('input:not([type="hidden"])')).at(-1)!.getBoundingClientRect();
      return {
        lastInputRight: lastInput.right, clearLeft: clear.left, clearRight: clear.right, fieldRight: bounds.right,
      };
    });
    expect(geometry.lastInputRight).toBeLessThanOrEqual(geometry.clearLeft);
    expect(geometry.clearRight).toBeLessThanOrEqual(geometry.fieldRight);
    await expect(inputs.nth(1)).toHaveValue('28');
    await wrapper.locator('button').click();
    await expect(inputs.nth(0)).toHaveValue('');
  });
}
