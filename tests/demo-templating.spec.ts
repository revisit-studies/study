import { test, expect } from '@playwright/test';
import { checkSavedAnswers } from './checkSavedAnswers';
import {
  nextClick,
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('Test Handlebars templating in instructions, path, help text, and response text', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Templating Data with Handlebars');

  await expect(page.getByText(/reVISit's Handlebars templating/i)).toBeVisible();
  await nextClick(page);

  // markdown-template-quiz: France / Europe / hint-europe / no previous answer yet
  await expect(page.getByText('Which city is the capital of France?', { exact: true })).toBeVisible();
  await expect(page.getByText(/Hint for this task:\s*A country in Europe, known for the Eiffel Tower\./)).toBeVisible();
  await expect(page.getByText('Choose the capital of France:', { exact: false })).toBeVisible();
  await page.getByRole('radio', { name: 'Paris' }).check();
  await nextClick(page);

  // html-template-quiz: templated HTML stimulus, previous answer = Paris
  const frame = page.frameLocator('#root iframe');
  await expect(frame.getByRole('heading', { name: '🇨🇦 Canada' })).toBeVisible();
  await expect(frame.getByText('Hint for the task: A country in North America, known for maple syrup.')).toBeVisible();
  await expect(frame.getByText('You answered Paris in your previous task, which is correct.')).toBeVisible();

  // The help table reads the markdown quiz's correctAnswer once it is answered
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByText('On the previous question you answered "Paris".')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('row', { name: /France\s+Paris\s+Paris\s+✅/ })).toBeVisible();
  await page.keyboard.press('Escape');

  await frame.getByRole('button', { name: 'Ottawa' }).click();
  await nextClick(page);

  // summary: absolute answer lookups compared against each component's correctAnswer
  await expect(page.getByRole('row', { name: /France\s+Paris\s+Paris\s+✅/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Canada\s+Ottawa\s+Ottawa\s+✅/ })).toBeVisible();
  await nextClick(page);

  await waitForStudyEndMessage(page);
  await checkSavedAnswers(page, 'demo-templating');
});
