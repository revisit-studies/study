import { expect, test } from '@playwright/test';

test('test', async ({ page, browserName }) => {
  await page.goto('/demo-video');

  const nextParticipantButton = page.getByRole('button', { name: 'Next Participant' });
  if (await nextParticipantButton.isVisible()) {
    await nextParticipantButton.click();
  }

  await expect(page.getByText('Welcome to our study. This is an example study to show how to use the video stimulus.')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Video as a Stimulus' })).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();

  const video = page.locator('.video#internal video').first();
  const playButton = page.locator('.video#internal button[data-plyr="play"]').first();
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });

  await expect(video).toBeVisible();
  await expect(playButton).toBeVisible();

  // Test video force completion
  await expect(nextButton).toBeDisabled();

  // Internal video fails to play in Chromium but works fine in Firefox and WebKit
  if (browserName === 'chromium') {
    const missingInternalLabel = page.locator('p:has-text("missingInternal")').first();
    await expect(missingInternalLabel).toBeVisible();
    await missingInternalLabel.click();
  } else {
    // Wait for video to load and play for a few seconds to enable the next button
    await playButton.click();
    await page.waitForTimeout(7000);

    await expect(nextButton).toBeEnabled({ timeout: 20000 });
    await nextButton.click();
  }

  await expect(page.getByText('404')).toBeVisible();
  await expect(page.getByText('demo-video/assets/london.mp4')).toBeVisible();
  await expect(page.getByText('not found.')).toBeVisible();
  await expect(page.getByText('If you\'re trying to access your study please check the URL and verify that the global config file is correctly configured. Then try again.')).toBeVisible();
  await expect(nextButton).toBeDisabled();

  const externalLabel = page.locator('p:has-text("external")').first();
  await expect(externalLabel).toBeVisible();
  await externalLabel.click();
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(page.getByText('404')).toBeVisible();
  await expect(page.getByText('https://www.youtube.com/watch')).toBeVisible();
  await expect(page.getByText('not found.')).toBeVisible();
  await expect(page.getByText('If you\'re trying to access your study please check the URL and verify that the global config file is correctly configured. Then try again.')).toBeVisible();
  await expect(nextButton).toBeDisabled();

  const endLabel = page.locator('p:has-text("end")').first();
  await expect(endLabel).toBeVisible();
  await endLabel.click();

  const endText = page.getByText('Please wait while your answers are uploaded.');
  await expect(endText).toBeVisible();
});
