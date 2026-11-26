/* eslint-disable no-await-in-loop */
import { expect, test } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

const MARKDOWN_COLORS = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'BLACK'];
const HTML_COLORS = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE', 'PINK', 'BROWN', 'GRAY', 'BLACK', 'CYAN', 'MAGENTA', 'LIME', 'TEAL'];
const HTML_SHORTCUTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w', 'e', 'r'];

test('completes all 25 Markdown Stroop pairs with one assigned font size', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Factor-demos', 'Stroop Test with Factors');
  await expect(page.getByRole('heading', { name: 'Stroop Test with Factors', level: 1, exact: true })).toBeVisible();
  await nextClick(page);

  const stimulus = page.locator('p[style*="font-size"]').filter({ has: page.locator('b') });
  const seenConditions = new Set<string>();
  const fontSizes = new Set<string>();

  for (let trialIndex = 0; trialIndex < 25; trialIndex += 1) {
    await expect(stimulus).toBeVisible();
    await expect.poll(async () => stimulus.evaluate((element) => `${element.textContent?.trim()}-${element.style.color.toUpperCase()}`)
      .then((condition) => !seenConditions.has(condition))).toBe(true);
    const { word, inkColor, fontSize } = await stimulus.evaluate((element) => ({
      word: element.textContent?.trim(),
      inkColor: element.style.color.toUpperCase(),
      fontSize: element.style.fontSize,
    }));
    expect(MARKDOWN_COLORS).toContain(word);
    expect(MARKDOWN_COLORS).toContain(inkColor);
    expect(['24px', '48px']).toContain(fontSize);
    await expect(stimulus).toHaveCSS('font-size', fontSize);
    const condition = `${word}-${inkColor}`;
    expect(seenConditions.has(condition)).toBe(false);
    seenConditions.add(condition);
    fontSizes.add(fontSize);

    const previousUrl = page.url();
    await page.keyboard.press(String(MARKDOWN_COLORS.indexOf(inkColor) + 1));
    await expect(page.getByRole('radio', { name: new RegExp(`${inkColor}`) })).toBeChecked();
    const previousStimulus = await stimulus.elementHandle();
    await nextClick(page);
    await previousStimulus?.waitForElementState('hidden');
    if (trialIndex < 24) {
      await expect.poll(() => page.url()).not.toBe(previousUrl);
    }
  }

  expect(seenConditions.size).toBe(25);
  expect(fontSizes.size).toBe(1);
  await waitForStudyEndMessage(page);
});

test('completes all 28 HTML Stroop conditions using keyboard shortcuts', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Factor-demos', 'Stroop Test in HTML with Factors');
  await nextClick(page);

  const stimulus = page.frameLocator('#root iframe').locator('#stimuli');
  const seenConditions = new Set<string>();
  for (let trialIndex = 0; trialIndex < 28; trialIndex += 1) {
    await expect(stimulus).toHaveText(new RegExp(HTML_COLORS.join('|')));
    const { word, inkColor } = await stimulus.evaluate((element) => ({
      word: element.textContent?.trim(),
      inkColor: element.style.color.toUpperCase(),
    }));
    expect(HTML_COLORS).toContain(word);
    expect(HTML_COLORS).toContain(inkColor);
    const condition = `${word}-${word === inkColor ? 'neutral' : 'incongruent'}`;
    expect(seenConditions.has(condition)).toBe(false);
    seenConditions.add(condition);

    const previousUrl = page.url();
    await page.keyboard.press(HTML_SHORTCUTS[HTML_COLORS.indexOf(inkColor)]);
    await expect(page.getByRole('radio', { name: new RegExp(`${inkColor}`) })).toBeChecked();
    const previousStimulus = await page.locator('#root iframe').elementHandle();
    await nextClick(page);
    await previousStimulus?.waitForElementState('hidden');
    if (trialIndex < 27) {
      await expect.poll(() => page.url()).not.toBe(previousUrl);
    }
  }

  expect(seenConditions.size).toBe(28);
  await waitForStudyEndMessage(page);
});
