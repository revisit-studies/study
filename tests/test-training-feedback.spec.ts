import { test, expect, Page } from '@playwright/test';
import { nextClick } from './utils';

async function goToTraining(page: Page) {
  await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();

  // Click on the next button
  await nextClick(page);

  // Check the page contains consent form
  const consent = await page.getByRole('heading', { name: 'Consent' });
  await expect(consent).toBeVisible();

  // Fill the consent form
  await page.getByPlaceholder('Please provide your signature').click();
  await page.getByPlaceholder('Please provide your signature').fill('test');
  await page.getByLabel('Accept').check();

  // Click on the next button
  await page.getByRole('button', { name: 'Agree' }).click();

  // Check the page contains the training image
  const trainingImg = await page.getByRole('main').getByRole('img');
  await expect(trainingImg).toBeVisible();

  // Click on the next button
  await nextClick(page);
}

async function answerTrainingTrialCorrectly(page: Page) {
  await page.getByPlaceholder('0-100').fill('66');
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await expect(page.getByText('You have answered the question correctly.')).toBeVisible();
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  await expect(nextButton).toBeEnabled();
  await nextClick(page);
}

test('test', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Example Studies' }).click();

  // Click on cleveland
  await page.getByLabel('Example Studies').locator('div').filter({ hasText: 'Dynamic React.js Stimuli: A Graphical Perception Experiment' })
    .getByText('Go to Study')
    .click();

  await goToTraining(page);

  // Answer the training question incorrectly
  await page.getByPlaceholder('0-100').fill('50');
  await page.getByRole('button', { name: 'Check Answer' }).click();
  const incorrectAnswer = await page.getByText('Incorrect Answer');
  await expect(incorrectAnswer).toBeVisible();

  // Answer the training question incorrectly again
  await page.getByPlaceholder('0-100').fill('52');
  await page.getByRole('button', { name: 'Check Answer' }).click();
  const incorrectAnswer3 = await page.getByText('You didn\'t answer this question correctly after 2 attempts. Unfortunately you have not met the criteria for continuing this study.');
  await expect(incorrectAnswer3).toBeVisible();

  // Expect the next button to be disabled
  const nextButton = await page.getByRole('button', { name: 'Next', exact: true });
  await expect(nextButton).toBeDisabled();

  // Expect the input to be disabled
  await expect(await page.getByPlaceholder('0-100')).toBeDisabled();

  // Click next participant
  await page.getByRole('button', { name: 'Next Participant' }).click();

  await goToTraining(page);

  // Answer all four training trials correctly and ensure we progress past training.
  await answerTrainingTrialCorrectly(page);
  await answerTrainingTrialCorrectly(page);
  await answerTrainingTrialCorrectly(page);
  await answerTrainingTrialCorrectly(page);

  // First non-training trial should not require Check Answer.
  await expect(page.getByPlaceholder('0-100')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check Answer' })).toBeHidden();
});
