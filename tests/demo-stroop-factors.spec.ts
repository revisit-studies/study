/* eslint-disable no-await-in-loop */
import { expect, test } from '@playwright/test';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

const COLOR_KEYS: Record<string, string> = {
  RED: '1',
  ORANGE: '2',
  YELLOW: '3',
  GREEN: '4',
  BLUE: '5',
  PURPLE: '6',
  PINK: '7',
  BROWN: '8',
  GRAY: '9',
  BLACK: '0',
};

test('completes all 90 unique incongruent Stroop trials', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Factor-demos', 'Stroop Test with Factors');

  await expect(page.getByRole('heading', { name: 'Stroop Test with Factors' })).toBeVisible();
  await nextClick(page);

  const stimulus = page.locator('[data-stroop-condition]');
  const seenConditions = new Set<string>();

  for (let trialIndex = 0; trialIndex < 90; trialIndex += 1) {
    await expect(stimulus).toBeVisible();
    const condition = await stimulus.getAttribute('data-stroop-condition');
    const inkColor = await stimulus.getAttribute('data-ink-color');

    expect(inkColor).toBeTruthy();
    if (!condition || !inkColor) {
      throw new Error('The Stroop stimulus did not identify its ink color');
    }
    const [word, conditionInkColor] = condition.split('-');
    expect(word).not.toBe(conditionInkColor);
    expect(conditionInkColor).toBe(inkColor);
    expect(seenConditions.has(condition)).toBe(false);
    seenConditions.add(condition);

    await page.keyboard.press(COLOR_KEYS[inkColor]);

    if (trialIndex < 89) {
      await expect(stimulus).not.toHaveAttribute('data-stroop-condition', condition);
    }
  }

  expect(seenConditions.size).toBe(90);
  await waitForStudyEndMessage(page);
});
