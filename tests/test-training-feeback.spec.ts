import { test, expect } from '@playwright/test';

async function goToTraining(page) {
  // Check that the page contains the introduction text
  const introText = await page.getByText('Welcome to our study. This is a more complex example to show how to embed React.js');
  await expect(introText).toBeVisible();

  // Click on the next button
  await page.getByRole('button', { name: 'Next', exact: true }).click();

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
  await page.getByRole('button', { name: 'Next', exact: true }).click();
}

test('test', async ({ page }) => {
  await page.goto('/');

  // Click on cleveland
  await page.getByRole('button', { name: 'Dynamic React.js Stimuli: A Graphical Perception Experiment' }).click();

  await goToTraining(page);

  // Answer the training question incorrectly
  await page.getByPlaceholder('0-100').fill('50');
  await page.getByRole('button', { name: 'Check Answer' }).click();
  const incorrectAnswer = await page.getByText('Incorrect Answer');
  await expect(incorrectAnswer).toBeVisible();

  // Answer the training question incorrectly again
  await page.getByPlaceholder('0-100').fill('51');
  await page.getByRole('button', { name: 'Check Answer' }).click();
  const incorrectAnswer2 = await page.getByText('Incorrect Answer');
  await expect(incorrectAnswer2).toBeVisible();

  // Answer the training question incorrectly again
  await page.getByPlaceholder('0-100').fill('52');
  await page.getByRole('button', { name: 'Check Answer' }).click();
  const incorrectAnswer3 = await page.getByText('You\'ve failed to answer this question correctly after 2 attempts. Unfortunately you have not met the criteria for continuing this study.');
  await expect(incorrectAnswer3).toBeVisible();

  // Expect the next button to be disabled
  const nextButton = await page.getByRole('button', { name: 'Next', exact: true });
  await expect(nextButton).toBeDisabled();

  // Answer the training question correctly and expect the next button to be disabled still
  await page.getByPlaceholder('0-100').fill('66');
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await expect(nextButton).toBeDisabled();

  // Click next participant
  await page.getByRole('button', { name: 'Next Participant' }).click();

  await goToTraining(page);

  // Answer the training question correctly and expect the next button to be enabled
  await page.getByPlaceholder('0-100').fill('66');
  await page.getByRole('button', { name: 'Check Answer' }).click();
  await expect(nextButton).toBeEnabled();
});
