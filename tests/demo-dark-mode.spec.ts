/* eslint-disable no-await-in-loop */
import {
  expect, test, type Locator, type Page,
} from '@playwright/test';
import darkDemo from '../public/demo-dark-mode/config.json' with { type: 'json' };
import drawingLibrary from '../public/libraries/drawing/config.json' with { type: 'json' };
import studySchema from '../src/parser/StudyConfigSchema.json' with { type: 'json' };
import { nextClick, readParticipantRecording, waitForStudyEndMessage } from './utils';

type Schema = { $ref?: string; anyOf?: Schema[]; properties?: { type?: { const?: string; enum?: string[] } } };
const definitions = studySchema.definitions as Record<string, Schema>;
function schemaTypes(schema: Schema): string[] {
  if (schema.$ref) return schemaTypes(definitions[schema.$ref.split('/').pop()!]);
  if (schema.anyOf) return schema.anyOf.flatMap(schemaTypes);
  return schema.properties?.type?.const ? [schema.properties.type.const] : schema.properties?.type?.enum ?? [];
}

test('dark demo includes every configured stimulus and response type', () => {
  const components = Object.values(darkDemo.components).map((component) => {
    const local = component as { type?: string; baseComponent?: string; response?: { type: string }[] };
    return local.baseComponent === '$drawing.components.canvas'
      ? { ...drawingLibrary.components.canvas, ...local }
      : local;
  });
  expect([...new Set(components.map(({ type }) => type))].sort())
    .toEqual([...new Set(schemaTypes(definitions.IndividualComponent))].sort());
  expect([...new Set(components.flatMap(({ response }) => response?.map(({ type }) => type) ?? []))].sort())
    .toEqual([...new Set(schemaTypes(definitions.Response))].sort());
  expect(new Set(darkDemo.sequence.components)).toEqual(new Set(Object.keys(darkDemo.components)));
});

async function expectDarkSurface(element: Locator) {
  await expect(element).toBeVisible();
  const colors = await element.evaluate((node) => {
    const style = getComputedStyle(node);
    let ancestor: Element | null = node;
    let background = style.backgroundColor;
    while ((background === 'transparent' || background.endsWith(', 0)')) && ancestor?.parentElement) {
      ancestor = ancestor.parentElement;
      background = getComputedStyle(ancestor).backgroundColor;
    }
    if (background === 'transparent' || background.endsWith(', 0)')) throw new Error('No opaque control surface');
    return [background, style.color].map((value) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? []);
  });
  expect(colors[0]).toHaveLength(3);
  expect(Math.max(...colors[0])).toBeLessThan(128);
  expect(Math.min(...colors[1])).toBeGreaterThan(128);
}

async function dragRanking(page: Page, id: string, label: string, zone = 'HIGH') {
  const response = page.locator(`#${id}`);
  const available = response.locator('.mantine-Paper-root').filter({
    has: page.getByText('Available Items', { exact: true }),
  }).last();
  const source = available.getByRole('button', { name: label, exact: true });
  const high = response.getByText(zone, { exact: true }).first();
  const target = high.locator('..');
  await expectDarkSurface(available);
  // Center the source so dnd-kit's edge auto-scroll cannot move the drop target.
  await source.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(target).toBeInViewport();
  let previousBounds = '';
  await expect.poll(async () => {
    const currentBounds = JSON.stringify([await source.boundingBox(), await target.boundingBox()]);
    const stable = currentBounds === previousBounds;
    previousBounds = currentBounds;
    return stable;
  }).toBe(true);
  const start = await source.boundingBox();
  const end = await target.boundingBox();
  if (!start || !end) throw new Error('Ranking drag target is missing');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2 + 10);
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(target.getByText(label, { exact: true })).toBeVisible();
  await expect(response.locator('.ranking-drag-overlay')).toHaveCount(0);
}

