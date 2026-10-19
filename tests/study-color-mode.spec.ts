import { expect, test } from '@playwright/test';
import { nextClick } from './utils';

for (const mode of ['light', 'dark'] as const) {
  test(`study ${mode} controls the logo and HTML, with per-stimulus overrides`, async ({ page }) => {
    const opposite = mode === 'light' ? 'dark' : 'light';
    await page.emulateMedia({ colorScheme: opposite });
    await page.route('**/demo-html/config.json', async (route) => {
      const response = await route.fetch();
      const config = await response.json();
      // Omit the setting for light to exercise the study default.
      config.uiConfig.colorMode = mode === 'dark' ? mode : undefined;
      config.components = {
        inherited: { type: 'website', path: 'demo-html/assets/theme.html', response: [] },
        overridden: {
          type: 'website', path: 'demo-html/assets/theme.html', colorMode: opposite, response: [],
        },
        templated: {
          type: 'website', path: 'demo-html/assets/theme.html', templated: true, colorMode: opposite, response: [],
        },
      };
      config.sequence = { order: 'fixed', components: ['inherited', 'overridden', 'templated'] };
      await route.fulfill({ response, json: config });
    });
    await page.route('**/demo-html/assets/theme.html*', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><head><style>:root { color-scheme: light dark; } body { background: light-dark(white, rgb(36, 36, 36)); }</style></head><body><input aria-label="Stimulus answer"></body></html>',
    }));
    await page.goto('/demo-html');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', mode);

    // Check actual SVG pixels; a correct parent CSS value alone misses Safari's bug.
    const logo = page.getByRole('img', { name: 'Study Logo', exact: true });
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((element: HTMLImageElement) => {
      if (!element.complete || !element.naturalWidth) return undefined;
      const canvas = document.createElement('canvas');
      canvas.width = element.naturalWidth;
      canvas.height = element.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(element, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let black = 0;
      let white = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] >= 250) {
          if (data[index] < 10 && data[index + 1] < 10 && data[index + 2] < 10) black += 1;
          if (data[index] > 245 && data[index + 1] > 245 && data[index + 2] > 245) white += 1;
        }
      }
      return white > black ? 'dark' : 'light';
    })).toBe(mode);

    const frame = page.frameLocator('#root iframe');
    await expect(frame.locator('body')).toHaveCSS('background-color', mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(36, 36, 36)');
    await frame.getByRole('textbox', { name: 'Stimulus answer' }).fill('preserve me');
    await page.emulateMedia({ colorScheme: mode });
    await expect(frame.getByRole('textbox')).toHaveValue('preserve me');
    await page.emulateMedia({ colorScheme: opposite });
    await expect(frame.locator('body')).toHaveCSS('background-color', mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(36, 36, 36)');

    await nextClick(page);
    await expect(frame.locator('body')).toHaveCSS('background-color', opposite === 'light' ? 'rgb(255, 255, 255)' : 'rgb(36, 36, 36)');
    await nextClick(page);
    await expect(page.locator('#root iframe')).toHaveAttribute('srcdoc', /Stimulus answer/);
    await expect(frame.locator('body')).toHaveCSS('background-color', opposite === 'light' ? 'rgb(255, 255, 255)' : 'rgb(36, 36, 36)');
  });
}

test('HTML stays hidden until its study color scheme is applied after slow resources load', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/demo-html/config.json', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.uiConfig.colorMode = 'light';
    config.components = {
      loading: { type: 'website', path: 'demo-html/assets/slow-theme.html', response: [] },
    };
    config.sequence = { order: 'fixed', components: ['loading'] };
    await route.fulfill({ response, json: config });
  });
  await page.route('**/demo-html/assets/slow-theme.html*', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><style>:root { color-scheme: light dark; } body { background: light-dark(white, rgb(36, 36, 36)); }</style></head><body><p>Slow stimulus</p><img src="delayed-image.png" alt="Delayed resource"></body></html>',
  }));
  let releaseImage = () => { };
  const imageReleased = new Promise<void>((resolve) => { releaseImage = resolve; });
  await page.route('**/demo-html/assets/delayed-image.png', async (route) => {
    await imageReleased;
    await route.fulfill({ status: 404, body: '' });
  });

  await page.goto('/demo-html', { waitUntil: 'domcontentloaded' });
  const iframe = page.locator('#root iframe');
  const frame = page.frameLocator('#root iframe');
  try {
    // The child document is usable while its resource still prevents window.load.
    await expect(frame.getByText('Slow stimulus', { exact: true })).toBeAttached();
    await expect.poll(() => frame.locator('html').evaluate(() => document.readyState)).toBe('interactive');
    await expect(iframe).toBeHidden();
  } finally {
    releaseImage();
  }
  await expect(iframe).toBeVisible();
  await expect(frame.locator('html')).toHaveCSS('color-scheme', 'light');
  await expect(frame.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
