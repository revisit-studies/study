import html2canvas from 'html2canvas';
import html2pdf from 'html2pdf.js';

const PDF_MARGIN_MM = 10;
const PDF_MAX_WIDTH_PX = 920;
const A4_LANDSCAPE_WIDTH_MM = 297;
const A4_LANDSCAPE_HEIGHT_MM = 210;
const PDF_VIDEO_FRAME_WAIT_MS = 1500;
const PDF_LARGE_SVG_ELEMENT_THRESHOLD = 1000;
const PDF_SNAPSHOT_PADDING_PX = 32;
const PDF_WHITE_PIXEL_THRESHOLD = 250;
const PDF_PRINTABLE_ASPECT_RATIO = (A4_LANDSCAPE_HEIGHT_MM - (PDF_MARGIN_MM * 2))
  / (A4_LANDSCAPE_WIDTH_MM - (PDF_MARGIN_MM * 2));

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

export interface PdfVideoSnapshot {
  dataUrl?: string;
  height: number;
  index: number;
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

export function getPdfExportUnsupportedReason(element: HTMLElement) {
  const hasCrossOriginIframe = Array.from(element.querySelectorAll('iframe')).some((iframe) => {
    if (iframe.srcdoc || !iframe.getAttribute('src')) {
      return false;
    }

    try {
      return new URL(iframe.src, window.location.href).origin !== window.location.origin;
    } catch {
      return true;
    }
  });

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

    return new Promise<void>((resolve) => {
      stylesheet.addEventListener('load', () => resolve(), { once: true });
      stylesheet.addEventListener('error', () => resolve(), { once: true });
      stylesheet.href = absoluteHref;
    });
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

  return layoutElements.reduce((size, layoutElement) => {
    const bounds = layoutElement.getBoundingClientRect();
    return {
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
    height: Math.max(iframe.clientHeight, iframeBounds.height),
    width: Math.max(iframe.clientWidth, iframeBounds.width),
  });
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

function loadSvgImage(document: Document, source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement('img');
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('The SVG could not be rasterized.')), {
      once: true,
    });
    image.src = source;
  });
}

function waitForPdfImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(new Error('The embedded page snapshot could not be loaded.')), { once: true });
  });
}

async function captureSvgSnapshot(svg: SVGSVGElement, index: number) {
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
    canvas.width = width * 2;
    canvas.height = height * 2;
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

async function captureLargeSvgSnapshots(iframeDocument: Document) {
  const svgs = Array.from(iframeDocument.querySelectorAll<SVGSVGElement>('svg'));
  if (!svgs.some((svg) => (
    svg.querySelectorAll('*').length >= PDF_LARGE_SVG_ELEMENT_THRESHOLD
  ))) {
    return [];
  }

  const snapshots = await Promise.all(svgs.map(captureSvgSnapshot));

  return snapshots.filter((snapshot): snapshot is PdfSvgSnapshot => snapshot !== undefined);
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

function cropTrailingWhitespace(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || canvas.width === 0 || canvas.height === 0) {
    return canvas;
  }

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let contentRight = -1;
  let contentBottom = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const pixelIndex = ((y * canvas.width) + x) * 4;
      if (
        pixels[pixelIndex + 3] > 0
        && (
          pixels[pixelIndex] < PDF_WHITE_PIXEL_THRESHOLD
          || pixels[pixelIndex + 1] < PDF_WHITE_PIXEL_THRESHOLD
          || pixels[pixelIndex + 2] < PDF_WHITE_PIXEL_THRESHOLD
        )
      ) {
        contentRight = Math.max(contentRight, x);
        contentBottom = Math.max(contentBottom, y);
      }
    }
  }

  if (contentRight < 0 || contentBottom < 0) {
    return canvas;
  }

  const width = Math.min(canvas.width, contentRight + PDF_SNAPSHOT_PADDING_PX + 1);
  const height = Math.min(canvas.height, contentBottom + PDF_SNAPSHOT_PADDING_PX + 1);
  if (width === canvas.width && height === canvas.height) {
    return canvas;
  }

  const croppedCanvas = canvas.ownerDocument.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = height;
  croppedCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
  return croppedCanvas;
}

