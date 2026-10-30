import { expect, test, type Page } from '@playwright/test';
import drawingConfig from '../public/libraries/drawing/config.json' with { type: 'json' };
import drawingStudy from '../public/library-drawing/config.json' with { type: 'json' };
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

async function drawStroke(page: Page) {
  const canvas = page.getByTestId('drawing-canvas').locator('canvas.interactive');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Drawing canvas has no bounds');
  await page.mouse.move(bounds.x + 100, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 240, bounds.y + 160, { steps: 12 });
  await page.mouse.up();
}

async function expectEmptyDrawingBlocksNext(page: Page) {
  const trialUrl = page.url();
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByText('Please complete the stimulus interaction to continue.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(trialUrl);
  await expect(page.getByTestId('drawing-canvas')).toBeVisible();
}

async function expectCanvasFillsStudyArea(page: Page) {
  const surface = page.locator('.revisit-drawing-surface');
  await expect(surface).toHaveCSS('border-width', '0px');
  await expect.poll(async () => {
    const canvasBounds = await surface.boundingBox();
    const studyBounds = await page.locator('.study-content').boundingBox();
    const nextBounds = await page.getByRole('button', { name: 'Next', exact: true }).boundingBox();
    if (!canvasBounds || !studyBounds || !nextBounds) return false;
    const gapBeforeNext = nextBounds.y - (canvasBounds.y + canvasBounds.height);
    return Math.abs(canvasBounds.width - studyBounds.width) < 2
      && Math.abs((nextBounds.x + nextBounds.width) - (canvasBounds.x + canvasBounds.width)) < 2
      && gapBeforeNext >= 0 && gapBeforeNext < nextBounds.height * 2
      && nextBounds.y + nextBounds.height <= (page.viewportSize()?.height ?? 0);
  }).toBe(true);
}

test('drawing library saves custom controls and gestures and replays the recorded scene', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  // Exercise opt-in completion validation without changing the library's
  // optional-drawing defaults or the example's direct library reference.
  await page.route('**/libraries/drawing/config.json', (route) => route.fulfill({
    json: {
      ...drawingConfig,
      components: {
        ...drawingConfig.components,
        canvas: {
          ...drawingConfig.components.canvas,
          parameters: { ...drawingConfig.components.canvas.parameters, requireDrawing: true },
        },
      },
    },
  }));
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

  await expectCanvasFillsStudyArea(page);
  const originalBounds = await drawing.boundingBox();
  if (!originalBounds) throw new Error('Drawing canvas has no bounds');
  expect(originalBounds.width).toBeGreaterThan(880);
  await page.setViewportSize({ width: 1600, height: 1200 });
  await expect.poll(async () => (await drawing.boundingBox())?.height ?? 0).toBeGreaterThan(originalBounds.height + 200);
  await expectCanvasFillsStudyArea(page);

  const next = page.getByRole('button', { name: 'Next', exact: true });
  const undo = page.getByRole('button', { name: 'Undo drawing', exact: true });
  const redo = page.getByRole('button', { name: 'Redo drawing', exact: true });
  const clear = page.getByRole('button', { name: 'Clear all', exact: true });
  await expectEmptyDrawingBlocksNext(page);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  const blue = page.getByRole('button', { name: 'Use blue ink', exact: true });
  await blue.click();
  await expect(blue).toHaveAttribute('aria-pressed', 'true');
  await page.locator('label').filter({ has: page.locator('svg[aria-label="Large"]') }).click();
  await expect(page.getByRole('radio', { name: 'Large', exact: true })).toBeChecked();

  // Escape must not silently select a hidden native tool, even when Pen is
  // already selected and the subsequent shortcut would not change our state.
  await drawing.locator('.excalidraw').focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('p');
  await drawStroke(page);
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await expect(next).toBeEnabled();
  await expect(undo).toBeEnabled();
  await expect(page.getByText('Please complete the stimulus interaction to continue.', { exact: true })).toBeHidden();

  // Native context-menu editing would bypass the study's gesture history.
  await drawing.locator('canvas.interactive').click({ button: 'right', position: { x: 170, y: 130 } });
  await expect(page.locator('.context-menu')).toBeHidden();

  await undo.click();
  await expect.poll(() => blueInkPixels(page)).toBe(0);
  await expectEmptyDrawingBlocksNext(page);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await expect(redo).toBeDisabled();

  await clear.click();
  await expect.poll(() => blueInkPixels(page)).toBe(0);
  await expectEmptyDrawingBlocksNext(page);
  await undo.click();
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await nextClick(page);
  await waitForStudyEndMessage(page);

  const identifier = '$drawing.components.canvas_1';
  await expect.poll(async () => Boolean(await readParticipantRecording(page, 'library-drawing', identifier))).toBe(true);
  const recording = await readParticipantRecording(page, 'library-drawing', identifier);
  if (!recording) throw new Error('No recorded drawing answer found');
  expect(recording.answer.drawing).toMatchObject({
    format: 'excalidraw',
    elements: [expect.objectContaining({
      type: 'freedraw', strokeColor: '#339af0', strokeWidth: 6 / 4.25, isDeleted: false,
    })],
  });

  const provenanceKey = `dev-library-drawing/provenance/${recording.participantId}_${identifier}`;
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

test('narrow drawing canvas hides native controls and retains study undo and redo', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 1000 });
  await resetClientStudyState(page);
  await page.goto('/library-drawing');
  await nextClick(page);

  const drawing = page.getByTestId('drawing-canvas');
  await expect(drawing.locator('.excalidraw--mobile')).toBeVisible();
  // Assert the bar exists so a missing selector cannot conceal this regression.
  await expect(drawing.locator('.App-bottom-bar')).toHaveCount(1);
  await expect(drawing.locator('.App-bottom-bar')).toBeHidden();
  await expect(drawing.locator('.FixedSideContainer_side_top')).toBeHidden();
  await page.getByRole('button', { name: 'Use blue ink', exact: true }).click();

  await drawStroke(page);
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Undo drawing', exact: true }).click();
  await expect.poll(() => blueInkPixels(page)).toBe(0);
  await page.getByRole('button', { name: 'Redo drawing', exact: true }).click();
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
});

