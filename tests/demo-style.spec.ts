import { test, expect, Page } from '@playwright/test';
import { resetClientStudyState } from './utils';

async function openComponent(page: Page, component: string) {
  await page.goto(`/demo-style/reviewer-${component}`);
  await expect(page.locator('.responseBlock-belowStimulus')).toBeAttached();
  const closeBrowser = page.getByRole('complementary').locator('.mantine-CloseButton-root');
  if (await closeBrowser.isVisible()) {
    await closeBrowser.click();
  }
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(page.locator('.study-content')).toBeVisible();
}

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
    await openComponent(page, example.component);
    const card = page.locator(`#${example.component}`);
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('padding-left', example.padding);
    await expect(card).toHaveCSS('padding-right', example.padding);
    await expect(card).toHaveCSS('background-color', example.background);
    await expect(card).toHaveCSS('border-left-width', '1px');
    await expect(card).toHaveCSS('width', example.width);
    await expect(page.locator('.study-content')).toHaveCSS('padding-left', '0px');
    await expect(page.locator('.study-content')).toHaveCSS('padding-right', '0px');
  });
}

test('demo-style explicit response width overrides the default field limit', async ({ page }) => {
  await openComponent(page, 'responses');
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
  await expect(shortText.locator('input')).toHaveCSS('width', '280px');
});

test('demo-style custom form and grid styles still apply', async ({ page }) => {
  await openComponent(page, 'survey-form');
  const occupation = page.locator('#form-occupation');
  await expect(occupation).toBeVisible();
  await expect(occupation).toHaveCSS('padding-left', '20px');
  await expect(occupation).toHaveCSS('padding-right', '20px');
  await expect(occupation).toHaveCSS('border-left-width', '2px');
  await occupation.locator('input').fill('Researcher');
  await expect(occupation.locator('input')).toHaveValue('Researcher');

  await openComponent(page, 'layout');
  const color = page.locator('#layout-color');
  await expect(color).toBeVisible();
  await expect(page.locator('.responseBlock-belowStimulus')).toHaveCSS('display', 'grid');
  await expect(color).toHaveCSS('padding-left', '15px');
  await expect(color.locator('..')).toHaveCSS('grid-column-start', 'span 2');
  await expect(page.locator('#layout-opinion').locator('..')).toHaveCSS('grid-column-start', 'span 6');
});

for (const viewport of [
  { width: 1280, span: 2 },
  { width: 850, span: 3 },
  { width: 390, span: 6 },
]) {
  test(`demo-style fits a ${viewport.width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: 844 });
    await openComponent(page, 'layout');
    const color = page.locator('#layout-color');
    await expect(color).toBeVisible();
    await expect(color.locator('..')).toHaveCSS('grid-column-start', `span ${viewport.span}`);
    await expect(page.locator('#layout-website-design').locator('..')).toHaveCSS('grid-column-start', `span ${viewport.span === 6 ? 6 : 3}`);
    await expect(page.locator('#layout-opinion').locator('..')).toHaveCSS('grid-column-start', 'span 6');
    const layoutOverflow = await page.locator('.responseBlock-belowStimulus').evaluate((block) => {
      const bounds = block.getBoundingClientRect();
      const overflowingCards = Array.from(block.querySelectorAll('.response')).flatMap((card) => {
        const cardBounds = card.getBoundingClientRect();
        return cardBounds.left >= bounds.left - 1 && cardBounds.right <= bounds.right + 1 ? [] : [card.id];
      });
      return {
        overflowingCards,
        overflow: block.scrollWidth - block.clientWidth,
        cardOverflow: Array.from(block.querySelectorAll('.response')).map((card) => ({
          id: card.id, overflow: card.scrollWidth - card.clientWidth,
        })).filter((card) => card.overflow > 1),
      };
    });
    expect(layoutOverflow.overflowingCards).toEqual([]);
    expect(layoutOverflow.overflow, JSON.stringify(layoutOverflow.cardOverflow)).toBeLessThanOrEqual(1);
    await color.locator('input').fill('Blue');
    await expect(color.locator('input')).toHaveValue('Blue');
    await page.locator('#layout-web-enjoyment').getByRole('radio', { name: 'Yes', exact: true }).check();
    await expect(page.locator('#layout-web-enjoyment').getByRole('radio', { name: 'Yes', exact: true })).toBeChecked();
    const preference = page.locator('#layout-preference').getByRole('radio', { name: 'Definitely', exact: true });
    await preference.click();
    await expect(preference).toBeChecked();

    await openComponent(page, 'survey-form');
    const occupation = page.locator('#form-occupation');
    await expect(occupation).toBeVisible();
    const formGeometry = await occupation.evaluate((card) => {
      const content = card.closest('.responseBlock')!;
      const contentStyle = getComputedStyle(content);
      const contentWidth = content.clientWidth - parseFloat(contentStyle.paddingLeft) - parseFloat(contentStyle.paddingRight);
      const image = document.querySelector('#survey-form')!;
      const main = card.closest('.main')!;
      const mainStyle = getComputedStyle(main);
      return {
        available: contentWidth,
        mainWidth: main.clientWidth - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight),
        card: card.getBoundingClientRect().width,
        image: image.getBoundingClientRect().width,
        cardCenter: card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2,
        contentCenter: content.getBoundingClientRect().left + content.clientWidth / 2,
      };
    });
    expect(formGeometry.card).toBeCloseTo(Math.min(640, formGeometry.available), 0);
    expect(formGeometry.image).toBeCloseTo(Math.min(640, formGeometry.mainWidth), 0);
    expect(formGeometry.cardCenter).toBeCloseTo(formGeometry.contentCenter, 0);
    await occupation.locator('input').fill('Researcher');
    await expect(occupation.locator('input')).toHaveValue('Researcher');

    await openComponent(page, 'responses');
    const numerical = page.locator('#numerical-response-style');
    await expect(numerical).toBeVisible();
    const responseGeometry = await numerical.evaluate((card) => {
      const parent = card.parentElement!;
      return { card: card.getBoundingClientRect().width, available: parent.clientWidth };
    });
    expect(responseGeometry.card).toBeCloseTo(Math.min(700, responseGeometry.available), 0);
    await numerical.locator('input').fill('42');
    await expect(numerical.locator('input')).toHaveValue('42');
  });
}
