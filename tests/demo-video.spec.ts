import { test, expect } from '@playwright/test';
import videoConfig from '../public/demo-video/config.json' with { type: 'json' };
import { nextClick, openStudyFromLanding, resetClientStudyState } from './utils';

const missingVideos = {
  missingInternal: {
    type: 'video', path: 'demo-video/assets/london.mp4', forceCompletion: true, response: [],
  },
  missingExternal: {
    type: 'video', path: 'https://www.youtube.com/watch', forceCompletion: true, response: [],
  },
} as const;

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
  test(`${componentName} shows an inline 404 and allows continuing`, async ({ page }) => {
    await resetClientStudyState(page);
    await page.route('**/demo-video/config.json', (route) => route.fulfill({
      json: {
        ...videoConfig,
        uiConfig: { ...videoConfig.uiConfig, nextOnEnter: true },
        components: {
          ...videoConfig.components,
          [componentName]: missingVideos[componentName],
        },
        sequence: { order: 'fixed', components: [componentName, 'introduction'] },
      },
    }));
    await page.route('**/demo-video/assets/london.mp4', (route) => route.fulfill({ status: 404, body: 'Not found' }));

    await openStudyFromLanding(page, 'Demo Studies', 'Video as a Stimulus');

    const nextButton = page.getByRole('button', { name: 'Next', exact: true });
    const missingAsset = page.getByText(`${missingVideos[componentName].path} not found.`, { exact: true });
    await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
    await expect(missingAsset).toBeVisible();
    await expect(nextButton).toBeEnabled();
    await expect(page.getByText(/please finish the video to continue/i)).not.toBeVisible();

    await nextButton.click();
    await expect(page.getByText(/example study.*video stimulus/i)).toBeVisible();
  });
}
