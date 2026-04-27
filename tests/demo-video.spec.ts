import { test, expect } from '@playwright/test';
import { nextClick, openStudyFromLanding, resetClientStudyState } from './utils';

test('forceCompletion video enables Next after video end', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Video as a Stimulus');

  await expect(page.getByText(/example study.*video stimulus/i)).toBeVisible();
  await nextClick(page);

  const video = page.locator('video');
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });

  await expect(video).toBeVisible();
  await expect(nextButton).toBeEnabled();
  await nextButton.click();
  await expect(page.getByText(/please finish the video to continue/i)).toBeVisible();

  await video.evaluate((videoNode) => {
    videoNode.dispatchEvent(new Event('ended', { bubbles: true }));
  });

  await expect(nextButton).toBeEnabled();
  await expect(page.getByText(/please finish the video to continue/i)).not.toBeVisible();
});
