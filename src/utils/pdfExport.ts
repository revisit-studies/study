import html2canvas from 'html2canvas';
import html2pdf from 'html2pdf.js';

const PDF_MARGIN_MM = 10;
const PDF_MAX_WIDTH_PX = 920;
const A4_LANDSCAPE_WIDTH_MM = 297;
const A4_LANDSCAPE_HEIGHT_MM = 210;
const A4_PORTRAIT_WIDTH_MM = A4_LANDSCAPE_HEIGHT_MM;
const A4_PORTRAIT_HEIGHT_MM = A4_LANDSCAPE_WIDTH_MM;
const PDF_VIDEO_FRAME_WAIT_MS = 1500;
const PDF_RESOURCE_WAIT_MS = 10000;
const PDF_LARGE_SVG_ELEMENT_THRESHOLD = 1000;
const PDF_MAX_CAPTURE_SCALE = 2;
const PDF_MAX_RASTER_DIMENSION = 8192;
const PDF_MAX_RASTER_PIXELS = 16000000;
const PDF_SNAPSHOT_PADDING_PX = 32;
const PDF_PORTRAIT_FIT_ADVANTAGE = 1.3;
const PDF_PRINTABLE_ASPECT_RATIO = (A4_LANDSCAPE_HEIGHT_MM - (PDF_MARGIN_MM * 2))
  / (A4_LANDSCAPE_WIDTH_MM - (PDF_MARGIN_MM * 2));
const PDF_PORTRAIT_PRINTABLE_ASPECT_RATIO = (A4_PORTRAIT_HEIGHT_MM - (PDF_MARGIN_MM * 2))
  / (A4_PORTRAIT_WIDTH_MM - (PDF_MARGIN_MM * 2));

const SVG_PRESENTATION_PROPERTIES = [
  'alignment-baseline',
  'baseline-shift',
  'clip-path',
  'color',
  'display',
  'dominant-baseline',
  'fill',
  'fill-opacity',
  'filter',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-weight',
  'letter-spacing',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'opacity',
  'paint-order',
  'shape-rendering',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'text-anchor',
  'text-decoration',
  'visibility',
  'word-spacing',
] as const;

export interface PdfIframeSnapshot {
  dataUrl: string;
  index: number;
}

export interface PdfCanvasSnapshot {
  dataUrl?: string;
  height: number;
  index: number;
  width: number;
}

export interface PdfVideoSnapshot {
  dataUrl?: string;
  height: number;
  index: number;
  objectFit: string;
  objectPosition: string;
  width: number;
}

interface PdfSvgSnapshot {
  dataUrl: string;
  displayHeight: number;
  displayWidth: number;
  index: number;
  left: number;
  top: number;
}

interface PdfIframeCaptureSize {
  contentHeight: number;
  contentWidth: number;
  height: number;
  width: number;
}

interface PdfPageLayout {
  exportHeight: number;
  exportWidth: number;
  orientation: 'landscape' | 'portrait';
}

function getBoundedRasterSize(width: number, height: number, preferredScale = 1) {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const scale = Math.min(
    preferredScale,
    PDF_MAX_RASTER_DIMENSION / Math.max(safeWidth, safeHeight),
    Math.sqrt(PDF_MAX_RASTER_PIXELS / (safeWidth * safeHeight)),
  );

  return {
    height: Math.max(1, Math.floor(safeHeight * scale)),
    scale,
    width: Math.max(1, Math.floor(safeWidth * scale)),
  };
}

function isPdfRenderedElement(element: HTMLElement) {
  if (element.hidden) {
    return false;
  }

  const sourceWindow = element.ownerDocument.defaultView;
  if (!sourceWindow) {
    return true;
  }

  const style = sourceWindow.getComputedStyle(element);
  return style.display !== 'none'
    && style.contentVisibility !== 'hidden'
    && style.opacity !== '0'
    && style.visibility !== 'hidden'
    && style.visibility !== 'collapse';
}

function withPdfTimeout<T>(promise: Promise<T>, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), PDF_RESOURCE_WAIT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function waitForPdfLoad(
  target: EventTarget,
  startLoading: () => void,
  timeoutMessage: string,
  errorMessage?: string,
) {
  return new Promise<void>((resolve, reject) => {
    let timeoutId = 0;
    let handleLoad = () => {};
    let handleError = () => {};
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      target.removeEventListener('load', handleLoad);
      target.removeEventListener('error', handleError);
    };
    handleLoad = () => {
      cleanup();
      resolve();
    };
    handleError = () => {
      cleanup();
      if (errorMessage) {
        reject(new Error(errorMessage));
      } else {
        resolve();
      }
    };
    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, PDF_RESOURCE_WAIT_MS);

    target.addEventListener('load', handleLoad, { once: true });
    target.addEventListener('error', handleError, { once: true });
    startLoading();
  });
}

