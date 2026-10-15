import { expect, test, type Page } from '@playwright/test';
import {
  nextClick,
  readParticipantRecording,
  readStoredValue,
  resetClientStudyState,
  seekReplay,
  waitForStudyEndMessage,
} from './utils';

// Inspect only the drawing layer: the interactive layer also paints the cursor.
async function blueInkPixels(page: Page) {
  return page.getByTestId('drawing-canvas').locator('canvas.static').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Drawing canvas has no 2D context');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3] > 0 && data[offset + 2] > data[offset] + 30 && data[offset + 2] > data[offset + 1] + 30) {
        count += 1;
      }
    }
    return count;
  });
}

test('drawing library saves custom controls and gestures and replays the recorded scene', async ({ page }) => {
  await resetClientStudyState(page);
  // This example imports $drawing.components.canvas rather than a local study component.
  await page.goto('/library-drawing');
  await nextClick(page);

  const replayPath = new URL(page.url()).pathname;
  const drawing = page.getByTestId('drawing-canvas');
  await expect(drawing).toBeVisible();
  await expect(drawing.locator('canvas.static')).toBeVisible();
  await expect(drawing.locator('.main-menu-trigger')).toBeHidden();
  await expect(drawing.locator('.FixedSideContainer_side_top')).toBeHidden();

  const next = page.getByRole('button', { name: 'Next', exact: true });
  const undo = page.getByRole('button', { name: 'Undo drawing', exact: true });
  const redo = page.getByRole('button', { name: 'Redo drawing', exact: true });
  const clear = page.getByRole('button', { name: 'Clear all', exact: true });
  await expect(next).toBeDisabled();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  const blue = page.getByRole('button', { name: 'Use blue ink', exact: true });
  await blue.click();
  await expect(blue).toHaveAttribute('aria-pressed', 'true');
  await page.locator('label').filter({ has: page.locator('svg[aria-label="Large"]') }).click();
  await expect(page.getByRole('radio', { name: 'Large', exact: true })).toBeChecked();

  const bounds = await drawing.locator('canvas.interactive').boundingBox();
  if (!bounds) throw new Error('Drawing canvas has no bounds');
  await page.mouse.move(bounds.x + 100, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 240, bounds.y + 160, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await expect(next).toBeEnabled();
  await expect(undo).toBeEnabled();

  await undo.click();
  await expect.poll(() => blueInkPixels(page)).toBe(0);
  await expect(next).toBeDisabled();
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await expect(redo).toBeDisabled();

  await clear.click();
  await expect.poll(() => blueInkPixels(page)).toBe(0);
  await expect(next).toBeDisabled();
  await undo.click();
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await nextClick(page);
  await waitForStudyEndMessage(page);

  await expect.poll(async () => Boolean(await readParticipantRecording(page, 'library-drawing', 'sketch_1'))).toBe(true);
  const recording = await readParticipantRecording(page, 'library-drawing', 'sketch_1');
  if (!recording) throw new Error('No recorded drawing answer found');
  expect(recording.answer.drawing).toMatchObject({
    format: 'excalidraw',
    elements: [expect.objectContaining({
      type: 'freedraw', strokeColor: '#339af0', strokeWidth: 6 / 4.25, isDeleted: false,
    })],
  });

  const provenanceKey = `dev-library-drawing/provenance/${recording.participantId}_sketch_1`;
  await expect.poll(async () => {
    const provenance = await readStoredValue<{ stimulus?: { nodes?: Record<string, { label?: string }> } }>(page, provenanceKey);
    return Object.values(provenance?.stimulus?.nodes ?? {}).map((node) => node.label);
  }).toEqual(expect.arrayContaining(['Change Color', 'Change Pen Size', 'drawEnd', 'undo', 'redo', 'clearing']));

  await page.goto(`${replayPath}?participantId=${recording.participantId}&revisitPageId=e2e-drawing-replay`);
  await expect(drawing).toBeVisible();
  await expect(clear).toBeDisabled();
  await expect(blue).toBeDisabled();
  await seekReplay(page, recording.startTime, recording.endTime, recording.startTime, async () => (
    await blueInkPixels(page) === 0
  ));
  await seekReplay(page, recording.startTime, recording.endTime, recording.endTime, async () => (
    await blueInkPixels(page) > 100
  ));
  await expect(blue).toHaveAttribute('aria-pressed', 'true');
  await expect(drawing.locator('.FixedSideContainer_side_top')).toBeHidden();
});
