import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  nextClick, openStudyFromLanding, resetClientStudyState,
} from './utils';

function extractJpegImages(pdf: Uint8Array) {
  const images: Uint8Array[] = [];

  for (let start = 0; start < pdf.length - 2; start += 1) {
    if (pdf[start] === 0xff && pdf[start + 1] === 0xd8 && pdf[start + 2] === 0xff) {
      for (let end = start + 3; end < pdf.length - 1; end += 1) {
        if (pdf[end] === 0xff && pdf[end + 1] === 0xd9) {
          images.push(pdf.slice(start, end + 2));
          start = end + 1;
          break;
        }
      }
    }
  }

  return images;
}

test('exports the current study component as a PDF download', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', [
    'Images as Stimuli: Decision-Making with Uncertainty Visualizations',
    'Simple Images as Stimuli: Decision-Making with Uncertainty Visualizations',
  ]);

  await expect(page.getByText(/use images as stimuli/i)).toBeVisible();
  await nextClick(page);
  await expect(page.getByText('Will you issue blankets to the alpacas?')).toBeVisible();
  await expect(page.getByRole('main').getByRole('img')).toBeVisible();
  const selectedResponse = page.getByLabel('Yes');
  await selectedResponse.check();
  const routeBeforeExport = page.url();
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  expect(await nextButton.evaluate((element) => Boolean(element.closest('[data-html2canvas-ignore]')))).toBe(true);

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^dotplot-low_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.pdf$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const pdf = await readFile(downloadPath!);
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(pdf.byteLength).toBeGreaterThan(10000);
  const mediaBox = Buffer.from(pdf).toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  expect(mediaBox).not.toBeNull();
  expect(Number(mediaBox?.[1])).toBeGreaterThan(Number(mediaBox?.[2]));
  const jpegImages = extractJpegImages(pdf);
  expect(jpegImages.length).toBeGreaterThan(0);
  const largestJpeg = jpegImages.sort((left, right) => right.byteLength - left.byteLength)[0];
  const pixelSummary = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonWhitePixels = 0;
    const brightnessBuckets = new Set<number>();
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (red < 245 || green < 245 || blue < 245) {
        nonWhitePixels += 1;
      }
      brightnessBuckets.add(Math.round((red + green + blue) / 24));
    }

    return {
      brightnessBuckets: brightnessBuckets.size,
      height: image.naturalHeight,
      nonWhiteRatio: nonWhitePixels / (canvas.width * canvas.height),
      width: image.naturalWidth,
    };
  }, Buffer.from(largestJpeg).toString('base64'));
  expect(pixelSummary.width).toBeGreaterThan(500);
  expect(pixelSummary.height).toBeGreaterThan(500);
  expect(pixelSummary.nonWhiteRatio).toBeGreaterThan(0.01);
  expect(pixelSummary.brightnessBuckets).toBeGreaterThan(5);
  expect(page.url()).toBe(routeBeforeExport);
  await expect(selectedResponse).toBeChecked();
});

test('fits wide development layouts inside the PDF capture', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2400, height: 1200 });
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');
  await expect(page.getByText(/embed HTML elements into the study page/i)).toBeVisible();

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('wide-layout.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);
  const jpegImages = extractJpegImages(pdf);
  const largestJpeg = jpegImages.sort((left, right) => right.byteLength - left.byteLength)[0];

  const rightEdgeNonWhiteRatio = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonWhitePixels = 0;
    const edgeWidth = 10;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = canvas.width - edgeWidth; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) {
          nonWhitePixels += 1;
        }
      }
    }

    return nonWhitePixels / (edgeWidth * canvas.height);
  }, Buffer.from(largestJpeg).toString('base64'));

  expect(rightEdgeNonWhiteRatio).toBeLessThan(0.05);
});

test('fits long components on a single PDF page', async ({ page }, testInfo) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Form Elements Demo');
  await nextClick(page);
  await expect(page.getByPlaceholder('Enter your age here, range from 0 to 100')).toBeVisible();

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('long-layout.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);

  expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0).toBe(1);
});

test('reports external website components as unsupported instead of downloading an incomplete PDF', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');
  await nextClick(page);
  await expect(page.getByText('How many bars have a value greater than 1?')).toBeVisible();
  await page.locator('input[data-path="html-response"]').fill('2');
  await nextClick(page);
  await expect(page.locator('iframe[src^="https://www.revisit.dev"]')).toBeVisible();
  let downloaded = false;
  page.on('download', () => { downloaded = true; });

  await page.getByRole('button', { name: 'Study actions' }).click();
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();

  await expect(page.getByText('Pages containing external websites cannot currently be exported to PDF.')).toBeVisible();
  await page.waitForTimeout(250);
  expect(downloaded).toBe(false);
});
