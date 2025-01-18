/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('tab', { name: 'Example Studies' }).click();

  // Click on mvnv study
  await page.getByLabel('Example Studies').locator('div').filter({ hasText: 'MVNV Study Replication' })
    .getByText('Go to Study')
    .click();

  // Check for introduction page
  const introText = await page.getByText('Welcome to our study. This is a more complex example to show how to embed HTML');
  await expect(introText).toBeVisible({ timeout: 5000 });

  // Click on next button
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Check for consent page
  const consentText = await page.getByRole('heading', { name: 'Consent' });
  await expect(consentText).toBeVisible();

  // Fill in consent form
  await page.getByPlaceholder('Please provide your signature').fill('test');
  await page.getByLabel('Accept').check();

  // Click on next button
  await page.getByRole('button', { name: 'Agree' }).click();

  // Check training page
  const trainingText = await page.frameLocator('#root iframe').getByRole('heading', { name: 'Adjacency Matrix Training' });
  await expect(trainingText).toBeVisible();
  const trainingVideo = await page.frameLocator('#root iframe').locator('video');
  await expect(trainingVideo).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < 16; i++) {
    const url = await page.url();
    if (url.includes('end')) {
      break;
    }

    const qText = await page.getByText('Task:Question:');
    await expect(qText).toBeVisible();

    try {
      const checkbox = page.frameLocator('#root iframe').locator('.answerBox rect').nth(0);
      await expect(checkbox).toBeVisible({ timeout: 5000 });
      await checkbox.click();
      // eslint-disable-next-line no-empty
    } catch {
    }

    try {
      const radio = await page.getByLabel('European');
      await expect(radio).toBeVisible({ timeout: 100 });
      await radio.click();
      // eslint-disable-next-line no-empty
    } catch {
    }

    try {
      const radio = await page.getByLabel('Mentions');
      await expect(radio).toBeVisible({ timeout: 100 });
      await radio.click();
      // eslint-disable-next-line no-empty
    } catch {
    }

    try {
      const radio = await page.getByLabel('NA');
      await expect(radio).toBeVisible({ timeout: 100 });
      await radio.click();
      // eslint-disable-next-line no-empty
    } catch {
    }

    try {
      const input = await page.getByPlaceholder('answer text');
      await expect(input).toBeVisible({ timeout: 100 });
      await input.fill('test');
      // eslint-disable-next-line no-empty
    } catch {
    }

    try {
      const input = await page.getByLabel('Enter Findings Below*');
      await expect(input).toBeVisible({ timeout: 100 });
      await input.fill('test');
      // eslint-disable-next-line no-empty
    } catch {
    }

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(100);
  }

  // Check that the thank you message is displayed
  await page.getByText('Please wait while your answers are uploaded.').click();
});