function getPdfFitScale(
  contentWidth: number,
  contentHeight: number,
  pageWidth: number,
  pageHeight: number,
) {
  return Math.min(
    pageWidth / Math.max(contentWidth, 1),
    pageHeight / Math.max(contentHeight, 1),
    1,
  );
}

export function selectPdfPageLayout(
  contentWidth: number,
  contentHeight: number,
  exportWidth = PDF_MAX_WIDTH_PX,
): PdfPageLayout {
  const landscapeHeight = Math.floor(exportWidth * PDF_PRINTABLE_ASPECT_RATIO);
  const portraitHeight = Math.floor(exportWidth * PDF_PORTRAIT_PRINTABLE_ASPECT_RATIO);
  const landscapeScale = getPdfFitScale(
    contentWidth,
    contentHeight,
    exportWidth,
    landscapeHeight,
  );
  const portraitScale = getPdfFitScale(
    contentWidth,
    contentHeight,
    landscapeHeight,
    exportWidth,
  );
  const orientation = portraitScale >= landscapeScale * PDF_PORTRAIT_FIT_ADVANTAGE
    ? 'portrait'
    : 'landscape';

  return {
    exportHeight: orientation === 'portrait'
      ? portraitHeight
      : landscapeHeight,
    exportWidth,
    orientation,
  };
}

function padDatePart(value: number) {
  return `${value}`.padStart(2, '0');
}

function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

export function buildPdfFilename(componentName: string, exportedAt: Date = new Date()) {
  const safeComponentName = sanitizeFilenamePart(componentName) || 'study-page';
  const date = [
    exportedAt.getFullYear(),
    padDatePart(exportedAt.getMonth() + 1),
    padDatePart(exportedAt.getDate()),
  ].join('-');
  const time = [
    padDatePart(exportedAt.getHours()),
    padDatePart(exportedAt.getMinutes()),
    padDatePart(exportedAt.getSeconds()),
  ].join('-');
  const timestamp = `${date}T${time}`;

  return `${safeComponentName}_${timestamp}.pdf`;
}

function hasUnsupportedPdfIframe(
  iframe: HTMLIFrameElement,
  visitedDocuments: Set<Document>,
): boolean {
  if (!isPdfRenderedElement(iframe)) {
    return false;
  }

  const sandbox = iframe.getAttribute('sandbox');
  if (sandbox !== null && !sandbox.split(/\s+/).includes('allow-same-origin')) {
    return true;
  }

  const source = iframe.getAttribute('src');
  if (source && !iframe.srcdoc) {
    try {
      if (new URL(iframe.src, window.location.href).origin !== window.location.origin) {
        return true;
      }
    } catch {
      return true;
    }
  }

  let iframeDocument: Document | null;
  try {
    iframeDocument = iframe.contentDocument;
    if (!iframeDocument?.documentElement) {
      return true;
    }
  } catch {
    return true;
  }

  if (visitedDocuments.has(iframeDocument)) {
    return false;
  }
  visitedDocuments.add(iframeDocument);

  return Array.from(iframeDocument.querySelectorAll('iframe')).some((nestedIframe) => (
    hasUnsupportedPdfIframe(nestedIframe, visitedDocuments)
  ));
}

export function getPdfExportUnsupportedReason(element: HTMLElement) {
  const visitedDocuments = new Set<Document>();
  const hasCrossOriginIframe = Array.from(element.querySelectorAll('iframe')).some((iframe) => (
    hasUnsupportedPdfIframe(iframe, visitedDocuments)
  ));

  return hasCrossOriginIframe
    ? 'Pages containing external websites cannot currently be exported to PDF.'
    : undefined;
}

export function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function waitForIframePaint(iframe: HTMLIFrameElement) {
  return new Promise<void>((resolve) => {
    const requestFrame = (callback: FrameRequestCallback) => (
      iframe.contentWindow?.requestAnimationFrame(callback) ?? requestAnimationFrame(callback)
    );
    requestFrame(() => {
      requestFrame(() => resolve());
    });
  });
}

function waitForIframeImages(iframeDocument: Document) {
  return Promise.all(Array.from(iframeDocument.images).map(async (image) => {
    if (!image.complete || image.naturalWidth === 0) {
      await image.decode().catch(() => undefined);
    }
  }));
}

