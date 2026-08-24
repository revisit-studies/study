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

test('exports the current study component as a PDF download', async ({ page }, testInfo) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', [
    'Images as Stimuli: Decision-Making with Uncertainty Visualizations',
    'Simple Images as Stimuli: Decision-Making with Uncertainty Visualizations',
  ]);

  await expect(page.getByText(/use images as stimuli/i)).toBeVisible();
  await nextClick(page);
  await expect(page.getByText('Will you issue blankets to the alpacas?')).toBeVisible();
  await expect(page.getByRole('main').getByRole('img')).toBeVisible();
  await page.getByRole('main').evaluate((main) => {
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.display = 'none';
    const iframe = document.createElement('iframe');
    iframe.src = 'https://example.com/hidden-external-content';
    hiddenContainer.append(iframe);
    main.append(hiddenContainer);
  });
  const selectedResponse = page.getByLabel('Yes');
  await selectedResponse.check();
  const routeBeforeExport = page.url();
  const nextButton = page.getByRole('button', { name: 'Next', exact: true });
  expect(await nextButton.evaluate((element) => Boolean(element.closest('[data-html2canvas-ignore]')))).toBe(false);
  await expect(nextButton).toBeEnabled();

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^dotplot-low_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.pdf$/);
  const downloadPath = testInfo.outputPath('with-next-button.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);
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
    let blueButtonPixels = 0;
    let nonWhitePixels = 0;
    const brightnessBuckets = new Set<number>();
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        if (red < 245 || green < 245 || blue < 245) {
          nonWhitePixels += 1;
        }
        if (x < 100 && y > 90 && blue > 150 && blue - red > 50) {
          blueButtonPixels += 1;
        }
        brightnessBuckets.add(Math.round((red + green + blue) / 24));
      }
    }

    return {
      blueButtonPixels,
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
  expect(pixelSummary.blueButtonPixels).toBeGreaterThan(20);
  expect(page.url()).toBe(routeBeforeExport);
  await expect(selectedResponse).toBeChecked();
});

test('fits wide development layouts inside the PDF capture', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2400, height: 1200 });
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');
  await expect(page.getByText(/embed HTML elements into the study page/i)).toBeVisible();
  await page.getByRole('main').evaluate((main) => {
    const marker = document.createElement('div');
    marker.setAttribute('data-pdf-wide-marker', '');
    marker.style.display = 'flex';
    marker.style.justifyContent = 'space-between';
    marker.style.width = '1800px';
    const left = document.createElement('div');
    left.style.backgroundColor = '#ff0000';
    left.style.height = '120px';
    left.style.width = '120px';
    const right = document.createElement('div');
    right.style.backgroundColor = '#00ff00';
    right.style.height = '120px';
    right.style.width = '120px';
    marker.append(left, right);
    main.append(marker);
  });

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('wide-layout.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);
  const jpegImages = extractJpegImages(pdf);
  const largestJpeg = jpegImages.sort((left, right) => right.byteLength - left.byteLength)[0];

  const markerPixels = await page.evaluate(async (base64) => {
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
    let greenPixels = 0;
    let redPixels = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        if (red > 180 && green < 100 && blue < 100) {
          redPixels += 1;
        }
        if (green > 150 && red < 120 && blue < 120) {
          greenPixels += 1;
        }
      }
    }

    return { greenPixels, redPixels };
  }, Buffer.from(largestJpeg).toString('base64'));

  expect(markerPixels.redPixels).toBeGreaterThan(20);
  expect(markerPixels.greenPixels).toBeGreaterThan(20);
});

test('captures source canvas pixels in the PDF', async ({ page }, testInfo) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');
  await expect(page.getByText(/embed HTML elements into the study page/i)).toBeVisible();
  await page.getByRole('main').evaluate((main) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 300;
    canvas.style.height = '300px';
    canvas.style.width = '600px';
    canvas.setAttribute('aria-label', 'Canvas export marker');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }
    context.fillStyle = '#ff00ff';
    context.fillRect(0, 0, 300, 300);
    context.fillStyle = '#00ffff';
    context.fillRect(300, 0, 300, 300);
    main.append(canvas);
  });

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('canvas-stimulus.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);
  const jpegImages = extractJpegImages(pdf);
  const largestJpeg = jpegImages.sort((left, right) => right.byteLength - left.byteLength)[0];

  const canvasPixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let cyanPixels = 0;
    let magentaPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (red > 150 && blue > 150 && green < 120) {
        magentaPixels += 1;
      }
      if (green > 150 && blue > 150 && red < 120) {
        cyanPixels += 1;
      }
    }
    return { cyanPixels, magentaPixels };
  }, Buffer.from(largestJpeg).toString('base64'));

  expect(canvasPixels.magentaPixels).toBeGreaterThan(100);
  expect(canvasPixels.cyanPixels).toBeGreaterThan(100);
});

