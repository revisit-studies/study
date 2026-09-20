import { test, expect } from '@playwright/test';
import { resetClientStudyState } from './utils';

test.beforeEach(async ({ page }) => {
  await resetClientStudyState(page);
});

for (const example of [
  {
    component: 'markdown-component', padding: '30px', width: '800px', background: 'rgb(222, 239, 245)',
  },
  {
    component: 'react-component', padding: '24px', width: '700px', background: 'rgb(246, 249, 252)',
  },
]) {
  test(`demo-style keeps ${example.component} padding inside its styled card`, async ({ page }) => {
    await page.goto(`/demo-style/reviewer-${example.component}`);
    const card = page.locator(`#${example.component}`);
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('padding-left', example.padding);
    await expect(card).toHaveCSS('padding-right', example.padding);
    await expect(card).toHaveCSS('background-color', example.background);
    await expect(card).toHaveCSS('border-left-width', '1px');
    await expect(card).toHaveCSS('width', example.width);
    await expect(page.locator('.study-content')).toHaveCSS('padding-left', '40px');
    await expect(page.locator('.study-content')).toHaveCSS('padding-right', '40px');
  });
}

test('demo-style explicit response width overrides the default field limit', async ({ page }) => {
  await page.goto('/demo-style/reviewer-responses');
  const numberResponse = page.locator('#numerical-response-style');
  await expect(numberResponse).toBeVisible();
  await expect(numberResponse).toHaveCSS('width', '700px');
  await expect(numberResponse).toHaveCSS('padding-left', '12px');
  await expect(numberResponse).toHaveCSS('border-left-width', '2px');
  const numberInput = numberResponse.locator('input');
  await expect(numberInput).toHaveCSS('width', '672px');
  await numberInput.fill('12');
  await expect(numberInput).toHaveValue('12');

  const shortText = page.locator('#short-text-response-style');
  await expect(shortText).toHaveCSS('padding-left', '10px');
  await expect(shortText.locator('input')).toHaveCSS('width', '300px');
});

test('demo-style custom form and grid styles still apply', async ({ page }) => {
  await page.goto('/demo-style/reviewer-survey-form');
  const occupation = page.locator('#form-occupation');
  await expect(occupation).toBeVisible();
  await expect(occupation).toHaveCSS('padding-left', '20px');
  await expect(occupation).toHaveCSS('padding-right', '20px');
  await expect(occupation).toHaveCSS('border-left-width', '2px');
  await occupation.locator('input').fill('Researcher');
  await expect(occupation.locator('input')).toHaveValue('Researcher');

  await page.goto('/demo-style/reviewer-layout');
  const color = page.locator('#layout-color');
  await expect(color).toBeVisible();
  await expect(page.locator('.responseBlock-belowStimulus')).toHaveCSS('display', 'grid');
  await expect(color).toHaveCSS('padding-left', '15px');
  await expect(color.locator('..')).toHaveCSS('grid-column-start', 'span 2');
  await expect(page.locator('#layout-opinion').locator('..')).toHaveCSS('grid-column-start', 'span 6');
});
