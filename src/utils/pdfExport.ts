import html2canvas from 'html2canvas';
import html2pdf from 'html2pdf.js';

const PDF_MARGIN_MM = 10;
const PDF_MAX_WIDTH_PX = 920;
const A4_LANDSCAPE_WIDTH_MM = 297;
const A4_LANDSCAPE_HEIGHT_MM = 210;
const PDF_VIDEO_FRAME_WAIT_MS = 1500;
const PDF_PRINTABLE_ASPECT_RATIO = (A4_LANDSCAPE_HEIGHT_MM - (PDF_MARGIN_MM * 2))
  / (A4_LANDSCAPE_WIDTH_MM - (PDF_MARGIN_MM * 2));

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

export async function capturePdfIframeSnapshots(element: HTMLElement) {
  const iframes = Array.from(element.querySelectorAll('iframe'));

  return Promise.all(iframes.map(async (iframe, index): Promise<PdfIframeSnapshot> => {
    const iframeDocument = iframe.contentDocument;
    const iframeRoot = iframeDocument?.documentElement;
    if (!iframeDocument || !iframeRoot) {
      throw new Error('The embedded page is not available for PDF export.');
    }

    await iframeDocument.fonts?.ready;
    const bounds = iframe.getBoundingClientRect();
    const width = Math.ceil(iframe.clientWidth || bounds.width);
    const height = Math.ceil(iframe.clientHeight || bounds.height);
    if (width === 0 || height === 0) {
      throw new Error('The embedded page has no visible area to export.');
    }

    const canvas = await html2canvas(iframeRoot, {
      backgroundColor: '#ffffff',
      height,
      logging: false,
      scale: 2,
      useCORS: true,
      width,
      windowHeight: height,
      windowWidth: width,
    });

    return {
      dataUrl: canvas.toDataURL('image/png'),
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

function waitForPdfImage(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(new Error('The embedded page snapshot could not be loaded.')), { once: true });
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
