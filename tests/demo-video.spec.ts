import { test, expect } from '@playwright/test';
import videoConfig from '../public/demo-video/config.json' with { type: 'json' };
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

for (const componentName of ['missingInternal', 'missingExternal'] as const) {
  test(`${componentName} shows an inline 404 and blocks Next and Enter`, async ({ page }) => {
    await resetClientStudyState(page);
    await page.route('**/demo-video/config.json', (route) => route.fulfill({
      json: {
        ...videoConfig,
        uiConfig: { ...videoConfig.uiConfig, nextOnEnter: true },
        components: {
          ...videoConfig.components,
          // Exercise asset validation independently of playback completion.
          [componentName]: { ...videoConfig.components[componentName], forceCompletion: false },
        },
        sequence: { order: 'fixed', components: [componentName, 'introduction'] },
      },
    }));
    await page.route('**/demo-video/assets/london.mp4', (route) => route.fulfill({ status: 404, body: 'Not found' }));

    await openStudyFromLanding(page, 'Demo Studies', 'Video as a Stimulus');

    const nextButton = page.getByRole('button', { name: 'Next', exact: true });
    const missingAsset = page.getByText(`${videoConfig.components[componentName].path} not found.`, { exact: true });
    await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
    await expect(missingAsset).toBeVisible();
    await expect(nextButton).toBeDisabled();

    const trialUrl = page.url();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(trialUrl);
    await expect(missingAsset).toBeVisible();
    await expect(nextButton).toBeDisabled();
  });
}
