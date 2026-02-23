import { test, expect } from '@playwright/test';
import {
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('test', async ({ page }) => {
  await page.setViewportSize({
    width: 1200,
    height: 800,
  });

  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');

  const browseComponentsTab = page.getByRole('tab', { name: 'Browse Components' });
  await expect(browseComponentsTab).toBeVisible();
  await browseComponentsTab.click();

  await page.getByLabel('Browse Components').locator('a').filter({ hasText: 'barChart' }).click();
  const iframe = page.frameLocator('iframe').getByRole('img');
  await expect(iframe).toBeVisible();

  await page.getByLabel('Browse Components').locator('a').filter({ hasText: 'introduction' }).click();
  const introText = page.getByText(/example study.*embed html elements/i);
  await expect(introText).toBeVisible();

  const participantViewTab = page.getByRole('tab', { name: 'Participant View' });
  await expect(participantViewTab).toBeVisible();
  await participantViewTab.click();

  await page.getByLabel('Participant View').locator('a').filter({ hasText: 'end' }).click();
  await waitForStudyEndMessage(page);
});
