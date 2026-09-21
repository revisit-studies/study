import { test, expect, Locator } from '@playwright/test';
import { resetClientStudyState } from './utils';

async function expectLabelAlignment(response: Locator, multiline = true) {
  const prompt = response.locator('.no-last-child-bottom-padding').first();
  await expect(prompt).toBeVisible();
  const bounds = await prompt.evaluate((element) => {
    const row = element.parentElement!;
    const required = row.querySelector('.required-asterisk')!;
    const number = required.nextElementSibling!;
    const icon = element.querySelector('svg')!;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes: Node[] = [];
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.trim()) textNodes.push(walker.currentNode);
    }
    const lastText = textNodes[textNodes.length - 1];
    const range = document.createRange();
    range.setStart(lastText, lastText.textContent!.trimEnd().length - 1);
    range.setEnd(lastText, lastText.textContent!.trimEnd().length);
    const textRect = range.getBoundingClientRect();
    const promptRect = element.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    return {
      promptTop: promptRect.top,
      promptHeight: promptRect.height,
      promptLeft: promptRect.left,
      promptRight: promptRect.right,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
      requiredTop: required.getBoundingClientRect().top,
      numberTop: number.getBoundingClientRect().top,
      iconTop: iconRect.top,
      iconCenter: iconRect.top + iconRect.height / 2,
      iconLeft: iconRect.left,
      textCenter: textRect.top + textRect.height / 2,
      textRight: textRect.right,
      rowRight: row.getBoundingClientRect().right,
      responseRight: element.closest('.response')!.getBoundingClientRect().right,
    };
  });
  if (multiline) expect(bounds.promptHeight).toBeGreaterThan(bounds.lineHeight * 1.5);
  expect(Math.abs(bounds.requiredTop - bounds.promptTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.numberTop - bounds.promptTop)).toBeLessThanOrEqual(1);
  if (bounds.promptRight - bounds.textRight >= 20) {
    expect(Math.abs(bounds.iconCenter - bounds.textCenter)).toBeLessThanOrEqual(4);
    expect(bounds.iconLeft - bounds.textRight).toBeGreaterThanOrEqual(3);
    expect(bounds.iconLeft - bounds.textRight).toBeLessThanOrEqual(5);
  } else {
    expect(bounds.iconCenter - bounds.textCenter).toBeGreaterThanOrEqual(-4);
    expect(bounds.iconCenter - bounds.textCenter).toBeLessThanOrEqual(bounds.lineHeight + 4);
    expect(Math.abs(bounds.iconLeft - bounds.promptLeft)).toBeLessThanOrEqual(5);
  }
  expect(bounds.rowRight).toBeLessThanOrEqual(bounds.responseRight);
}

test('multiline questions keep numbering on the first line and info beside final text', async ({ page }, testInfo) => {
  // The demo reserves 300px for its participant sidebar; leave a narrow form column.
  await page.setViewportSize({ width: 700, height: 844 });
  await resetClientStudyState(page);
  await page.goto('/demo-form-elements/reviewer-Form%20Elements');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  await expect(page.getByRole('complementary')).toHaveCount(0);

  const dropdown = page.locator('#q-multiselect-dropdown');
  await expect.poll(async () => (await dropdown.boundingBox())?.width ?? 0).toBeGreaterThan(200);
  await expectLabelAlignment(dropdown);
  await dropdown.locator('.tabler-icon-info-circle').hover();
  await expect(page.getByRole('tooltip')).toContainText('Select the chart types you have used before.');
  await dropdown.getByPlaceholder('Enter your responses').click();
  await page.getByRole('option', { name: 'Bar', exact: true }).click();
  await page.getByRole('option', { name: 'Bubble', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(dropdown.locator('.mantine-Pill-label')).toHaveText(['Bar', 'Bubble']);

  const checkbox = page.locator('#q-checkbox');
  await checkbox.scrollIntoViewIfNeeded();
  await expectLabelAlignment(checkbox);
  await checkbox.getByRole('checkbox', { name: 'Option 1', exact: true }).check();
  await expect(checkbox.getByRole('checkbox', { name: 'Option 1', exact: true })).toBeChecked();
  await testInfo.attach('multiline-question', { body: await checkbox.screenshot(), contentType: 'image/png' });

  const radio = page.locator('#q-radio-horizontal');
  await radio.getByRole('radio', { name: 'Option 1', exact: true }).check();
  await expectLabelAlignment(radio);
  const clear = radio.getByRole('button', { name: 'Clear selection' });
  const clearBounds = await clear.boundingBox();
  const promptBounds = await radio.locator('.no-last-child-bottom-padding').first().boundingBox();
  expect(clearBounds!.y + clearBounds!.height / 2).toBeLessThan(promptBounds!.y + 24);
  await clear.click();
  await expect(radio.getByRole('radio', { name: 'Option 1', exact: true })).not.toBeChecked();
});

for (const prompt of [
  'Short question?',
  'A long question that wraps naturally and finishes with **bold final words**',
  'A first paragraph of context.\n\nA second paragraph with **bold final words**',
]) {
  test(`info icon follows final text in markdown: ${prompt}`, async ({ page }) => {
    await resetClientStudyState(page);
    await page.route('**/demo-form-elements/config.json', async (route) => {
      const result = await route.fetch();
      const config = await result.json();
      config.uiConfig.withSidebar = false;
      config.components['Form Elements'].response.find((response: { id: string }) => response.id === 'q-checkbox').prompt = prompt;
      await route.fulfill({ response: result, json: config });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo-form-elements/reviewer-Form%20Elements');
    await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
    await expect(page.getByRole('complementary')).toHaveCount(0);
    const checkbox = page.locator('#q-checkbox');
    await expect.poll(async () => (await checkbox.boundingBox())?.width ?? 0).toBeGreaterThan(200);
    await expectLabelAlignment(checkbox, prompt !== 'Short question?');
    await checkbox.locator('.tabler-icon-info-circle').hover();
    await expect(page.getByRole('tooltip')).toHaveText('Select your top 2 choices from the available options.');
  });
}