function waitForPdfStylesheet(stylesheet: HTMLLinkElement, absoluteHref: string) {
  return waitForPdfLoad(
    stylesheet,
    () => { stylesheet.href = absoluteHref; },
    'Timed out while preparing embedded page styles.',
  );
}

function prepareIframeClone(
  clonedDocument: Document,
  sourceDocument: Document,
  width: number,
) {
  const base = clonedDocument.createElement('base');
  base.href = sourceDocument.baseURI;
  clonedDocument.head.prepend(base);

  clonedDocument.documentElement.style.width = `${width}px`;
  clonedDocument.documentElement.style.maxWidth = 'none';
  clonedDocument.documentElement.style.overflow = 'visible';
  clonedDocument.body.style.width = `${width}px`;
  clonedDocument.body.style.maxWidth = 'none';
  clonedDocument.body.style.overflow = 'visible';

  const cssText = Array.from(sourceDocument.styleSheets).flatMap((stylesheet) => {
    try {
      return Array.from(stylesheet.cssRules).map((rule) => rule.cssText);
    } catch {
      return [];
    }
  }).join('\n');
  if (cssText) {
    const style = clonedDocument.createElement('style');
    style.textContent = cssText;
    clonedDocument.head.append(style);
  }

  return Promise.all(Array.from(
    clonedDocument.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
  ).map((stylesheet) => {
    const href = stylesheet.getAttribute('href');
    if (!href) {
      return Promise.resolve();
    }

    const absoluteHref = new URL(href, sourceDocument.baseURI).href;
    if (stylesheet.sheet && stylesheet.href === absoluteHref) {
      return Promise.resolve();
    }

    return waitForPdfStylesheet(stylesheet, absoluteHref);
  }));
}

function getIframeCaptureSize(iframe: HTMLIFrameElement, iframeDocument: Document) {
  const iframeRoot = iframeDocument.documentElement;
  const iframeBody = iframeDocument.body;
  const iframeBounds = iframe.getBoundingClientRect();
  const scrollX = iframeDocument.defaultView?.scrollX ?? 0;
  const scrollY = iframeDocument.defaultView?.scrollY ?? 0;
  const layoutElements = [
    iframeRoot,
    ...(iframeBody ? [iframeBody, ...iframeBody.querySelectorAll<HTMLElement>('*:not(svg *)')] : []),
  ];

  return layoutElements.reduce((size, layoutElement): PdfIframeCaptureSize => {
    const bounds = layoutElement.getBoundingClientRect();
    const contentHeight = bounds.bottom + scrollY;
    const contentWidth = bounds.right + scrollX;
    return {
      contentHeight: Math.max(size.contentHeight, contentHeight),
      contentWidth: Math.max(size.contentWidth, contentWidth),
      height: Math.max(
        size.height,
        layoutElement.scrollHeight,
        bounds.bottom + scrollY,
        bounds.top + scrollY + layoutElement.scrollHeight,
      ),
      width: Math.max(
        size.width,
        layoutElement.scrollWidth,
        bounds.right + scrollX,
        bounds.left + scrollX + layoutElement.scrollWidth,
      ),
    };
  }, {
    contentHeight: Math.max(iframe.clientHeight, iframeBounds.height),
    contentWidth: Math.max(iframe.clientWidth, iframeBounds.width),
    height: Math.max(iframe.clientHeight, iframeBounds.height),
    width: Math.max(iframe.clientWidth, iframeBounds.width),
  });
}

function getIframeCaptureScale(
  captureWidth: number,
  captureHeight: number,
  displayWidth: number,
  pageScale?: number,
) {
  const preferredScale = pageScale === undefined || displayWidth === 0
    ? PDF_MAX_CAPTURE_SCALE
    : (displayWidth * pageScale * PDF_MAX_CAPTURE_SCALE) / captureWidth;

  return getBoundedRasterSize(captureWidth, captureHeight, preferredScale).scale;
}

function inlineSvgPresentationStyles(sourceSvg: SVGSVGElement, clonedSvg: SVGSVGElement) {
  const sourceElements = [sourceSvg, ...sourceSvg.querySelectorAll<HTMLElement | SVGElement>('*')];
  const clonedElements = [clonedSvg, ...clonedSvg.querySelectorAll<HTMLElement | SVGElement>('*')];
  const sourceWindow = sourceSvg.ownerDocument.defaultView;

  sourceElements.forEach((sourceElement, index) => {
    const clonedElement = clonedElements[index];
    if (!clonedElement || !sourceWindow) {
      return;
    }

    const computedStyle = sourceWindow.getComputedStyle(sourceElement);
    SVG_PRESENTATION_PROPERTIES.forEach((property) => {
      const value = computedStyle.getPropertyValue(property);
      if (value) {
        clonedElement.style.setProperty(property, value);
      }
    });
  });
}