test('preserves selected and scrolled state in the PDF', async ({ page }, testInfo) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');
  await expect(page.getByText(/embed HTML elements into the study page/i)).toBeVisible();
  await page.getByRole('main').evaluate((main) => {
    const style = document.createElement('style');
    style.textContent = `
      #pdf-select-state-marker { background: #ff0000; height: 80px; width: 300px; }
      #pdf-state-select:has(option[value="second"]:checked) + #pdf-select-state-marker {
        background: #ff00ff;
      }
    `;
    const select = document.createElement('select');
    select.id = 'pdf-state-select';
    select.innerHTML = '<option value="first">First</option><option value="second">Second</option>';
    select.value = 'second';
    const selectMarker = document.createElement('div');
    selectMarker.id = 'pdf-select-state-marker';
    const scroller = document.createElement('div');
    scroller.style.height = '80px';
    scroller.style.overflow = 'hidden';
    scroller.style.width = '300px';
    scroller.innerHTML = `
      <div style="background: #ffff00; height: 80px"></div>
      <div style="background: #00ffff; height: 80px"></div>
    `;
    main.append(style, select, selectMarker, scroller);
    scroller.scrollTop = 80;
  });

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('preserved-state.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);
  const jpegImages = extractJpegImages(pdf);
  const largestJpeg = jpegImages.sort((left, right) => right.byteLength - left.byteLength)[0];

  const statePixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let cyanPixels = 0;
    let magentaPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      if (red > 150 && blue > 150 && green < 120) {
        magentaPixels += 1;
      }
      if (green > 150 && blue > 150 && red < 120) {
        cyanPixels += 1;
      }
    }
    return { cyanPixels, magentaPixels };
  }, Buffer.from(largestJpeg).toString('base64'));

  expect(statePixels.magentaPixels).toBeGreaterThan(100);
  expect(statePixels.cyanPixels).toBeGreaterThan(100);
});

test('captures same-origin iframe contents in the PDF', async ({ page }, testInfo) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');
  await nextClick(page);
  await expect(page.getByText('How many bars have a value greater than 1?')).toBeVisible();
  await expect(page.frameLocator('iframe').locator('svg rect')).toHaveCount(7);

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('same-origin-iframe.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);
  const jpegImages = extractJpegImages(pdf);
  const largestJpeg = jpegImages.sort((left, right) => right.byteLength - left.byteLength)[0];

  const saturatedRightPixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let saturatedPixels = 0;
    for (let y = 40; y < canvas.height; y += 1) {
      for (let x = 100; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        if (Math.max(red, green, blue) - Math.min(red, green, blue) > 40) {
          saturatedPixels += 1;
        }
      }
    }
    return saturatedPixels;
  }, Buffer.from(largestJpeg).toString('base64'));

  expect(saturatedRightPixels).toBeGreaterThan(20);
});

test('captures iframe content beyond reported document bounds', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resetClientStudyState(page);
  await page.getByRole('tab', { name: 'Example Studies' }).click();
  const exampleStudies = page.getByLabel('Example Studies');
  const studyCard = exampleStudies.locator('div').filter({ hasText: 'MVNV Study Replication' }).first();
  await studyCard.getByText('Go to Study').click();
  await page.getByRole('tab', { name: 'Browse Components' }).click();
  await page.getByLabel('Browse Components').getByText('task3', { exact: true }).click();

  const frame = page.frameLocator('#root iframe');
  await expect.poll(() => frame.locator('#topology svg rect').count(), {
    timeout: 20000,
  }).toBeGreaterThan(5000);
  await expect(frame.locator('#searchButton')).toHaveCSS(
    'background-color',
    /rgb\((?!239, 239, 239)/,
  );

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('mvnv-multi-edge-adjacency-matrix.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);
  const jpegImages = extractJpegImages(pdf);
  const largestJpeg = jpegImages.sort((left, right) => right.byteLength - left.byteLength)[0];

  const matrixPixelSummary = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 280;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let attributeColorPixels = 0;
    let nonWhitePixels = 0;
    let rightEdgeMatrixPixels = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const isNonWhite = red < 245 || green < 245 || blue < 245;
        if (x >= 150 && x < 270 && y >= 55 && y < 165 && isNonWhite) {
          nonWhitePixels += 1;
        }
        if (x >= 255 && x < 285 && y >= 95 && y < 115 && isNonWhite) {
          rightEdgeMatrixPixels += 1;
        }
        if (
          x >= 285 && x < 325 && y >= 95 && y < 245
          && Math.max(red, green, blue) - Math.min(red, green, blue) > 35
        ) {
          attributeColorPixels += 1;
        }
      }
    }
    return { attributeColorPixels, nonWhitePixels, rightEdgeMatrixPixels };
  }, Buffer.from(largestJpeg).toString('base64'));

  expect(matrixPixelSummary.nonWhitePixels).toBeGreaterThan(1000);
  expect(matrixPixelSummary.rightEdgeMatrixPixels).toBeGreaterThan(100);
  expect(matrixPixelSummary.attributeColorPixels).toBeGreaterThan(100);
});

