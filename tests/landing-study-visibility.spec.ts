import { expect, test } from '@playwright/test';

test('keeps landing visibility and data sharing independent while allowing direct study links', async ({ page }) => {
  await page.route('**/global.json', async (route) => {
    const response = await route.fetch();
    const globalConfig = await response.json();
    await route.fulfill({
      json: {
        ...globalConfig,
        configsList: ['demo-html'],
        configs: { 'demo-html': globalConfig.configs['demo-html'] },
      },
    });
  });

  await page.goto('/demo-html');
  await expect(page.getByText(/example study.*embed html elements/i)).toBeVisible();
  await page.goto('/analysis/stats/demo-html/manage');
  const manageCards = page.getByRole('tabpanel', { name: 'Manage', exact: true }).locator('.mantine-Paper-root');
  await expect(manageCards.first().getByRole('heading', { name: 'ReVISit Modes', exact: true })).toBeVisible({ timeout: 15000 });
  const visibilityCard = manageCards.nth(1);
  await expect(visibilityCard.getByRole('heading', { name: 'Study visibility', exact: true })).toBeVisible();
  await expect(visibilityCard.getByRole('switch')).toHaveCount(1);
  const visibilityDescription = visibilityCard.getByText(/^By default, all available studies are publicly visible/);
  await expect(visibilityDescription).toBeVisible();
  const dataCollectionDescription = manageCards.first().getByText(/^When enabling data collection,/);
  const descriptions = dataCollectionDescription.or(visibilityDescription);
  await expect(descriptions).toHaveCount(2);
  const [dataCollectionStyle, visibilityStyle] = await descriptions.evaluateAll((elements) => elements.map((element) => {
    const { fontSize, color, lineHeight } = window.getComputedStyle(element);
    return { fontSize, color, lineHeight };
  }));
  expect(visibilityStyle).toEqual(dataCollectionStyle);
  const showStudySwitch = visibilityCard.getByLabel('Show study on landing page', { exact: true });
  const sharingSwitch = page.getByLabel('Share Data and Make Analytics Interface Public', { exact: true });
  await expect(showStudySwitch).toBeEnabled();
  await expect(showStudySwitch).toBeChecked();
  await expect(sharingSwitch).toBeChecked();

  const landingCard = page.getByRole('tabpanel', { name: 'Demo Studies', exact: true }).locator('.mantine-Card-root');
  const statusIcons = landingCard.locator('.tabler-icon-database, .tabler-icon-schema, .tabler-icon-schema-off, .tabler-icon-graph, .tabler-icon-graph-off');
  const expectPrivateLandingCard = async () => {
    await expect(landingCard.getByText('HTML as a Stimulus', { exact: true })).toBeVisible();
    await expect(landingCard.getByRole('link', { name: 'Go to Study', exact: true })).toBeVisible();
    await expect(landingCard.getByText(/^Study Status:/)).toBeVisible();
    await expect(landingCard.getByText(/^Activity:/)).toBeVisible();
    await expect(landingCard.getByRole('link', { name: 'Analyze & Manage Study', exact: true })).toHaveCount(0);
    await expect(landingCard.locator('.mantine-Badge-root')).toHaveCount(0);
    await expect(statusIcons).toHaveCount(3);
  };

  await sharingSwitch.press('Space');
  await expect(sharingSwitch).not.toBeChecked();
  await page.goto('/');
  await expectPrivateLandingCard();
  await page.reload();
  await expectPrivateLandingCard();

  await page.goto('/analysis/stats/demo-html/manage');
  await expect(sharingSwitch).not.toBeChecked();
  await expect(showStudySwitch).toBeChecked();
  await showStudySwitch.press('Space');
  await expect(showStudySwitch).not.toBeChecked();
  await expect(showStudySwitch).toBeEnabled();
  await page.reload();
  await expect(showStudySwitch).toBeEnabled();
  await expect(showStudySwitch).not.toBeChecked();
  await expect(sharingSwitch).not.toBeChecked();

  await page.goto('/');
  await page.reload();
  await expect(page.getByText(/No studies found\./)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to Study', exact: true })).toHaveCount(0);
  await page.goto('/demo-html');
  await expect(page.getByText(/example study.*embed html elements/i)).toBeVisible();

  await page.goto('/analysis/stats/demo-html/manage');
  await expect(showStudySwitch).toBeEnabled();
  await expect(showStudySwitch).not.toBeChecked();
  await showStudySwitch.press('Space');
  await expect(showStudySwitch).toBeChecked();
  await expect(showStudySwitch).toBeEnabled();
  await page.reload();
  await expect(showStudySwitch).toBeEnabled();
  await expect(showStudySwitch).toBeChecked();
  await expect(sharingSwitch).not.toBeChecked();

  await page.goto('/');
  await expectPrivateLandingCard();

  await page.goto('/analysis/stats/demo-html/manage');
  await expect(sharingSwitch).not.toBeChecked();
  await sharingSwitch.press('Space');
  await expect(sharingSwitch).toBeChecked();
  await page.reload();
  await expect(sharingSwitch).toBeChecked();
  await page.goto('/');
  await expect(landingCard.getByText(/^Study Status:/)).toBeVisible();
  await expect(landingCard.getByRole('link', { name: 'Analyze & Manage Study', exact: true })).toBeVisible();
  await expect(landingCard.locator('.mantine-Badge-root')).toHaveCount(5);
  await expect(statusIcons).toHaveCount(3);
  await landingCard.getByRole('link', { name: 'Go to Study', exact: true }).click();
  await expect(page.getByText(/example study.*embed html elements/i)).toBeVisible();
});