async function loadSvgImage(document: Document, source: string) {
  const image = document.createElement('img');
  await waitForPdfLoad(
    image,
    () => { image.src = source; },
    'Timed out while rasterizing an embedded visualization.',
    'The SVG could not be rasterized.',
  );
  return image;
}

function waitForPdfImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return waitForPdfLoad(
    image,
    () => {},
    'Timed out while loading an embedded page snapshot.',
    'The embedded page snapshot could not be loaded.',
  );
}

async function captureSvgSnapshot(svg: SVGSVGElement, index: number, scale: number) {
  const bounds = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const width = Math.ceil(viewBox.width || bounds.width);
  const height = Math.ceil(viewBox.height || bounds.height);
  if (width === 0 || height === 0) {
    return undefined;
  }

  const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clonedSvg.setAttribute('width', `${width}`);
  clonedSvg.setAttribute('height', `${height}`);
  clonedSvg.style.width = `${width}px`;
  clonedSvg.style.height = `${height}px`;
  inlineSvgPresentationStyles(svg, clonedSvg);

  const serializedSvg = new XMLSerializer().serializeToString(clonedSvg);
  const objectUrl = URL.createObjectURL(new Blob([serializedSvg], { type: 'image/svg+xml' }));

  try {
    const image = await loadSvgImage(svg.ownerDocument, objectUrl);
    const canvas = svg.ownerDocument.createElement('canvas');
    const rasterSize = getBoundedRasterSize(width, height, scale);
    canvas.width = rasterSize.width;
    canvas.height = rasterSize.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      displayHeight: Math.ceil(bounds.height),
      displayWidth: Math.ceil(bounds.width),
      index,
      left: bounds.left + (svg.ownerDocument.defaultView?.scrollX ?? 0),
      top: bounds.top + (svg.ownerDocument.defaultView?.scrollY ?? 0),
    } satisfies PdfSvgSnapshot;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function captureLargeSvgSnapshots(iframeDocument: Document, scale: number) {
  const svgs = Array.from(iframeDocument.querySelectorAll<SVGSVGElement>('svg'));
  if (!svgs.some((svg) => (
    svg.querySelectorAll('*').length >= PDF_LARGE_SVG_ELEMENT_THRESHOLD
  ))) {
    return [];
  }

  return svgs.reduce<Promise<PdfSvgSnapshot[]>>(async (pendingSnapshots, svg, index) => {
    const snapshots = await pendingSnapshots;
    const snapshot = await captureSvgSnapshot(svg, index, scale);
    return snapshot ? [...snapshots, snapshot] : snapshots;
  }, Promise.resolve([]));
}

async function replaceLargeSvgsWithSnapshots(
  clonedDocument: Document,
  snapshots: PdfSvgSnapshot[],
) {
  const clonedSvgs = Array.from(clonedDocument.querySelectorAll<SVGSVGElement>('svg'));

  await Promise.all(snapshots.map(async (snapshot) => {
    const clonedSvg = clonedSvgs[snapshot.index];
    if (!clonedSvg) {
      return;
    }

    const image = clonedDocument.createElement('img');
    image.alt = clonedSvg.getAttribute('aria-label') || 'Embedded visualization';
    image.src = snapshot.dataUrl;
    image.style.display = 'block';
    image.style.height = `${snapshot.displayHeight}px`;
    image.style.left = `${snapshot.left}px`;
    image.style.maxHeight = 'none';
    image.style.maxWidth = 'none';
    image.style.position = 'absolute';
    image.style.top = `${snapshot.top}px`;
    image.style.width = `${snapshot.displayWidth}px`;
    image.style.zIndex = '2147483647';
    clonedSvg.style.visibility = 'hidden';
    clonedDocument.body.append(image);
    await waitForPdfImage(image);
  }));
}

function cropIframeSnapshot(
  canvas: HTMLCanvasElement,
  captureSize: PdfIframeCaptureSize,
) {
  if (canvas.width === 0 || canvas.height === 0) {
    return canvas;
  }

  const width = Math.min(
    canvas.width,
    Math.ceil(
      ((captureSize.contentWidth + PDF_SNAPSHOT_PADDING_PX) / captureSize.width)
      * canvas.width,
    ),
  );
  const height = Math.min(
    canvas.height,
    Math.ceil(
      ((captureSize.contentHeight + PDF_SNAPSHOT_PADDING_PX) / captureSize.height)
      * canvas.height,
    ),
  );
  if (width === canvas.width && height === canvas.height) {
    return canvas;
  }

  const croppedCanvas = canvas.ownerDocument.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = height;
  croppedCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
  return croppedCanvas;
}

export async function capturePdfIframeSnapshots(element: HTMLElement, pageScale?: number) {
  const iframes = Array.from(element.querySelectorAll('iframe'));

  return iframes.reduce<Promise<PdfIframeSnapshot[]>>(async (
    pendingSnapshots,
    iframe,
    index,
  ) => {
    const snapshots = await pendingSnapshots;
    if (!isPdfRenderedElement(iframe)) {
      return snapshots;
    }

    const iframeDocument = iframe.contentDocument;
    const iframeRoot = iframeDocument?.documentElement;
    if (!iframeDocument || !iframeRoot) {
      throw new Error('The embedded page is not available for PDF export.');
    }

    await withPdfTimeout(Promise.all([
      iframeDocument.fonts?.ready,
      waitForIframeImages(iframeDocument),
      waitForIframePaint(iframe),
    ]), 'Timed out while preparing embedded page content.');
    const captureSize = getIframeCaptureSize(iframe, iframeDocument);
    const width = Math.ceil(captureSize.width);
    const height = Math.ceil(captureSize.height);
    if (width === 0 || height === 0) {
      throw new Error('The embedded page has no visible area to export.');
    }
    const captureScale = getIframeCaptureScale(
      width,
      height,
      iframe.getBoundingClientRect().width,
      pageScale,
    );
    const svgSnapshots = await captureLargeSvgSnapshots(iframeDocument, captureScale);

    const canvas = await html2canvas(iframeRoot, {
      backgroundColor: '#ffffff',
      height,
      logging: false,
      onclone: async (clonedDocument) => {
        await prepareIframeClone(clonedDocument, iframeDocument, width);
        await replaceLargeSvgsWithSnapshots(clonedDocument, svgSnapshots);
      },
      scale: captureScale,
      useCORS: true,
      width,
      windowHeight: height,
      windowWidth: width,
    });

    return [...snapshots, {
      dataUrl: cropIframeSnapshot(canvas, captureSize).toDataURL('image/png'),
      index,
    }];
  }, Promise.resolve([]));
}

export function capturePdfCanvasSnapshots(element: HTMLElement) {
  const canvases = Array.from(element.querySelectorAll('canvas'));

  return canvases.flatMap((canvas, index): PdfCanvasSnapshot[] => {
    if (!isPdfRenderedElement(canvas)) {
      return [];
    }

    const bounds = canvas.getBoundingClientRect();
    const width = Math.ceil(bounds.width || canvas.width);
    const height = Math.ceil(bounds.height || canvas.height);

    if (canvas.width === 0 || canvas.height === 0) {
      return [{ height, index, width }];
    }

    try {
      const preferredScale = Math.min(
        1,
        Math.sqrt(((Math.max(width, 1) * Math.max(height, 1)) * 4)
          / (canvas.width * canvas.height)),
      );
      const rasterSize = getBoundedRasterSize(canvas.width, canvas.height, preferredScale);
      let dataUrl: string;
      if (rasterSize.width === canvas.width && rasterSize.height === canvas.height) {
        dataUrl = canvas.toDataURL('image/png');
      } else {
        const rasterCanvas = canvas.ownerDocument.createElement('canvas');
        rasterCanvas.width = rasterSize.width;
        rasterCanvas.height = rasterSize.height;
        const context = rasterCanvas.getContext('2d');
        if (!context) {
          return [{ height, index, width }];
        }
        context.drawImage(canvas, 0, 0, rasterCanvas.width, rasterCanvas.height);
        dataUrl = rasterCanvas.toDataURL('image/png');
      }

      return [{
        dataUrl,
        height,
        index,
        width,
      }];
    } catch {
      return [{ height, index, width }];
    }
  });
}

function waitForVideoFrame(video: HTMLVideoElement) {
  if (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && video.videoWidth > 0
    && video.videoHeight > 0
  ) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let timeoutId: number;
    const finish = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('error', finish);
      resolve();
    };

    video.addEventListener('loadeddata', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    timeoutId = window.setTimeout(finish, PDF_VIDEO_FRAME_WAIT_MS);
  });
}

