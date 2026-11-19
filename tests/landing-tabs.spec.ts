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
  const cards = page.getByRole('region', { name: 'Studies', exact: true }).locator('.mantine-Card-root');
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

test('shows configured tabs as sections with side navigation and study buttons', async ({ page }) => {
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
  await page.setViewportSize({ width: 1400, height: 700 });
  await page.goto('/?tab=Studies');

  // Every tab with visible studies is a section, in configured order; empty tabs are skipped.
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Images', customLabel, 'Studies']);
  await expect(page.getByRole('region', { name: 'Images', exact: true })).toContainText('Images as Stimuli');
  await expect(page.getByRole('region', { name: 'Studies', exact: true })).toContainText('Vega Stimuli Demo');
  // A legacy tab link scrolls to that section.
  await expect(page.getByRole('heading', { level: 3, name: 'Studies', exact: true })).toBeInViewport();

  const nav = page.getByRole('navigation', { name: 'Study navigation' });
  await expect(nav.getByRole('link')).toHaveText(['Images', customLabel, 'Studies']);
  await nav.getByRole('link', { name: 'Images', exact: true }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Images', exact: true })).toBeInViewport();
  // The section is recorded as an anchor, so a refresh returns to it.
  await expect(page).toHaveURL(/#images$/);
  await nav.getByRole('link', { name: 'Studies', exact: true }).click();
  await expect(page).toHaveURL(/#studies$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 3, name: 'Studies', exact: true })).toBeInViewport();

  const customSection = page.getByRole('region', { name: customLabel, exact: true });
  await expect(customSection.locator('strong')).toHaveText('selected studies');
  await expect(customSection.getByRole('link', { name: 'study guide', exact: true })).toHaveAttribute('href', 'https://revisit.dev/docs/');
  const studyButtons = customSection.getByRole('button', { name: 'Go to Study', exact: true });
  await expect(studyButtons).toHaveCount(2);
  await studyButtons.nth(1).click();
  await expect(page).toHaveURL(/\/tutorial\//);

  await page.goto('/');
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

  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Studies']);
  const section = page.getByRole('region', { name: 'Studies', exact: true });
  await expect(section.getByText('HTML as a Stimulus', { exact: true })).toBeVisible();
  await expect(section.getByText('A tutorial that you will build with us', { exact: true })).toBeVisible();
  // One section needs no navigation.
  await expect(page.getByRole('navigation', { name: 'Study navigation' })).toHaveCount(0);
});