test('drawing resumes controls and gesture undo history after reloading and returning', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.route('**/library-drawing/config.json', (route) => route.fulfill({
    json: {
      ...drawingStudy,
      components: {
        ...drawingStudy.components,
        review: {
          type: 'questionnaire', instruction: 'Review your drawing', instructionLocation: 'aboveStimulus', previousButton: true, response: [],
        },
      },
      sequence: { order: 'fixed', components: [...drawingStudy.sequence.components, 'review'] },
    },
  }));
  await resetClientStudyState(page);
  await page.goto('/library-drawing');
  await nextClick(page);
  const blue = page.getByRole('button', { name: 'Use blue ink', exact: true });
  const undo = page.getByRole('button', { name: 'Undo drawing', exact: true });
  const redo = page.getByRole('button', { name: 'Redo drawing', exact: true });
  await expect(page.getByTestId('drawing-canvas').locator('canvas.static')).toBeVisible();
  await blue.click();
  await page.locator('label').filter({ has: page.locator('svg[aria-label="Large"]') }).click();
  await drawStroke(page);
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await nextClick(page);
  await expect(page.getByText('Review your drawing')).toBeVisible();
  const identifier = '$drawing.components.canvas_1';
  await expect.poll(async () => Boolean(await readParticipantRecording(page, 'library-drawing', identifier))).toBe(true);
  const first = (await readParticipantRecording(page, 'library-drawing', identifier))!;
  const provenanceKey = `dev-library-drawing/provenance/${first.participantId}_${identifier}`;
  await expect.poll(async () => await readStoredValue(page, provenanceKey)).not.toBeNull();
  const original = await readStoredValue<{ stimulus: { nodes: Record<string, unknown> } }>(page, provenanceKey);

  await page.reload();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await expect(blue).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('radio', { name: 'Large', exact: true })).toBeChecked();
  await expect(undo).toBeEnabled();
  await expect(redo).toBeDisabled();
  await nextClick(page);
  await expect(page.getByText('Review your drawing')).toBeVisible();
  await expect.poll(async () => (await readParticipantRecording(page, 'library-drawing', identifier))?.endTime ?? 0, { timeout: 15000 }).toBeGreaterThan(first.endTime);
  expect(await readStoredValue(page, provenanceKey)).toEqual(original);

  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await undo.click();
  await expect.poll(() => blueInkPixels(page)).toBe(0);
  await redo.click();
  await expect.poll(() => blueInkPixels(page)).toBeGreaterThan(100);
  await drawStroke(page);
  await nextClick(page);
  await expect(page.getByText('Review your drawing')).toBeVisible();
  await expect.poll(async () => Object.keys((await readStoredValue<{ stimulus: { nodes: Record<string, unknown> } }>(page, provenanceKey))?.stimulus.nodes ?? {}).length).toBeGreaterThan(Object.keys(original!.stimulus.nodes).length);
  const appended = await readStoredValue<{ stimulus: { nodes: Record<string, unknown> } }>(page, provenanceKey);
  expect(Object.keys(appended!.stimulus.nodes)).toEqual(expect.arrayContaining(Object.keys(original!.stimulus.nodes)));
});