export async function capturePdfVideoSnapshots(element: HTMLElement) {
  const videos = Array.from(element.querySelectorAll('video'));
  const renderedVideos = videos.flatMap((video, index) => (
    isPdfRenderedElement(video) ? [{ index, video }] : []
  ));

  return Promise.all(renderedVideos.map(async ({ index, video }): Promise<PdfVideoSnapshot> => {
    await waitForVideoFrame(video);
    const bounds = video.getBoundingClientRect();
    const width = Math.ceil(bounds.width || video.videoWidth);
    const height = Math.ceil(bounds.height || video.videoHeight);
    const computedStyle = video.ownerDocument.defaultView?.getComputedStyle(video);
    const objectFit = computedStyle?.objectFit || 'fill';
    const objectPosition = computedStyle?.objectPosition || '50% 50%';

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return {
        height, index, objectFit, objectPosition, width,
      };
    }

    try {
      const canvas = video.ownerDocument.createElement('canvas');
      const preferredScale = Math.min(
        1,
        Math.sqrt(((Math.max(width, 1) * Math.max(height, 1)) * 4)
          / (video.videoWidth * video.videoHeight)),
      );
      const rasterSize = getBoundedRasterSize(
        video.videoWidth,
        video.videoHeight,
        preferredScale,
      );
      canvas.width = rasterSize.width;
      canvas.height = rasterSize.height;
      const context = canvas.getContext('2d');
      if (!context) {
        return {
          height, index, objectFit, objectPosition, width,
        };
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      return {
        dataUrl: canvas.toDataURL('image/png'),
        height,
        index,
        objectFit,
        objectPosition,
        width,
      };
    } catch {
      return {
        height, index, objectFit, objectPosition, width,
      };
    }
  }));
}

