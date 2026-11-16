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
  const componentDetails = page.getByRole('button', { name: 'Component details' });
  await expect(componentDetails).toHaveAttribute('aria-expanded', 'true');
  const panelBounds = await page.getByRole('tabpanel', { name: 'Browse Components' }).boundingBox();
  const inspectorBounds = await page.getByTestId('component-inspector').boundingBox();
  expect(panelBounds).not.toBeNull();
  expect(inspectorBounds).not.toBeNull();
  expect(Math.abs((panelBounds!.y + panelBounds!.height) - (inspectorBounds!.y + inspectorBounds!.height))).toBeLessThan(40);

  await componentDetails.click();
  await expect(componentDetails).toHaveAttribute('aria-expanded', 'false');

  await page.getByLabel('Browse Components').locator('a').filter({ hasText: 'introduction' }).click();
  const updatedDetails = page.getByRole('button', { name: 'Component details' });
  await expect(updatedDetails).toHaveAttribute('aria-expanded', 'false');
  await updatedDetails.click();
  await expect(updatedDetails).toHaveAttribute('aria-expanded', 'true');
  const parametersSection = page.getByRole('button', { name: 'Parameters' });
  const responsesSection = page.getByRole('button', { name: 'Responses' });
  const correctAnswerSection = page.getByRole('button', { name: 'Correct Answer' });
  await expect(parametersSection).toHaveAttribute('aria-expanded', 'true');
  await expect(responsesSection).toHaveAttribute('aria-expanded', 'true');
  await expect(correctAnswerSection).toHaveAttribute('aria-expanded', 'true');
  await responsesSection.click();
  await expect(responsesSection).toHaveAttribute('aria-expanded', 'false');
  await responsesSection.click();
  await expect(responsesSection).toHaveAttribute('aria-expanded', 'true');
  const introText = page.getByText(/example study.*embed html elements/i);
  await expect(introText).toBeVisible();

  const participantViewTab = page.getByRole('tab', { name: 'Participant View' });
  await expect(participantViewTab).toBeVisible();
  await participantViewTab.click();

  await page.getByLabel('Participant View').locator('a').filter({ hasText: 'end' }).click();
  await waitForStudyEndMessage(page);
});
