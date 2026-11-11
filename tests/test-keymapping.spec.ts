import { test, expect } from '@playwright/test';
import { advanceStudyStep, openStudyFromLanding, resetClientStudyState } from './utils';

test('a mapped key auto-advances and the locked answer remains resumable after Previous', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Tests', 'Test Keymapper');

  const leftOption = page.getByRole('radio', { name: /Left \(J\)/ });
  await expect(leftOption).toBeVisible();
  await expect(page.getByTestId('study-interface')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();

  await advanceStudyStep(page, () => page.keyboard.press('j'), page.getByRole('radio', { name: 'A', exact: true }));
  await expect(page.getByRole('radio', { name: 'A', exact: true })).toBeVisible();

  await advanceStudyStep(page, () => page.getByRole('button', { name: 'Previous', exact: true }).click(), leftOption);

  await expect(leftOption).toBeChecked();
  await expect(leftOption).toBeDisabled();
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  await expect(nextButton).toBeVisible();
  await expect(nextButton).toBeEnabled();
  await advanceStudyStep(page, () => nextButton.click(), page.getByRole('radio', { name: 'A', exact: true }));
  await expect(page.getByRole('radio', { name: 'A', exact: true })).toBeVisible();

  await page.getByRole('radio', { name: 'A', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(leftOption).toBeChecked();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'A', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'A', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await advanceStudyStep(page, () => page.getByRole('radio', { name: 'B', exact: true }).click(), page.getByRole('radio', { name: /First \(1\)/ }));
  await expect(page.getByRole('radio', { name: /First \(1\)/ })).toBeVisible();
});

test('mapped ArrowLeft still selects its option when another radio card is focused', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Tests', 'Test Keymapper');

  const firstOption = page.getByRole('radio', { name: /Left \(J\)/ });
  await expect(firstOption).toBeVisible();
  await expect(page.getByTestId('study-interface')).toHaveAttribute('aria-busy', 'false');
  await advanceStudyStep(page, () => page.keyboard.press('j'), page.getByRole('radio', { name: 'A', exact: true }));
  await expect(page.getByText('Change your answer before it advances')).toBeVisible();
  await advanceStudyStep(page, () => page.getByRole('radio', { name: 'A', exact: true }).click(), page.getByText('Required before continuing'));

  await expect(page.getByText('Required before continuing')).toBeVisible();
  await advanceStudyStep(page, async () => {
    await page.getByRole('textbox').fill('ready');
    await page.getByRole('radio', { name: /First \(1\)/ }).click();
  }, page.getByText('What is 7 × 8?'));

  await expect(page.getByText('What is 7 × 8?')).toBeVisible();
  await advanceStudyStep(page, () => page.getByRole('radio', { name: /56/ }).click(), page.getByRole('radio', { name: 'Left', exact: true }));

  const leftOption = page.getByRole('radio', { name: 'Left' });
  const rightOption = page.getByRole('radio', { name: 'Right' });
  await expect(leftOption).toBeVisible();
  await rightOption.focus();
  await page.keyboard.press('ArrowLeft');

  await expect(leftOption).toBeChecked();
  await expect(rightOption).not.toBeChecked();
});