export function copyPdfElementState(sourceElement: HTMLElement, clonedElement: HTMLElement) {
  const sourceElements = [sourceElement, ...sourceElement.querySelectorAll<HTMLElement>('*')];
  const clonedElements = [clonedElement, ...clonedElement.querySelectorAll<HTMLElement>('*')];

  sourceElements.forEach((source, index) => {
    const clone = clonedElements[index];
    if (!clone) {
      return;
    }

    if (source instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
      clone.checked = source.checked;
      clone.indeterminate = source.indeterminate;
      clone.value = source.value;
    } else if (source instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
      Array.from(source.options).forEach((option, optionIndex) => {
        if (clone.options[optionIndex]) {
          clone.options[optionIndex].selected = option.selected;
        }
      });
      clone.selectedIndex = source.selectedIndex;
    } else if (source instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
      clone.value = source.value;
    }

    clone.scrollLeft = source.scrollLeft;
    clone.scrollTop = source.scrollTop;
  });
}

function mountPdfSource(element: HTMLElement, exportWidth: number) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.width = `${exportWidth}px`;
  host.style.pointerEvents = 'none';
  host.append(element);
  document.body.append(host);

  return host;
}

export function replacePdfIframesWithSnapshots(
  element: HTMLElement,
  iframeSnapshots: PdfIframeSnapshot[],
) {
  const iframes = Array.from(element.querySelectorAll('iframe'));

  return iframeSnapshots.flatMap((snapshot) => {
    const iframe = iframes[snapshot.index];
    if (!iframe) {
      return [];
    }

    const image = iframe.ownerDocument.createElement('img');
    image.alt = iframe.title || 'Embedded study content';
    image.src = snapshot.dataUrl;
    image.style.display = 'block';
    image.style.height = 'auto';
    image.style.objectFit = 'contain';
    image.style.objectPosition = 'top left';
    image.style.width = '100%';
    image.style.maxWidth = '100%';
    iframe.replaceWith(image);

    return [image];
  });
}