test('captures the current frame of same-origin video components', async ({ page }, testInfo) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'Video as a Stimulus');
  await page.getByRole('tab', { name: 'Browse Components' }).click();
  await page.getByLabel('Browse Components').getByText('internal', { exact: true }).click();
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((element) => (
    element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && element.videoWidth > 0
    && element.videoHeight > 0
  ))).toBe(true);
  await video.evaluate(async (element) => {
    const targetTime = Math.min(1, element.duration / 2);
    await new Promise<void>((resolve) => {
      element.addEventListener('seeked', () => resolve(), { once: true });
      element.currentTime = targetTime;
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('video-frame.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);
  const jpegImages = extractJpegImages(pdf);
  const largestJpeg = jpegImages.sort((left, right) => right.byteLength - left.byteLength)[0];

  const framePixelSummary = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let variedPixels = 0;
    const brightnessBuckets = new Set<number>();
    for (let y = 35; y < 160; y += 1) {
      for (let x = 80; x < 230; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const brightness = (red + green + blue) / 3;
        if (brightness > 20 && brightness < 240 && Math.max(red, green, blue) - Math.min(red, green, blue) > 12) {
          variedPixels += 1;
        }
        brightnessBuckets.add(Math.round(brightness / 8));
      }
    }

    return { brightnessBuckets: brightnessBuckets.size, variedPixels };
  }, Buffer.from(largestJpeg).toString('base64'));

  expect(framePixelSummary.variedPixels).toBeGreaterThan(500);
  expect(framePixelSummary.brightnessBuckets).toBeGreaterThan(12);
});

test('captures responsive SVG components in the PDF', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resetClientStudyState(page);
  await page.getByRole('tab', { name: 'Example Studies' }).click();
  const exampleStudies = page.getByLabel('Example Studies');
  const studyCard = exampleStudies.locator('div').filter({ hasText: 'Interactive Selections in Scatterplots' }).first();
  await studyCard.getByText('Go to Study').click();
  await page.getByRole('tab', { name: 'Browse Components' }).click();
  await page.getByLabel('Browse Components').locator('a').filter({ hasText: 'rectangleBrush_q1' }).click();
  await expect(page.locator('#scatterSvgBrushStudy circle')).toHaveCount(392);

  await page.getByRole('button', { name: 'Study actions' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();
  const download = await downloadPromise;
  const downloadPath = testInfo.outputPath('responsive-svg.pdf');
  await download.saveAs(downloadPath);
  const pdf = await readFile(downloadPath);
  const jpegImages = extractJpegImages(pdf);
  const largestJpeg = jpegImages.sort((left, right) => right.byteLength - left.byteLength)[0];

  const scatterPixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas rendering is unavailable');
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let saturatedPixels = 0;
    for (let y = 45; y < 140; y += 1) {
      for (let x = 115; x < 190; x += 1) {
        const index = (y * canvas.width + x) * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        if (Math.max(red, green, blue) - Math.min(red, green, blue) > 40) {
          saturatedPixels += 1;
        }
      }
    }
    return saturatedPixels;
  }, Buffer.from(largestJpeg).toString('base64'));

  expect(scatterPixels).toBeGreaterThan(50);
});

test('uses portrait for long components and fits them on a single PDF page', async ({ page }, testInfo) => {
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
  const mediaBox = Buffer.from(pdf).toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  expect(mediaBox).not.toBeNull();
  expect(Number(mediaBox?.[2])).toBeGreaterThan(Number(mediaBox?.[1]));
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

test('reports inaccessible sandboxed iframe content as unsupported', async ({ page }) => {
  await resetClientStudyState(page);
  await openStudyFromLanding(page, 'Demo Studies', 'HTML as a Stimulus');
  await expect(page.getByText(/embed HTML elements into the study page/i)).toBeVisible();
  await page.getByRole('main').evaluate((main) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', '');
    iframe.srcdoc = '<p>Sandboxed content</p>';
    main.append(iframe);
  });
  let downloaded = false;
  page.on('download', () => { downloaded = true; });

  await page.getByRole('button', { name: 'Study actions' }).click();
  await page.getByRole('menuitem', { name: 'Export page as PDF' }).click();

  await expect(page.getByText('Pages containing external websites cannot currently be exported to PDF.')).toBeVisible();
  await page.waitForTimeout(250);
  expect(downloaded).toBe(false);
});
