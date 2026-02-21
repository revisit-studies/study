import { test, expect } from '@playwright/test';
import { waitForStudyEndMessage } from './utils';

test('test', async ({ page }) => {
  await page.setViewportSize({
    width: 1200,
    height: 800,
  });

  await page.goto('/');

  await page.getByLabel('Demo Studies').locator('div').filter({ hasText: 'HTML as a Stimulus' })
    .nth(0)
    .getByText('Go to Study')
    .click();

  const browseComponentsTab = page.getByRole('tab', { name: 'Browse Components' });
  await expect(browseComponentsTab).toBeVisible();
  await browseComponentsTab.click();

  await page.getByLabel('Browse Components').locator('a').filter({ hasText: 'barChart' }).click();
  const iframe = page.frameLocator('iframe').getByRole('img');
  await expect(iframe).toBeVisible();

  await page.getByLabel('Browse Components').locator('a').filter({ hasText: 'introduction' }).click();
  const introText = page.getByText('Welcome to our study. This is');
  await expect(introText).toBeVisible();

  const participantViewTab = page.getByRole('tab', { name: 'Participant View' });
  await expect(participantViewTab).toBeVisible();
  await participantViewTab.click();

  await page.getByLabel('Participant View').locator('a').filter({ hasText: 'end' }).click();
  await waitForStudyEndMessage(page);
});