export function replacePdfCanvasesWithSnapshots(
  element: HTMLElement,
  canvasSnapshots: PdfCanvasSnapshot[],
) {
  const canvases = Array.from(element.querySelectorAll('canvas'));

  return canvasSnapshots.flatMap((snapshot) => {
    const canvas = canvases[snapshot.index];
    if (!canvas) {
      return [];
    }

    if (snapshot.dataUrl) {
      const image = canvas.ownerDocument.createElement('img');
      image.alt = canvas.getAttribute('aria-label') || 'Canvas visualization';
      image.src = snapshot.dataUrl;
      image.style.display = 'block';
      image.style.height = `${snapshot.height}px`;
      image.style.maxHeight = 'none';
      image.style.maxWidth = 'none';
      image.style.width = `${snapshot.width}px`;
      canvas.replaceWith(image);

      return [image];
    }

    const placeholder = canvas.ownerDocument.createElement('div');
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', 'Canvas unavailable in PDF');
    placeholder.textContent = 'Canvas unavailable in PDF';
    placeholder.style.alignItems = 'center';
    placeholder.style.backgroundColor = '#1f1f1f';
    placeholder.style.color = '#ffffff';
    placeholder.style.display = 'flex';
    placeholder.style.height = `${snapshot.height}px`;
    placeholder.style.justifyContent = 'center';
    placeholder.style.maxHeight = 'none';
    placeholder.style.maxWidth = 'none';
    placeholder.style.padding = '16px';
    placeholder.style.textAlign = 'center';
    placeholder.style.width = `${snapshot.width}px`;
    canvas.replaceWith(placeholder);

    return [];
  });
}

export function replacePdfVideosWithSnapshots(
  element: HTMLElement,
  videoSnapshots: PdfVideoSnapshot[],
) {
  const videos = Array.from(element.querySelectorAll('video'));

  return videoSnapshots.flatMap((snapshot) => {
    const video = videos[snapshot.index];
    if (!video) {
      return [];
    }

    const replacementTarget = video.closest<HTMLElement>('.plyr--video') ?? video;
    if (snapshot.dataUrl) {
      const image = video.ownerDocument.createElement('img');
      image.alt = 'Current video frame';
      image.src = snapshot.dataUrl;
      image.style.display = 'block';
      image.style.height = snapshot.height > 0 ? `${snapshot.height}px` : 'auto';
      image.style.maxWidth = '100%';
      image.style.objectFit = snapshot.objectFit;
      image.style.objectPosition = snapshot.objectPosition;
      image.style.width = snapshot.width > 0 ? `${snapshot.width}px` : '100%';
      replacementTarget.replaceWith(image);

      return [image];
    }

    const placeholder = video.ownerDocument.createElement('div');
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', 'Video frame unavailable in PDF');
    placeholder.textContent = 'Video frame unavailable in PDF';
    placeholder.style.alignItems = 'center';
    placeholder.style.aspectRatio = snapshot.width > 0 && snapshot.height > 0
      ? `${snapshot.width} / ${snapshot.height}`
      : '16 / 9';
    placeholder.style.backgroundColor = '#1f1f1f';
    placeholder.style.color = '#ffffff';
    placeholder.style.display = 'flex';
    placeholder.style.height = snapshot.height > 0 ? `${snapshot.height}px` : 'auto';
    placeholder.style.justifyContent = 'center';
    placeholder.style.maxWidth = '100%';
    placeholder.style.padding = '16px';
    placeholder.style.textAlign = 'center';
    placeholder.style.width = snapshot.width > 0 ? `${snapshot.width}px` : '100%';
    replacementTarget.replaceWith(placeholder);

    return [];
  });
}

export function preparePdfClone(
  clonedElement: HTMLElement,
  layout: {
    exportHeight?: number;
    exportWidth?: number;
    sidebarWidth?: number;
  } = {},
) {
  const exportRoot = clonedElement.matches('[data-pdf-export-root]')
    ? clonedElement
    : clonedElement.querySelector<HTMLElement>('[data-pdf-export-root]');

  if (!exportRoot) {
    return;
  }

  exportRoot.style.boxSizing = 'border-box';
  exportRoot.style.display = 'grid';
  exportRoot.style.width = layout.exportWidth ? `${layout.exportWidth}px` : '100%';
  exportRoot.style.maxWidth = 'none';
  exportRoot.style.padding = '16px 16px 32px';
  exportRoot.style.backgroundColor = 'white';

  const header = exportRoot.querySelector<HTMLElement>('[data-pdf-export-header]');
  if (header) {
    header.style.display = 'flex';
    header.style.gridColumn = '1 / -1';
  }

  const sidebar = exportRoot.querySelector<HTMLElement>('.sidebar');
  if (sidebar && sidebar.style.display !== 'none') {
    const sidebarWidth = layout.sidebarWidth
      ? `${layout.sidebarWidth}px`
      : sidebar.style.width || `${sidebar.getBoundingClientRect().width}px`;
    exportRoot.style.gridTemplateColumns = `${sidebarWidth} minmax(0, 1fr)`;
    exportRoot.style.columnGap = '10px';
    sidebar.style.gridColumn = '1';
    sidebar.style.marginTop = '0';
    sidebar.style.marginBottom = '0';
  } else {
    exportRoot.style.gridTemplateColumns = 'minmax(0, 1fr)';
  }

  const main = exportRoot.querySelector<HTMLElement>('.main');
  if (main) {
    main.style.boxSizing = 'border-box';
    main.style.gridColumn = sidebar && sidebar.style.display !== 'none' ? '2' : '1';
    main.style.width = '100%';
    main.style.minWidth = '0';
    main.style.minHeight = 'auto';
    main.style.paddingInline = '16px';
    main.style.paddingBottom = '32px';
  }

  if (layout.exportHeight && layout.exportWidth) {
    exportRoot.style.transform = '';
    exportRoot.style.transformOrigin = '';
    const contentWidth = Math.max(exportRoot.scrollWidth, exportRoot.offsetWidth);
    const contentHeight = Math.max(exportRoot.scrollHeight, exportRoot.offsetHeight);
    const scale = Math.min(
      layout.exportWidth / contentWidth,
      layout.exportHeight / contentHeight,
      1,
    );
    if (scale < 1) {
      exportRoot.style.transform = `scale(${scale})`;
      exportRoot.style.transformOrigin = 'top left';
    }
  }
}