export async function capturePdfIframeSnapshots(element: HTMLElement) {
  const iframes = Array.from(element.querySelectorAll('iframe'));

  return Promise.all(iframes.map(async (iframe, index): Promise<PdfIframeSnapshot> => {
    const iframeDocument = iframe.contentDocument;
    const iframeRoot = iframeDocument?.documentElement;
    if (!iframeDocument || !iframeRoot) {
      throw new Error('The embedded page is not available for PDF export.');
    }

    await Promise.all([
      iframeDocument.fonts?.ready,
      waitForIframeImages(iframeDocument),
      waitForIframePaint(iframe),
    ]);
    const svgSnapshots = await captureLargeSvgSnapshots(iframeDocument);
    const captureSize = getIframeCaptureSize(iframe, iframeDocument);
    const width = Math.ceil(captureSize.width);
    const height = Math.ceil(captureSize.height);
    if (width === 0 || height === 0) {
      throw new Error('The embedded page has no visible area to export.');
    }

    const canvas = await html2canvas(iframeRoot, {
      backgroundColor: '#ffffff',
      height,
      logging: false,
      onclone: async (clonedDocument) => {
        await prepareIframeClone(clonedDocument, iframeDocument, width);
        await replaceLargeSvgsWithSnapshots(clonedDocument, svgSnapshots);
      },
      scale: 2,
      useCORS: true,
      width,
      windowHeight: height,
      windowWidth: width,
    });

    return {
      dataUrl: cropTrailingWhitespace(canvas).toDataURL('image/png'),
      index,
    };
  }));
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

  return Promise.all(videos.map(async (video, index): Promise<PdfVideoSnapshot> => {
    await waitForVideoFrame(video);
    const bounds = video.getBoundingClientRect();
    const width = Math.ceil(bounds.width || video.videoWidth);
    const height = Math.ceil(bounds.height || video.videoHeight);

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return { height, index, width };
    }

    try {
      const canvas = video.ownerDocument.createElement('canvas');
      const captureWidth = Math.min(
        video.videoWidth,
        Math.max(width * 2, 1),
        PDF_MAX_WIDTH_PX * 2,
      );
      canvas.width = captureWidth;
      canvas.height = Math.round(captureWidth * (video.videoHeight / video.videoWidth));
      const context = canvas.getContext('2d');
      if (!context) {
        return { height, index, width };
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      return {
        dataUrl: canvas.toDataURL('image/png'),
        height,
        index,
        width,
      };
    } catch {
      return { height, index, width };
    }
  }));
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
      image.style.height = 'auto';
      image.style.maxWidth = '100%';
      image.style.objectFit = 'contain';
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

  if (layout.exportHeight && exportRoot.scrollHeight > layout.exportHeight) {
    const scale = layout.exportHeight / exportRoot.scrollHeight;
    exportRoot.style.transform = `scale(${scale})`;
    exportRoot.style.transformOrigin = 'top left';
  }
}

export async function saveElementAsPdf(element: HTMLElement, filename: string) {
  const exportWidth = Math.min(element.getBoundingClientRect().width, PDF_MAX_WIDTH_PX);
  const exportHeight = Math.floor(exportWidth * PDF_PRINTABLE_ASPECT_RATIO);
  const [iframeSnapshots, videoSnapshots] = await Promise.all([
    capturePdfIframeSnapshots(element),
    capturePdfVideoSnapshots(element),
  ]);
  const pdfSource = element.cloneNode(true) as HTMLElement;
  const iframeImages = replacePdfIframesWithSnapshots(pdfSource, iframeSnapshots);
  const videoImages = replacePdfVideosWithSnapshots(pdfSource, videoSnapshots);
  const sidebar = element.querySelector<HTMLElement>('.sidebar');
  const sidebarWidth = sidebar && sidebar.style.display !== 'none'
    ? sidebar.getBoundingClientRect().width
    : undefined;
  const pdfSourceHost = mountPdfSource(pdfSource, exportWidth);

  try {
    preparePdfClone(pdfSource, {
      exportWidth,
      sidebarWidth,
    });
    await Promise.all([...iframeImages, ...videoImages].map(waitForPdfImage));
    await waitForNextPaint();
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
        orientation: 'landscape' as const,
        unit: 'mm',
      },
    };

    await html2pdf().set(options).from(pdfSource).save();
  } finally {
    pdfSourceHost.remove();
  }
}
