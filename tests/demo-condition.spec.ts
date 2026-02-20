/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';

async function answerDropdownTrial(page: import('@playwright/test').Page, instruction: string, answer: string) {
  const questionText = page.getByText(instruction);
  await expect(questionText).toBeVisible({ timeout: 5000 });

  await page.getByPlaceholder('Select an option').click();
  await page.getByRole('option', { name: answer, exact: true }).click();

  await page.getByRole('button', { name: 'Next', exact: true }).click();
}

async function expectStudyComplete(page: import('@playwright/test').Page) {
  const endText = page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible({ timeout: 5000 });

  const uploaded = page.getByText('Thank you for completing the study. You may close this window now.');
  await expect(uploaded).toBeVisible({ timeout: 5000 });
}

test.describe('demo-condition', () => {
  test('cannot switch to another condition after reload when development mode is disabled', async ({ page }) => {
    // Disable development mode so condition changes in the URL do not override persisted participant conditions.
    await page.goto('/analysis/stats/demo-condition/manage');
    await expect(page.getByRole('heading', { name: 'ReVISit Modes' })).toBeVisible({ timeout: 5000 });

    const developmentModeSwitch = page
      .locator('h5:has-text("Development Mode")')
      .locator('xpath=following::input[@role="switch"][1]');
    const developmentModeSwitchControl = page
      .locator('h5:has-text("Development Mode")')
      .locator('xpath=following::label[.//input[@role="switch"]][1]');
    await expect(developmentModeSwitch).toHaveCount(1);
    await expect(developmentModeSwitchControl).toHaveCount(1);
    if (await developmentModeSwitch.isChecked()) {
      await developmentModeSwitchControl.click();
    }
    await expect(developmentModeSwitch).not.toBeChecked();

    // Start the participant in the color condition.
    await page.goto('/demo-condition?condition=color');
    await expect(page.getByText('Welcome to this condition-based demo.')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText(/Which color is the (lightest|darkest)\?/)).toBeVisible({ timeout: 5000 });

    // Change URL condition and reload. Participant should stay on the original condition branch.
    await page.goto('/demo-condition?condition=size');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText(/Which color is the (lightest|darkest)\?/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Which shape is the (largest|smallest)\?/)).not.toBeVisible();
  });

  test('with condition=color, only color trials are shown', async ({ page }) => {
    await page.goto('/demo-condition?condition=color');

    // Introduction should be visible (non-conditional component)
    const introText = page.getByText('Welcome to this condition-based demo.');
    await expect(introText).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Should see color trials (order is random, so check both possibilities)
    // Trial 1
    const colorInstruction1 = page.getByText(/Which color is the (lightest|darkest)\?/);
    await expect(colorInstruction1).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Select an option').click();
    await page.getByRole('option', { name: 'A', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Trial 2
    const colorInstruction2 = page.getByText(/Which color is the (lightest|darkest)\?/);
    await expect(colorInstruction2).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Select an option').click();
    await page.getByRole('option', { name: 'A', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Should go directly to the end (no size or shape trials)
    await expectStudyComplete(page);
  });

  test('with condition=size, only size trials are shown', async ({ page }) => {
    await page.goto('/demo-condition?condition=size');

    // Introduction
    const introText = page.getByText('Welcome to this condition-based demo.');
    await expect(introText).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Should see size trials (order is random, so check both possibilities)
    // Trial 1
    const sizeInstruction1 = page.getByText(/Which shape is the (largest|smallest)\?/);
    await expect(sizeInstruction1).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Select an option').click();
    await page.getByRole('option', { name: 'Square', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Trial 2
    const sizeInstruction2 = page.getByText(/Which shape is the (largest|smallest)\?/);
    await expect(sizeInstruction2).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Select an option').click();
    await page.getByRole('option', { name: 'Square', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Should go directly to the end (no color or shape trials)
    await expectStudyComplete(page);
  });

  test('with condition=shape, only shape trials are shown in fixed order', async ({ page }) => {
    await page.goto('/demo-condition?condition=shape');

    // Introduction
    const introText = page.getByText('Welcome to this condition-based demo.');
    await expect(introText).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Shape block has order: "fixed", so shape-trial-1 comes first
    await answerDropdownTrial(page, 'Which option represents a square?', 'B');
    await answerDropdownTrial(page, 'Which option represents a circle?', 'A');

    // Should go directly to the end (no color or size trials)
    await expectStudyComplete(page);
  });

  test('with condition=color,shape, both color and shape trials are shown', async ({ page }) => {
    await page.goto('/demo-condition?condition=color,shape');

    // Introduction
    const introText = page.getByText('Welcome to this condition-based demo.');
    await expect(introText).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Color trials (random order)
    const colorInstruction1 = page.getByText(/Which color is the (lightest|darkest)\?/);
    await expect(colorInstruction1).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Select an option').click();
    await page.getByRole('option', { name: 'A', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    const colorInstruction2 = page.getByText(/Which color is the (lightest|darkest)\?/);
    await expect(colorInstruction2).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Select an option').click();
    await page.getByRole('option', { name: 'A', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Shape trials (fixed order) — no size trials should appear
    await answerDropdownTrial(page, 'Which option represents a square?', 'B');
    await answerDropdownTrial(page, 'Which option represents a circle?', 'A');

    // Should go to end (no size trials)
    await expectStudyComplete(page);
  });

  test('with no condition, all trials from all conditions are shown', async ({ page }) => {
    await page.goto('/demo-condition');

    // Introduction
    const introText = page.getByText('Welcome to this condition-based demo.');
    await expect(introText).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Color trials (2 trials, random order)
    for (let i = 0; i < 2; i += 1) {
      const colorInstruction = page.getByText(/Which color is the (lightest|darkest)\?/);
      await expect(colorInstruction).toBeVisible({ timeout: 5000 });
      await page.getByPlaceholder('Select an option').click();
      await page.getByRole('option', { name: 'A', exact: true }).click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }

    // Size trials (2 trials, random order)
    for (let i = 0; i < 2; i += 1) {
      const sizeInstruction = page.getByText(/Which shape is the (largest|smallest)\?/);
      await expect(sizeInstruction).toBeVisible({ timeout: 5000 });
      await page.getByPlaceholder('Select an option').click();
      await page.getByRole('option', { name: 'Square', exact: true }).click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }

    // Shape trials (2 trials, fixed order)
    await answerDropdownTrial(page, 'Which option represents a square?', 'B');
    await answerDropdownTrial(page, 'Which option represents a circle?', 'A');

    await expectStudyComplete(page);
  });

  test('condition selector on landing page shows condition badges', async ({ page }) => {
    await page.goto('/');

    // Find the Conditional Blocks Demo card
    const card = page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'Conditional Blocks Demo' });
    await expect(card.first()).toBeVisible({ timeout: 5000 });

    // Condition badges should be visible
    const colorBadge = card.getByText('color', { exact: true }).first();
    await expect(colorBadge).toBeVisible();

    const sizeBadge = card.getByText('size', { exact: true }).first();
    await expect(sizeBadge).toBeVisible();

    const shapeBadge = card.getByText('shape', { exact: true }).first();
    await expect(shapeBadge).toBeVisible();
  });
});