export async function saveElementAsPdf(element: HTMLElement, filename: string) {
  const elementWidth = element.getBoundingClientRect().width;
  const initialExportWidth = Math.min(elementWidth, PDF_MAX_WIDTH_PX);
  const pageScale = elementWidth > 0 ? initialExportWidth / elementWidth : 1;
  const [canvasSnapshots, iframeSnapshots, videoSnapshots] = await Promise.all([
    Promise.resolve(capturePdfCanvasSnapshots(element)),
    capturePdfIframeSnapshots(element, pageScale),
    capturePdfVideoSnapshots(element),
  ]);
  const pdfSource = element.cloneNode(true) as HTMLElement;
  const sidebar = element.querySelector<HTMLElement>('.sidebar');
  const sidebarWidth = sidebar && isPdfRenderedElement(sidebar)
    ? sidebar.getBoundingClientRect().width
    : undefined;
  const pdfSourceHost = mountPdfSource(pdfSource, initialExportWidth);
  const existingPdfOverlays = new Set(document.querySelectorAll('.html2pdf__overlay'));

  try {
    copyPdfElementState(element, pdfSource);
    const canvasImages = replacePdfCanvasesWithSnapshots(pdfSource, canvasSnapshots);
    const iframeImages = replacePdfIframesWithSnapshots(pdfSource, iframeSnapshots);
    const videoImages = replacePdfVideosWithSnapshots(pdfSource, videoSnapshots);
    preparePdfClone(pdfSource, {
      exportWidth: initialExportWidth,
      sidebarWidth,
    });
    await Promise.all([...canvasImages, ...iframeImages, ...videoImages].map(waitForPdfImage));
    await waitForNextPaint();
    const exportRoot = pdfSource.matches('[data-pdf-export-root]')
      ? pdfSource
      : pdfSource.querySelector<HTMLElement>('[data-pdf-export-root]');
    const pageLayout = selectPdfPageLayout(
      Math.max(exportRoot?.scrollWidth ?? 0, exportRoot?.offsetWidth ?? 0),
      Math.max(exportRoot?.scrollHeight ?? 0, exportRoot?.offsetHeight ?? 0),
      initialExportWidth,
    );
    const { exportHeight, exportWidth, orientation } = pageLayout;
    pdfSourceHost.style.width = `${exportWidth}px`;
    preparePdfClone(pdfSource, {
      exportHeight,
      exportWidth,
      sidebarWidth,
    });

    const options = {
      margin: PDF_MARGIN_MM,
      filename,
      image: { type: 'jpeg' as const, quality: 0.95 },
      enableLinks: true,
      html2canvas: {
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (_clonedDocument: Document, clonedElement: HTMLElement) => {
          preparePdfClone(clonedElement, {
            exportHeight,
            exportWidth,
            sidebarWidth,
          });
        },
        scale: 2,
        useCORS: true,
        height: exportHeight,
        width: exportWidth,
        windowHeight: exportHeight,
        windowWidth: exportWidth,
      },
      jsPDF: {
        format: 'a4',
        orientation,
        unit: 'mm',
      },
    };

    await html2pdf().set(options).from(pdfSource).save();
  } finally {
    pdfSourceHost.remove();
    document.querySelectorAll('.html2pdf__overlay').forEach((overlay) => {
      if (!existingPdfOverlays.has(overlay)) {
        overlay.remove();
      }
    });
  }
}
