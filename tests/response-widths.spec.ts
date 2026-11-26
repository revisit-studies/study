/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { resetClientStudyState } from './utils';

test.beforeEach(async ({ page }) => {
  await resetClientStudyState(page);
});

test('Next follows a configured stimulus width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/demo-style/reviewer-markdown-component');
  const stimulus = page.locator('.stimulus');
  const actions = page.locator('.responseBlock-actions');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await expect(stimulus).toHaveCSS('width', '800px');
  await expect(actions).toHaveCSS('width', '800px');
  const rightEdges = await Promise.all([
    stimulus.evaluate((element) => element.getBoundingClientRect().right),
    next.evaluate((button) => button.getBoundingClientRect().right),
  ]);
  expect(Math.abs(rightEdges[0] - rightEdges[1])).toBeLessThanOrEqual(1);
});

test('form blocks and stimulus center within the available space and allow study CSS overrides', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/demo-form-elements/reviewer-Form%20Elements');
  const main = page.locator('.main');
  const form = main.locator('.responseBlock-belowStimulus');
  const stimulus = main.locator('.stimulus');
  const actions = main.locator('.responseBlock-actions');
  const next = main.getByRole('button', { name: 'Next', exact: true });
  const sidebar = page.locator('.responseBlock-sidebar');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  await expect(form).toHaveCSS('width', '880px');
  await expect(stimulus).toHaveCSS('width', '880px');
  await expect(actions).toHaveCSS('width', '880px');
  await expect(form).toHaveCSS('padding-left', '40px');
  await expect(sidebar).toHaveCSS('padding-left', '0px');
  for (const element of [form, stimulus]) {
    const centered = await element.evaluate((block) => {
      const mainBounds = block.closest('.main')!.getBoundingClientRect();
      const bounds = block.getBoundingClientRect();
      return Math.abs((bounds.left + bounds.right) - (mainBounds.left + mainBounds.right));
    });
    expect(centered).toBeLessThanOrEqual(1);
  }
  const rightEdges = await Promise.all([
    stimulus.evaluate((block) => block.getBoundingClientRect().right),
    next.evaluate((button) => button.getBoundingClientRect().right),
  ]);
  expect(Math.abs(rightEdges[0] - rightEdges[1])).toBeLessThanOrEqual(1);
  await page.addStyleTag({ content: '.responseBlock-belowStimulus, .stimulus, .responseBlock-actions { max-width: 1000px; }' });
  await expect(form).toHaveCSS('width', '1000px');
  await expect(stimulus).toHaveCSS('width', '1000px');
  await expect(actions).toHaveCSS('width', '1000px');

  await page.goto('/demo-form-elements/reviewer-Next%20Button%20Alignment');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  await expect(actions).toHaveCSS('padding-left', '40px');
  const leftEdges = await Promise.all([
    form.evaluate((block) => block.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(block).paddingLeft)),
    next.evaluate((button) => button.getBoundingClientRect().left),
  ]);
  expect(Math.abs(leftEdges[0] - leftEdges[1])).toBeLessThanOrEqual(1);

  await page.goto('/demo-style/reviewer-responses');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  await page.setViewportSize({ width: 760, height: 900 });
  await expect(form).toHaveCSS('width', '728px');
  const padding = await form.evaluate((block) => Number.parseFloat(getComputedStyle(block).paddingLeft));
  expect(padding).toBeGreaterThanOrEqual(16);
  expect(padding).toBeLessThan(40);
});

test('matrix choices fit when possible and scroll inside the form when needed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/demo-form-elements/config.json', async (route) => {
    const result = await route.fetch();
    const config = await result.json();
    config.uiConfig.withSidebar = false;
    config.components['Form Elements'].response.find((response: { id: string }) => response.id === 'multi-custom').answerOptions = Array.from({ length: 10 }, (_, index) => ({
      label: `Choice ${index + 1} with a longer descriptive label`,
      value: `choice-${index + 1}`,
      infoText: `Additional information for choice ${index + 1}`,
    }));
    await route.fulfill({ response: result, json: config });
  });
  await page.goto('/demo-form-elements/reviewer-Form%20Elements');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  const response = page.locator('#multi-custom');
  const matrix = response.locator('.matrix-grid');
  const scrollRegion = response.locator('..');
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  const columnAlignment = await matrix.evaluate((element) => {
    const header = element.children[1].children[0].getBoundingClientRect();
    const checkbox = element.children[3].querySelector('input[type="checkbox"]')!.getBoundingClientRect();
    return Math.abs((header.left + header.right) / 2 - (checkbox.left + checkbox.right) / 2);
  });
  expect(columnAlignment).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 500, height: 900 });
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 350, height: 900 });
  expect(await scrollRegion.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const matrixHeaderCells = matrix.locator(':scope > div').nth(1).locator(':scope > div');
  const headersContainLabelAndInfo = await matrix.locator(':scope > div').nth(1).locator(':scope > div').evaluateAll((cells) => cells.every((cell) => {
    const cellBounds = cell.getBoundingClientRect();
    const labelBounds = cell.querySelector('.mantine-Text-root')!.getBoundingClientRect();
    const infoBounds = cell.querySelector('svg')!.getBoundingClientRect();
    return labelBounds.left >= cellBounds.left
      && labelBounds.right <= cellBounds.right
      && infoBounds.left >= cellBounds.left
      && infoBounds.right <= cellBounds.right;
  }));
  expect(headersContainLabelAndInfo).toBe(true);
  await expect(matrixHeaderCells).toHaveCount(10);
  await matrix.getByRole('checkbox').first().check();
  await expect(matrix.getByRole('checkbox').first()).toBeChecked();
});

