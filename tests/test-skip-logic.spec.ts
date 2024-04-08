import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/test-skip-logic');

  // ***** First participant, all questions are correct *****
  // correct: q1 = Blue, q2 = any
  // given: q1 = Blue, q2 = Cat
  await page.getByLabel('Blue').check();
  await page.getByLabel('Cat').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // continuing component
  await expect(page.getByText('This component exists to show that we didn\'t get skipped over.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // correct: q1 = Blue, q2 = Cat
  // given: q1 = Blue, q2 = Cat
  await page.getByLabel('Blue').check();
  await page.getByLabel('Cat').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // continuing component
  await expect(page.getByText('This component exists to show that we didn\'t get skipped over.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // correct: Yes
  // given: Yes
  await page.getByLabel('Yes').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // correct: q1 = any, q2 = any
  // given: q1 = Blue, q2 = Cat
  await page.getByLabel('Blue').check();
  await page.getByLabel('Cat').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // continuing component
  await expect(page.getByText('This component exists to show that we didn\'t get skipped over.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // Study end
  await expect(page.getByText('Please wait while your answers are uploaded.')).toBeVisible();
  await expect(page.getByText('Thank you for completing the study. You may close this window now.')).toBeVisible();

  // Next participant
  await page.locator('#mantine-r1-target').click();
  await page.getByRole('menuitem', { name: 'Next Participant' }).click();

  // ***** Second participant, last question is incorrect (attention check) *****
  // correct: q1 = Blue, q2 = any
  // given: q1 = Blue, q2 = Cat
  await page.getByLabel('Blue').check();
  await page.getByLabel('Cat').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // continuing component
  await expect(page.getByText('This component exists to show that we didn\'t get skipped over.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // correct: q1 = Blue, q2 = Cat
  // given: q1 = Blue, q2 = Cat
  await page.getByLabel('Blue').check();
  await page.getByLabel('Cat').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // continuing component
  await expect(page.getByText('This component exists to show that we didn\'t get skipped over.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // correct: Yes
  // given: No
  await page.getByLabel('No').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Study end
  await expect(page.getByText('Please wait while your answers are uploaded.')).toBeVisible();
  await expect(page.getByText('Thank you for completing the study. You may close this window now.')).toBeVisible();

  // Next participant
  await page.locator('#mantine-r1-target').click();
  await page.getByRole('menuitem', { name: 'Next Participant' }).click();

  // ***** Third participant, test all responses (1 incorrect triggers skip) *****
  // correct: q1 = Blue, q2 = any
  // given: q1 = Blue, q2 = Cat
  await page.getByLabel('Blue').check();
  await page.getByLabel('Cat').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // continuing component
  await expect(page.getByText('This component exists to show that we didn\'t get skipped over.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // correct: q1 = Blue, q2 = Cat
  // given: q1 = Blue, q2 = Dog
  await page.getByLabel('Blue').check();
  await page.getByLabel('Dog').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Study end
  await expect(page.getByText('Please wait while your answers are uploaded.')).toBeVisible();
  await expect(page.getByText('Thank you for completing the study. You may close this window now.')).toBeVisible();

  // Next participant
  await page.locator('#mantine-r1-target').click();
  await page.getByRole('menuitem', { name: 'Next Participant' }).click();

  // ***** Fourth participant, test all responses (All incorrect triggers skip) *****
  // correct: q1 = Blue, q2 = any
  // given: q1 = Blue, q2 = Cat
  await page.getByLabel('Blue').check();
  await page.getByLabel('Cat').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // continuing component
  await expect(page.getByText('This component exists to show that we didn\'t get skipped over.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // correct: q1 = Blue, q2 = Cat
  // given: q1 = Blue, q2 = Dog
  await page.getByLabel('Red').check();
  await page.getByLabel('Dog').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Study end
  await expect(page.getByText('Please wait while your answers are uploaded.')).toBeVisible();
  await expect(page.getByText('Thank you for completing the study. You may close this window now.')).toBeVisible();

  // Next participant
  await page.locator('#mantine-r1-target').click();
  await page.getByRole('menuitem', { name: 'Next Participant' }).click();

  // ***** Fifth participant, test response incorrect skips *****
  // correct: q1 = Blue, q2 = any
  // given: q1 = Red, q2 = Cat
  await page.getByLabel('Red').check();
  await page.getByLabel('Cat').check();
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Study end
  await expect(page.getByText('Please wait while your answers are uploaded.')).toBeVisible();
  await expect(page.getByText('Thank you for completing the study. You may close this window now.')).toBeVisible();
});
