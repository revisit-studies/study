import { expect, test } from '@playwright/test';
import { readStoredValue } from './utils';

test('resumes the saved participant after launching a different study and returning home', async ({ page }) => {
  await page.route('**/global.json', (route) => route.fulfill({
    json: {
      $schema: '',
      configsList: ['demo-html', 'tutorial'],
      configs: {
        'demo-html': { path: 'demo-html/config.json' },
        tutorial: { path: 'tutorial/config.json' },
      },
    },
  }));

  await page.goto('/demo-html');
  await expect(page.getByText(/example study.*embed html elements/i)).toBeVisible();
  const participantId = await readStoredValue<string>(page, 'dev-demo-html/currentParticipantId');
  expect(participantId).toBeTruthy();

  await page.goto('/');
  const cards = page.getByRole('tabpanel', { name: 'Studies', exact: true }).locator('.mantine-Card-root');
  await cards.filter({ hasText: 'A tutorial that you will build with us' }).getByRole('button', { name: 'Go to Study', exact: true }).click();
  await expect(page).toHaveURL(/\/tutorial\//);
  await expect(page.getByTestId('app-aside')).toBeVisible();
  const tutorialParticipantId = await readStoredValue<string>(page, 'dev-tutorial/currentParticipantId');
  expect(tutorialParticipantId).toBeTruthy();
  expect(tutorialParticipantId).not.toBe(participantId);

  await page.goBack();
  await cards.filter({ hasText: 'HTML as a Stimulus' }).getByRole('button', { name: 'Go to Study', exact: true }).click();
  await expect(page.getByText(/example study.*embed html elements/i)).toBeVisible();

  const assignments = await readStoredValue<Record<string, unknown>>(page, 'dev-demo-html/sequenceAssignment');
  expect(Object.keys(assignments ?? {})).toEqual([participantId]);
});

test('uses configured tabs for grouping, keyboard navigation, and study buttons', async ({ page }) => {
  const customLabel = 'Demo Studies';
  const description = 'Browse the **selected studies** or read the [study guide](https://revisit.dev/docs/).';
  await page.route('**/global.json', (route) => route.fulfill({
    json: {
      $schema: '',
      tabs: [
        { label: 'Images' },
        { label: customLabel, description },
        { label: 'Empty' },
      ],
      configsList: ['demo-html', 'tutorial', 'demo-image', 'demo-vega'],
      configs: {
        'demo-html': { path: 'demo-html/config.json', tab: customLabel },
        tutorial: { path: 'tutorial/config.json', tab: customLabel },
        'demo-image': { path: 'demo-image/config.json', tab: 'Images' },
        'demo-vega': { path: 'demo-vega/config.json' },
      },
    },
  }));

  await page.goto('/?tab=Previous%20name');

  const firstTab = page.getByRole('tab', { name: 'Images', exact: true });
  const customTab = page.getByRole('tab', { name: customLabel, exact: true });
  await expect(page.getByRole('tab')).toHaveText(['Images', customLabel, 'Studies']);
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Images', exact: true })).toContainText('Images as Stimuli');

  await firstTab.focus();
  await firstTab.press('ArrowRight');
  await expect(customTab).toBeFocused();
  await expect(customTab).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL((url) => url.searchParams.get('tab') === customLabel);

  await page.reload();
  const customPanel = page.getByRole('tabpanel', { name: customLabel, exact: true });
  await expect(customPanel.locator('strong')).toHaveText('selected studies');
  await expect(customPanel.getByRole('link', { name: 'study guide', exact: true })).toHaveAttribute('href', 'https://revisit.dev/docs/');
  const studyButtons = customPanel.getByRole('button', { name: 'Go to Study', exact: true });
  await expect(studyButtons).toHaveCount(2);
  await studyButtons.nth(1).click();
  await expect(page).toHaveURL(/\/tutorial\//);

  await page.goto('/?tab=Demo%20Studies');

  await page.getByRole('tab', { name: 'Studies', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Studies', exact: true })).toContainText('Vega Stimuli Demo');

  await page.goto('/?tab=Empty');
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await customTab.click();
  await studyButtons.first().click();
  await expect(page).toHaveURL(/\/demo-html\//);
  await expect(page.getByText(/example study.*embed html elements/i)).toBeVisible();
});

test('groups existing configurations without tab settings under Studies', async ({ page }) => {
  await page.route('**/global.json', (route) => route.fulfill({
    json: {
      $schema: '',
      configsList: ['demo-html', 'tutorial'],
      configs: {
        'demo-html': { path: 'demo-html/config.json' },
        tutorial: { path: 'tutorial/config.json' },
      },
    },
  }));

  await page.goto('/?tab=Demos');

  await expect(page.getByRole('tab')).toHaveText(['Studies']);
  await expect(page.getByRole('tab', { name: 'Studies', exact: true })).toHaveAttribute('aria-selected', 'true');
  const panel = page.getByRole('tabpanel', { name: 'Studies', exact: true });
  await expect(panel.getByText('HTML as a Stimulus', { exact: true })).toBeVisible();
  await expect(panel.getByText('A tutorial that you will build with us', { exact: true })).toBeVisible();
});