test('full-width buttons wrap to fit available rows and center incomplete rows', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 900 });
  let optionCount = 6;
  let shortLabels = false;
  let includeArrowKey = false;
  await page.route('**/demo-form-elements/config.json', async (route) => {
    const result = await route.fetch();
    const config = await result.json();
    config.uiConfig.withSidebar = false;
    config.components['Form Elements'].response.find((response: { id: string }) => response.id === 'q-buttons').options = Array.from({ length: optionCount }, (_, index) => {
      const label = shortLabels
        ? String.fromCharCode(65 + index)
        : optionCount === 6 && index === 5
          ? 'Long option'
          : optionCount >= 7 && index === 0
            ? 'Averylongunbrokenbuttonlabelthatmustwrap'
            : `Option ${index + 1}`;
      const key = !shortLabels && optionCount >= 7 && index === 0
        ? 'PageDown'
        : !shortLabels && optionCount === 10 && index === 1
          ? 'Shift+Alt+ArrowRight'
          : includeArrowKey && index === 0
            ? 'ArrowLeft'
            : undefined;
      return { label, value: `value-${index + 1}`, key };
    });
    await route.fulfill({ response: result, json: config });
  });
  await page.goto('/demo-form-elements/reviewer-Form%20Elements');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();

  const buttons = page.locator('#q-buttons [data-button-option]');
  for (const [count, sizes] of [
    [6, [2, 2, 2]],
    [7, [1, 1, 1, 1, 1, 1, 1]],
    [10, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  ] as const) {
    optionCount = count;
    await page.setViewportSize({ width: count === 10 ? 200 : count === 6 ? 400 : 500, height: 900 });
    await resetClientStudyState(page);
    await page.goto('/demo-form-elements/reviewer-Form%20Elements');
    await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
    await expect(buttons).toHaveCount(count);
    await expect.poll(() => buttons.evaluateAll((elements) => {
      const tops = [...new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top)))].sort();
      return tops.map((top) => elements.filter((element) => Math.round(element.getBoundingClientRect().top) === top).length);
    })).toEqual(sizes);
    const cardWidths = await buttons.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
    expect(Math.max(...cardWidths) - Math.min(...cardWidths)).toBeLessThanOrEqual(1);
    expect(Math.min(...cardWidths)).toBeGreaterThanOrEqual(24);
    if (count === 7) {
      const lowerRowIsCentered = await buttons.evaluateAll((elements) => {
        const gridBounds = elements[0].parentElement!.getBoundingClientRect();
        const rowTops = [...new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top)))].sort();
        const lowerRow = elements.filter((element) => Math.round(element.getBoundingClientRect().top) === rowTops[1]);
        const lowerRowBounds = lowerRow.map((element) => element.getBoundingClientRect());
        const lowerRowCenter = (lowerRowBounds[0].left + lowerRowBounds[lowerRowBounds.length - 1].right) / 2;
        return Math.abs(lowerRowCenter - (gridBounds.left + gridBounds.right) / 2) <= 1;
      });
      expect(lowerRowIsCentered).toBe(true);
    }
    if (count === 6) {
      await buttons.nth(4).focus();
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(buttons.nth(4)).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(buttons.nth(5)).toBeFocused();
    }
  }
  await expect(buttons.first()).toContainText('Averylongunbrokenbuttonlabelthatmustwrap');
  await expect(buttons.last()).toContainText('Option 10');
  const labelAndKeyBounds = await buttons.first().evaluate((button) => {
    const label = button.querySelector('.mantine-Text-root')!;
    const key = button.querySelector('.mantine-Kbd-root')!;
    const labelBounds = label.getBoundingClientRect();
    const keyBounds = key.getBoundingClientRect();
    const buttonBounds = button.getBoundingClientRect();
    return {
      labelInsideButton: labelBounds.right <= buttonBounds.right,
      keyInsideButton: keyBounds.right <= buttonBounds.right,
      labelDoesNotOverlapKey: labelBounds.right <= keyBounds.left,
      contentFitsHorizontally: button.scrollWidth <= button.clientWidth,
      keyFitsHorizontally: key.scrollWidth <= key.clientWidth,
      buttonWidth: buttonBounds.width,
      keyRight: keyBounds.right,
      buttonRight: buttonBounds.right,
      keyWidth: keyBounds.width,
      labelHeight: labelBounds.height,
      lineHeight: Number.parseFloat(getComputedStyle(label).lineHeight),
    };
  });
  expect(labelAndKeyBounds.labelInsideButton).toBe(true);
  expect(labelAndKeyBounds.keyRight).toBeLessThanOrEqual(labelAndKeyBounds.buttonRight);
  expect(labelAndKeyBounds.labelDoesNotOverlapKey).toBe(true);
  expect(labelAndKeyBounds.contentFitsHorizontally).toBe(true);
  expect(labelAndKeyBounds.keyFitsHorizontally).toBe(true);
  await expect(buttons.first().locator('.mantine-Kbd-root')).toContainText('PAGEDOWN');
  const compoundKeyBadge = buttons.nth(1).locator('.mantine-Kbd-root');
  await expect(compoundKeyBadge.locator('svg')).toHaveCount(1);
  const compoundKeyFits = await compoundKeyBadge.evaluate((badge) => {
    const badgeBounds = badge.getBoundingClientRect();
    const button = badge.closest('[data-button-option]')!;
    const buttonBounds = button.getBoundingClientRect();
    const labelBounds = button.querySelector('.mantine-Text-root')!.getBoundingClientRect();
    return badge.scrollWidth <= badge.clientWidth
      && badgeBounds.right <= buttonBounds.right
      && labelBounds.width >= 24
      && labelBounds.right <= badgeBounds.left;
  });
  expect(compoundKeyFits).toBe(true);
  const buttonScrollRegion = page.locator('#q-buttons [data-button-scroll-region]');
  expect(await buttonScrollRegion.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(labelAndKeyBounds.labelHeight).toBeGreaterThan(labelAndKeyBounds.lineHeight);
  const wrappedCardHeights = await buttons.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(Math.max(...wrappedCardHeights)).toBeGreaterThan(Math.min(...wrappedCardHeights));

  optionCount = 6;
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetClientStudyState(page);
  await page.goto('/demo-form-elements/reviewer-Form%20Elements');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  await expect(buttons).toHaveCount(6);
  await expect(buttons.last()).toContainText('Long option');
  await expect.poll(() => buttons.evaluateAll((elements) => new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top))).size)).toBe(1);
  const oneRowWidths = await buttons.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  expect(Math.max(...oneRowWidths) - Math.min(...oneRowWidths)).toBeLessThanOrEqual(1);
  const oneRowBounds = await buttons.evaluateAll((elements) => {
    const row = elements[0].parentElement!.getBoundingClientRect();
    return elements.every((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= row.left && bounds.right <= row.right;
    });
  });
  expect(oneRowBounds).toBe(true);

  await page.setViewportSize({ width: 500, height: 900 });
  await expect.poll(() => buttons.evaluateAll((elements) => {
    const tops = [...new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top)))].sort();
    return tops.map((top) => elements.filter((element) => Math.round(element.getBoundingClientRect().top) === top).length);
  })).toEqual([3, 3]);
  const transitionLayouts = await buttons.evaluateAll(async (elements) => {
    const capture = () => [...new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top)))].sort().join(',');
    const layouts = [];
    for (let frame = 0; frame < 4; frame += 1) {
      layouts.push(capture());
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
    return layouts;
  });
  expect(new Set(transitionLayouts).size).toBe(1);

  shortLabels = true;
  optionCount = 10;
  await page.setViewportSize({ width: 1440, height: 900 });
  await resetClientStudyState(page);
  await page.goto('/demo-form-elements/reviewer-Form%20Elements');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  await expect(buttons).toHaveCount(10);
  await expect.poll(() => buttons.evaluateAll((elements) => new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top))).size)).toBe(1);
  const oneRowHorizontalGap = await page.locator('#q-buttons [data-button-grid]').evaluate((grid) => getComputedStyle(grid).columnGap);
  await page.setViewportSize({ width: 500, height: 900 });
  await expect.poll(() => buttons.evaluateAll((elements) => new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top))).size)).toBe(2);
  const twoRowLayout = await buttons.evaluateAll((elements) => {
    const firstRow = elements[0].getBoundingClientRect();
    const secondRow = elements.find((element) => element.getBoundingClientRect().top > firstRow.top)!.getBoundingClientRect();
    return {
      horizontalGap: getComputedStyle(elements[0].parentElement!).columnGap,
      verticalGap: secondRow.top - firstRow.bottom,
    };
  });
  expect(Number.parseFloat(twoRowLayout.horizontalGap)).toBeLessThan(Number.parseFloat(oneRowHorizontalGap));
  expect(twoRowLayout.verticalGap).toBe(18);
  await page.setViewportSize({ width: 200, height: 900 });
  await expect.poll(() => buttons.evaluateAll((elements) => {
    const tops = [...new Set(elements.map((element) => Math.round(element.getBoundingClientRect().top)))].sort();
    return tops.map((top) => elements.filter((element) => Math.round(element.getBoundingClientRect().top) === top).length);
  })).toEqual([2, 2, 2, 2, 2]);
  optionCount = 2;
  includeArrowKey = true;
  await resetClientStudyState(page);
  await page.goto('/demo-form-elements/reviewer-Form%20Elements');
  await page.getByRole('complementary').locator('.mantine-CloseButton-root').click();
  await expect(buttons).toHaveCount(2);
  await expect(buttons.first().locator('.mantine-Kbd-root svg')).toHaveCount(1);
  const narrowArrowBounds = await buttons.first().evaluate((button) => {
    const label = button.querySelector('.mantine-Text-root')!.getBoundingClientRect();
    const badge = button.querySelector('.mantine-Kbd-root')!.getBoundingClientRect();
    return label.width > 0 && label.right <= badge.left;
  });
  expect(narrowArrowBounds).toBe(true);
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

