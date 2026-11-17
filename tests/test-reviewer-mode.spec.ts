import { test, expect } from '@playwright/test';
import {
  advanceStudyStep,
  openStudyFromLanding,
  resetClientStudyState,
  waitForStudyEndMessage,
} from './utils';

test('component inspector highlights the active question and stimulus, and supports keyboard controls', async ({ page }) => {
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
  const responseConfig = page.getByTestId('component-inspector').getByText(/html-response/).last();
  const question = page.locator('[data-question-id="html-response"]');
  const stimulus = page.locator('.stimulus#barChart');
  await expect(question).toBeVisible();
  await expect(stimulus).toBeVisible();
  const originalQuestionOutline = await question.evaluate((element) => (element as HTMLElement).style.outline);
  const originalStimulusOutline = await stimulus.evaluate((element) => (element as HTMLElement).style.outline);
  await responseConfig.hover();
  await expect.poll(() => question.evaluate((element) => (element as HTMLElement).style.outline)).toContain('var(--mantine-color-blue-5)');
  await expect.poll(() => stimulus.evaluate((element) => (element as HTMLElement).style.outline)).toContain('var(--mantine-color-blue-5)');
  await page.mouse.move(0, 0);
  await expect.poll(() => question.evaluate((element) => (element as HTMLElement).style.outline)).toBe(originalQuestionOutline);
  await expect.poll(() => stimulus.evaluate((element) => (element as HTMLElement).style.outline)).toBe(originalStimulusOutline);

  const componentDetails = page.getByRole('button', { name: 'Component details' });
  await expect(componentDetails).toHaveAttribute('aria-expanded', 'true');
  const panelBounds = await page.getByRole('tabpanel', { name: 'Browse Components' }).boundingBox();
  const inspectorBounds = await page.getByTestId('component-inspector').boundingBox();
  expect(panelBounds).not.toBeNull();
  expect(inspectorBounds).not.toBeNull();
  expect(Math.abs((panelBounds!.y + panelBounds!.height) - (inspectorBounds!.y + inspectorBounds!.height))).toBeLessThan(40);

  await componentDetails.focus();
  await expect(componentDetails).toBeFocused();
  await componentDetails.press('Enter');
  await expect(componentDetails).toHaveAttribute('aria-expanded', 'false');

  await page.getByLabel('Browse Components').locator('a').filter({ hasText: 'introduction' }).click();
  const updatedDetails = page.getByRole('button', { name: 'Component details' });
  await expect(updatedDetails).toHaveAttribute('aria-expanded', 'false');
  await updatedDetails.focus();
  await updatedDetails.press('Enter');
  await expect(updatedDetails).toHaveAttribute('aria-expanded', 'true');
  const parametersSection = page.getByRole('button', { name: 'Parameters' });
  const responsesSection = page.getByRole('button', { name: 'Responses' });
  const correctAnswerSection = page.getByRole('button', { name: 'Correct Answer' });
  await expect(parametersSection).toHaveAttribute('aria-expanded', 'true');
  await expect(responsesSection).toHaveAttribute('aria-expanded', 'true');
  await expect(correctAnswerSection).toHaveAttribute('aria-expanded', 'true');
  await responsesSection.focus();
  await responsesSection.press('Space');
  await expect(responsesSection).toHaveAttribute('aria-expanded', 'false');
  await responsesSection.press('Space');
  await expect(responsesSection).toHaveAttribute('aria-expanded', 'true');
  const introText = page.getByText(/example study.*embed html elements/i);
  await expect(introText).toBeVisible();

  const participantViewTab = page.getByRole('tab', { name: 'Participant View' });
  await expect(participantViewTab).toBeVisible();
  await participantViewTab.click();

  await page.getByLabel('Participant View').locator('a').filter({ hasText: 'end' }).click();
  await waitForStudyEndMessage(page);
});

test('component inspector and component list scroll independently', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Form Elements Demo');
  await page.getByRole('tab', { name: 'Browse Components' }).click();
  await page.getByLabel('Browse Components').locator('a').filter({ hasText: /^Form Elements$/ }).click();

  const inspector = page.getByTestId('component-inspector');
  await expect(inspector).toBeVisible();
  const list = inspector.locator('xpath=..').locator(':scope > div').first();
  const listBefore = await list.evaluate((element) => (element as HTMLElement).scrollTop);
  await inspector.hover({ position: { x: 30, y: 170 } });
  await page.mouse.wheel(0, 250);
  await expect.poll(() => inspector.evaluate((element) => Array.from(element.querySelectorAll<HTMLElement>('*'))
    .some((child) => child.scrollTop > 0))).toBe(true);
  expect(await list.evaluate((element) => (element as HTMLElement).scrollTop)).toBe(listBefore);

  await list.hover({ position: { x: 30, y: 30 } });
  const inspectorScrollTops = await inspector.evaluate((element) => Array.from(element.querySelectorAll<HTMLElement>('*'))
    .map((child) => child.scrollTop));
  await page.mouse.wheel(0, 250);
  await expect.poll(() => list.evaluate((element) => (element as HTMLElement).scrollTop)).toBeGreaterThan(listBefore);
  expect(await inspector.evaluate((element) => Array.from(element.querySelectorAll<HTMLElement>('*'))
    .map((child) => child.scrollTop))).toEqual(inspectorScrollTops);
});

test('analysis trial inspector is anchored to the bottom of its sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');
  await advanceStudyStep(page);
  const answer = page.locator('input[data-path="html-response"]');
  await expect(answer).toBeVisible();
  await answer.fill('2');
  await advanceStudyStep(page);
  await expect(page.locator('.stimulus#external_website')).toBeVisible();
  await advanceStudyStep(page);
  await waitForStudyEndMessage(page);

  await page.goto('/analysis/stats/demo-html/stats/barChart');
  const inspector = page.getByTestId('component-inspector');
  await expect(inspector).toBeVisible();
  const statsSidebar = inspector.locator('xpath=../..');
  const sidebarBounds = await statsSidebar.boundingBox();
  const inspectorBounds = await inspector.boundingBox();
  expect(sidebarBounds).not.toBeNull();
  expect(inspectorBounds).not.toBeNull();
  expect(Math.abs((sidebarBounds!.y + sidebarBounds!.height) - (inspectorBounds!.y + inspectorBounds!.height))).toBeLessThan(8);
});
