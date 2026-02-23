import { expect, test } from '@playwright/test';
import { resetClientStudyState } from './utils';

test.describe('Test device restriction: display, browsers, devices, input', () => {
  test('shows resolution warning when viewport is below minimum', async ({ page }) => {
    await resetClientStudyState(page);
    await page.setViewportSize({ width: 700, height: 350 });
    await page.goto('/test-device-restriction');

    await expect(page.getByRole('heading', { name: 'Screen Resolution Warning' })).toBeVisible();
    await expect(page.getByText('Your screen resolution is below the minimum requirement:')).toBeVisible();
    await expect(page.getByText('Width: 800px')).toBeVisible();
    await expect(page.getByText('Height: 400px')).toBeVisible();
  });

  test('renders study normally when all rules are satisfied', async ({ page }) => {
    await resetClientStudyState(page);
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/test-device-restriction');

    await expect(page.getByRole('heading', { name: 'Test device restriction' })).toBeVisible();
    await expect(page.getByText(/example study.*embed html elements/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Screen Resolution Warning' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Browser or Device Not Supported' })).not.toBeVisible();
  });

  test('shows browser blocked message for unsupported browser', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    });
    const page = await context.newPage();
    await resetClientStudyState(page);

    await page.goto('/test-device-restriction');

    await expect(page.getByRole('heading', { name: 'Browser or Device Not Supported' })).toBeVisible();
    await expect(page.getByText('You must be on a relatively modern browser, Chrome > 100, Firefox > 100, Safari > 10.')).toBeVisible();

    await context.close();
  });

  test('shows device and input blocked messages for touch mobile setup', async ({ browser, browserName }) => {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ...(browserName !== 'firefox' ? { isMobile: true } : {}),
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();
    await resetClientStudyState(page);

    await page.goto('/test-device-restriction');

    await expect(page.getByRole('heading', { name: 'Browser or Device Not Supported' })).toBeVisible();
    await expect(page.getByText('This study only works on desktop devices.')).toBeVisible();
    await expect(page.getByText('This study only works with mouse input.')).toBeVisible();

    await context.close();
  });
});