test('compact multiselect avoids an idle blank row and supports searching, wrapping, and clearing', async ({ page }) => {
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
  await expect(search).not.toBeFocused();
  await expect(search).toHaveCSS('opacity', '0');
  const idleGeometry = await wrapper.evaluate((field) => {
    const bounds = field.getBoundingClientRect();
    const pill = field.querySelector('.mantine-Pill-root')!.getBoundingClientRect();
    return { height: bounds.height, centerOffset: pill.top + pill.height / 2 - (bounds.top + bounds.height / 2) };
  });
  expect(Math.abs(idleGeometry.centerOffset)).toBeLessThanOrEqual(1);

  await response.locator('label').click();
  await expect(search).toBeFocused();
  await expect(search).toHaveCSS('opacity', '1');
  const geometry = await wrapper.evaluate((field) => {
    const pill = field.querySelector('.mantine-Pill-root')!.getBoundingClientRect();
    const input = field.querySelector('input:not([type="hidden"])')!.getBoundingClientRect();
    return { pillCenter: pill.top + pill.height / 2, searchCenter: input.top + input.height / 2, height: field.getBoundingClientRect().height };
  });
  expect(Math.abs(geometry.pillCenter - geometry.searchCenter)).toBeLessThanOrEqual(1);
  expect(geometry.height).toBeCloseTo(idleGeometry.height, 0);

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
  await search.blur();
  await expect(search).toHaveCSS('opacity', '1');
  await expect.poll(async () => (await wrapper.boundingBox())!.height).toBeCloseTo(idleGeometry.height, 0);
});

test('full responses fit the form column while explicit widths remain scrollable', async ({ page }) => {
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
    await expect(page.locator(`#${id}`)).toHaveCSS('width', '800px');
  }
  for (const id of ['q-long-text', 'q-numerical']) {
    await expect(page.locator(`#${id}`)).toHaveCSS('width', '1800px');
    await expect(page.locator(`#${id} .mantine-Input-wrapper`)).toHaveCSS('width', '1800px');
    const wrapper = page.locator(`#${id}`).locator('..');
    expect(await wrapper.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
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
  await expect(page.locator('#custom-response-demo')).toHaveCSS('width', '800px');
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
    // Allow subpixel layout differences between local and CI font rendering.
    const pixelTolerance = 1;
    expect(geometry.lastInputRight).toBeLessThanOrEqual(geometry.clearLeft + pixelTolerance);
    expect(geometry.clearRight).toBeLessThanOrEqual(geometry.fieldRight + pixelTolerance);
    await expect(inputs.nth(1)).toHaveValue('28');
    await wrapper.locator('button').click();
    await expect(inputs.nth(0)).toHaveValue('');
  });
}