test('all dark demo controls render and respond under a light system preference', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/demo-dark-mode');
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
  await expectDarkSurface(page.locator('body'));
  await nextClick(page);

  const email = page.locator('#validation-email input');
  await expectDarkSurface(email);
  await email.fill('demo@revisit.dev');
  const sidebar = page.locator('.sidebar #sidebar-note input');
  await expectDarkSurface(sidebar);
  await sidebar.fill('Sidebar is readable');
  await page.locator('#comments textarea').fill('Readable in dark mode');
  await page.locator('#numerical input[data-path="numerical"]').fill('42');
  await page.locator('#date input[data-dates-input]').fill('10/19/2026');
  const time = page.locator('#time input:not([type="hidden"])');
  await time.nth(0).fill('15');
  await time.nth(1).fill('45');
  await expect(page.locator('#divider')).toBeVisible();
  await expect(email).toHaveValue('demo@revisit.dev');
  await expect(page.locator('#numerical input[data-path="numerical"]')).toHaveValue('42');
  await expect(page.locator('#date input[data-dates-input]')).toHaveValue('10/19/2026');
  await expect(time.nth(0)).toHaveValue('15');
  await expect(time.nth(1)).toHaveValue('45');
  for (const input of [page.locator('#comments textarea'), page.locator('#numerical input[data-path="numerical"]'), page.locator('#date input[data-dates-input]'), time.nth(0)]) {
    await expectDarkSurface(input);
  }
  await page.screenshot({ path: testInfo.outputPath('form-elements.png'), fullPage: true });
  await nextClick(page);
  await expect.poll(async () => (await readParticipantRecording(page, 'demo-dark-mode', 'Form Elements_1'))?.answer)
    .toMatchObject({
      'validation-email': 'demo@revisit.dev', numerical: 42, comments: 'Readable in dark mode', 'sidebar-note': 'Sidebar is readable',
    });

  for (const id of ['multiple-charts', 'single-dropdown']) {
    const dropdown = page.locator(`#${id}`).getByRole('combobox');
    await expectDarkSurface(dropdown);
    if (id === 'multiple-charts') await page.locator(`#${id} .mantine-MultiSelect-input`).click();
    else await dropdown.click();
    const option = page.getByRole('option', { name: 'Bar chart', exact: true });
    await expect(option).toBeVisible();
    await expectDarkSurface(option);
    await option.click();
    await page.keyboard.press('Escape');
  }
  for (const id of ['checkbox', 'matrix-checkbox']) {
    const checkbox = page.locator(`#${id}`).getByRole('checkbox').first();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  }
  for (const id of ['radio', 'likert', 'buttons', 'matrix-radio']) {
    const radio = page.locator(`#${id}`).getByRole('radio').first();
    await radio.check();
    await expect(radio).toBeChecked();
  }
  const slider = page.locator('#readability').getByRole('slider');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).not.toHaveAttribute('aria-valuenow', '50');
  await page.screenshot({ path: testInfo.outputPath('choices-and-scales.png'), fullPage: true });
  await nextClick(page);
  await expect.poll(async () => (await readParticipantRecording(page, 'demo-dark-mode', 'Choices and Scales_2'))?.answer)
    .toMatchObject({ 'single-dropdown': 'Bar chart', radio: 'Horizontal' });

  await dragRanking(page, 'ranking-sublist', 'Bar');
  await dragRanking(page, 'ranking-categorical', 'Area');
  await dragRanking(page, 'ranking-pairwise', 'Histogram');
  await dragRanking(page, 'ranking-pairwise', 'Boxplot', 'LOW');
  await page.screenshot({ path: testInfo.outputPath('ranking-widgets.png'), fullPage: true });
  await nextClick(page);
  await page.getByRole('button', { name: 'Bar', exact: true }).click();
  await expectDarkSurface(page.getByLabel('Confidence', { exact: true }));
  await page.getByLabel('Confidence', { exact: true }).fill('80');
  await page.getByLabel('Rationale', { exact: true }).fill('Clear category comparison');
  await expect(page.getByText('"chartType":"Bar"', { exact: false })).toBeVisible();
  await nextClick(page);
  await expect.poll(async () => (await readParticipantRecording(page, 'demo-dark-mode', 'Custom Response_4'))?.answer)
    .toMatchObject({ 'custom-response-demo': { chartType: 'Bar', confidence: 80, rationale: 'Clear category comparison' } });

  const chart = page.locator('.vega-embed');
  await expect(chart).toBeVisible();
  const chartBounds = await chart.boundingBox();
  if (!chartBounds) throw new Error('Vega chart is missing');
  await chart.click({ position: { x: 45, y: 180 } });
  await expect(page.locator('#vegaDemoResponse1')).toContainText('A');
  await nextClick(page);

  const drawing = page.getByTestId('drawing-canvas');
  await expect(drawing).toBeVisible();
  await page.getByRole('button', { name: 'Use blue ink', exact: true }).click();
  const canvas = drawing.locator('canvas.interactive');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Drawing canvas is missing');
  await page.mouse.move(bounds.x + 80, bounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 200, bounds.y + 120, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo drawing', exact: true })).toBeEnabled();
  await expectDarkSurface(page.locator('.revisit-drawing'));
  await nextClick(page);

  const image = page.locator('.stimulus img');
  await expect(image).toBeVisible();
  expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  await nextClick(page);
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(1);
  await video.evaluate((node: HTMLVideoElement) => { node.muted = true; });
  await page.getByRole('button', { name: 'Play', exact: true }).first().click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await nextClick(page);

  for (const mode of ['dark', 'light']) {
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
    const frame = page.frameLocator('#root iframe');
    await expect(frame.locator('html')).toHaveCSS('color-scheme', mode);
    await expect(frame.locator('body')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(36, 36, 36)' : 'rgb(255, 255, 255)');
    await frame.getByRole('button', { name: 'Toggle details' }).click();
    await expect(frame.getByText('The HTML stimulus keeps its own interaction state.')).toBeVisible();
    await nextClick(page);
  }
  await waitForStudyEndMessage(page);
});
