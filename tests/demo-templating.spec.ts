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

  await expect(page.getByText(/Handlebars templating feature/i)).toBeVisible();
  await nextClick(page);

  // quiz-1: France / Europe / hint-europe / direct hint / no previous answer yet
  await expect(page.getByText('Which city is the capital of France, in Europe?', { exact: true })).toBeVisible();
  await expect(page.getByText(/Hint:\s*France is well known for the Eiffel Tower\./)).toBeVisible();
  await expect(page.getByText(/probably guess it from that alone/i)).toBeVisible();
  await expect(page.getByText('Enter the capital of France:', { exact: false })).toBeVisible();

  const answerInput = page.getByRole('textbox');
  await answerInput.fill('Paris');
  await nextClick(page);

  // quiz-2: Germany / Europe / hint-europe / misleading hint / previous answer = Paris
  await expect(page.getByText('Which city is the capital of Germany, in Europe? (Last time, you answered "Paris".)', { exact: true })).toBeVisible();
  await expect(page.getByText(/Hint:\s*Germany is well known for Oktoberfest\./)).toBeVisible();
  await expect(page.getByText(/might make you think of a different, more famous city/i)).toBeVisible();
  await expect(page.getByText('Nice — you answered "Paris" (the capital of France) on the previous trial!')).toBeVisible();
  await expect(page.getByText('Enter the capital of Germany: (You said Paris last time — nice!)', { exact: false })).toBeVisible();

  await answerInput.fill('Berlin');
  await nextClick(page);

  // quiz-3: Japan / Asia / hint-asia / misleading hint
  await expect(page.getByText('Which city is the capital of Japan, in Asia? (Last time, you answered "Berlin".)', { exact: true })).toBeVisible();
  await expect(page.getByText(/Hint:\s*Japan is well known for cherry blossom season\./)).toBeVisible();
  await answerInput.fill('Tokyo');
  await nextClick(page);

  // quiz-4: India / Asia / hint-asia / obscure hint / previous answer = Tokyo
  await expect(page.getByText('Which city is the capital of India, in Asia? (Last time, you answered "Tokyo".)', { exact: true })).toBeVisible();
  await expect(page.getByText(/Hint:\s*India is well known for its colorful festivals\./)).toBeVisible();
  await expect(page.getByText(/isn't the country's most famous city/i)).toBeVisible();
  await expect(page.getByText('Nice — you answered "Tokyo" (the capital of Japan) on the previous trial!')).toBeVisible();
  await answerInput.fill('New Delhi');
  await nextClick(page);

  // quiz-5: Brazil / Americas / hint-americas / obscure hint
  await expect(page.getByText('Which city is the capital of Brazil, in Americas? (Last time, you answered "New Delhi".)', { exact: true })).toBeVisible();
  await expect(page.getByText(/Hint:\s*Brazil is well known for the Amazon rainforest\./)).toBeVisible();
  await answerInput.fill('Brasilia');
  await nextClick(page);

  // quiz-6: Canada / Americas / hint-americas / obscure hint / previous answer = Brasilia
  await expect(page.getByText('Which city is the capital of Canada, in Americas? (Last time, you answered "Brasilia".)', { exact: true })).toBeVisible();
  await expect(page.getByText(/Hint:\s*Canada is well known for maple syrup\./)).toBeVisible();
  await expect(page.getByText('Nice — you answered "Brasília" (the capital of Brazil) on the previous trial!')).toBeVisible();

  // Open the per-trial help modal (quizQuestion base component's own helpTextPath)
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByText("You're answering about", { exact: false })).toBeVisible();
  await expect(page.getByText('On the previous question you answered "Brasilia".')).toBeVisible();
  await page.keyboard.press('Escape');

  await answerInput.fill('Ottawa');
  await nextClick(page);

  await waitForStudyEndMessage(page);
  await checkSavedAnswers(page, 'demo-templating');
});
