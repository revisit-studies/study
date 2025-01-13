/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('tab', { name: 'Example Studies' }).click();

  // Click on cleveland
  await page.getByLabel('Example Studies').locator('div').filter({ hasText: 'Dynamic React.js Stimuli: A Graphical Perception Experiment' })
    .getByText('Go to Study')
    .click();

  // Check that the page contains the introduction text
  const introText = await page.getByText('Welcome to our study. This is a more complex example to show how to embed React.js');
  await expect(introText).toBeVisible({ timeout: 5000 });

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

  // Check for each practice question
  const questionArray = new Array(4).fill(null).map((val, idx) => idx);
  const visSearchArray = ['circle', 'rect', 'rect', 'path'];
  for (const idx of questionArray) {
    // Check the page contains the practice question
    const questionText = await page.getByText('Task:Two values are marked with dots. What percentage do you believe the smaller');
    await expect(questionText).toBeVisible();

    // Check that the visualization is visible
    const vis = await page.getByRole('main').getByRole('img');
    await expect(vis).toBeVisible();
    const visChildren = await page.locator(visSearchArray[idx]);
    await expect(await visChildren.count()).toBeGreaterThan(0);

    // Fill in answer guess
    await page.getByPlaceholder('0-100').fill('66');

    // Click on the check answer button
    await page.getByRole('button', { name: 'Check Answer' }).click();

    // Check that the correct answer is shown
    const correctAnswer = await page.getByText('You have answered the question correctly.');
    await expect(correctAnswer).toBeVisible();

    // Click on the next button
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }

  // Check that the next question does not have a check answer button
  await expect(await page.getByRole('button', { name: 'Check Answer' })).toBeHidden();

  // Check for each question
  const questionArray2 = new Array(10).fill(null).map((val, idx) => idx);
  const visSearchArray2 = ['circle', 'rect', 'rect', 'path', 'rect', 'circle', 'rect', 'rect', 'path', 'rect'];
  for (const idx of questionArray2) {
    // Check the page contains the question
    const questionText = await page.getByText('Task:Two values are marked with dots. What percentage do you believe the smaller');
    await expect(questionText).toBeVisible();

    // Check that the visualization is visible
    const vis = await page.getByRole('main').getByRole('img');
    await expect(vis).toBeVisible();
    const visChildren = await page.locator(visSearchArray2[idx]);
    await expect(await visChildren.count()).toBeGreaterThan(0);

    // Fill in answer
    await page.getByPlaceholder('0-100').fill('66');

    // Click on the next button
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }

  // Check for the post study survey and fill it out
  await page.getByPlaceholder('Enter your preference').click();
  await page.getByRole('option', { name: 'Bar', exact: true }).click();
  await page.getByPlaceholder('Enter your age here, range from 0 - 100').fill('25');
  await page.getByLabel('5', { exact: true }).check();
  await page.getByPlaceholder('Enter your comments here').fill('Test Test');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check that the end of study text renders
  const endText = await page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
