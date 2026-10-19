import { expect, test } from '@playwright/test';

test('uses configured tabs for grouping, keyboard navigation, and study links', async ({ page }) => {
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
  const studyLinks = customPanel.getByRole('link', { name: 'Go to Study', exact: true });
  await expect(studyLinks).toHaveCount(2);
  await expect(studyLinks.nth(0)).toHaveAttribute('href', /\/demo-html(?:\?|$)/);
  await expect(studyLinks.nth(1)).toHaveAttribute('href', /\/tutorial(?:\?|$)/);

  await page.getByRole('tab', { name: 'Studies', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Studies', exact: true })).toContainText('Vega Stimuli Demo');

  await page.goto('/?tab=Empty');
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await customTab.click();
  await studyLinks.first().click();
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
