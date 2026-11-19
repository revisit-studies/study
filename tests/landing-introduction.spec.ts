import { expect, test } from '@playwright/test';

const introductionMarkdown = '# About these studies\n\nThese studies explore **chart reading**. See the [guide](https://revisit.dev/docs/).';

test('shows the configured introduction on the left and compact study cards on the right', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.route('**/global.json', (route) => route.fulfill({
    json: {
      $schema: '',
      introductionPath: 'landing-introduction-test.md',
      configsList: ['demo-html', 'tutorial'],
      configs: {
        'demo-html': { path: 'demo-html/config.json' },
        tutorial: { path: 'tutorial/config.json' },
      },
    },
  }));
  await page.route('**/landing-introduction-test.md', (route) => route.fulfill({
    contentType: 'text/markdown',
    body: introductionMarkdown,
  }));

  await page.goto('/');

  const introduction = page.getByRole('region', { name: 'Introduction' });
  await expect(introduction.getByRole('heading', { name: 'About these studies' })).toBeVisible();
  await expect(introduction.getByText('chart reading')).toBeVisible();
  await expect(introduction.getByRole('link', { name: 'guide' })).toHaveAttribute('href', 'https://revisit.dev/docs/');

  const cards = page.getByRole('tabpanel', { name: 'Studies', exact: true }).locator('.mantine-Card-root');
  await expect(cards).toHaveCount(2);
  const htmlCard = cards.filter({ hasText: 'HTML as a Stimulus' });
  const tutorialCard = cards.filter({ hasText: 'A tutorial that you will build with us' });
  await expect(htmlCard.getByRole('button', { name: 'Go to Study', exact: true })).toBeVisible();
  await expect(tutorialCard.getByRole('button', { name: 'Go to Study', exact: true })).toBeVisible();

  // The introduction sits to the left of the studies, and the cards share a row.
  const introBox = await introduction.boundingBox();
  const htmlBox = await htmlCard.boundingBox();
  const tutorialBox = await tutorialCard.boundingBox();
  expect(introBox && htmlBox && tutorialBox).toBeTruthy();
  expect(introBox!.x + introBox!.width).toBeLessThanOrEqual(Math.min(htmlBox!.x, tutorialBox!.x));
  expect(Math.abs(htmlBox!.y - tutorialBox!.y)).toBeLessThan(1);

  await htmlCard.getByRole('button', { name: 'Go to Study', exact: true }).click();
  await expect(page.getByText(/example study.*embed html elements/i)).toBeVisible();
});

test('keeps the studies-only layout when no introduction is configured', async ({ page }) => {
  await page.route('**/global.json', (route) => route.fulfill({
    json: {
      $schema: '',
      configsList: ['demo-html'],
      configs: { 'demo-html': { path: 'demo-html/config.json' } },
    },
  }));

  await page.goto('/');

  const cards = page.getByRole('tabpanel', { name: 'Studies', exact: true }).locator('.mantine-Card-root');
  await expect(cards.filter({ hasText: 'HTML as a Stimulus' }).getByRole('button', { name: 'Go to Study', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Introduction' })).toHaveCount(0);
});
