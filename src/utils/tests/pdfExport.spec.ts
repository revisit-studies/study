import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import {
  buildPdfFilename, capturePdfIframeSnapshots, capturePdfVideoSnapshots,
  getPdfExportUnsupportedReason, preparePdfClone, replacePdfIframesWithSnapshots,
  replacePdfVideosWithSnapshots, saveElementAsPdf,
  waitForNextPaint,
} from '../pdfExport';

const html2CanvasMocks = vi.hoisted(() => ({ capture: vi.fn() }));
const html2PdfMocks = vi.hoisted(() => ({
  from: vi.fn(),
  save: vi.fn(),
  set: vi.fn(),
}));

vi.mock('html2canvas', () => ({ default: html2CanvasMocks.capture }));

vi.mock('html2pdf.js', () => ({
  default: () => ({
    set: (options: unknown) => {
      html2PdfMocks.set(options);
      return {
        from: (element: HTMLElement) => {
          html2PdfMocks.from(element, element.isConnected);
          return { save: html2PdfMocks.save };
        },
      };
    },
  }),
}));

describe('PDF export helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('builds a filesystem-safe filename with the local export time', () => {
    const exportedAt = new Date(2026, 7, 20, 14, 37, 9);

    expect(buildPdfFilename('Form Elements / Trial #1', exportedAt))
      .toBe('Form-Elements-Trial-1_2026-08-20T14-37-09.pdf');
  });

  test('uses a readable fallback when the component name has no safe characters', () => {
    const exportedAt = new Date(2026, 0, 2, 3, 4, 5);

    expect(buildPdfFilename('   /:   ', exportedAt))
      .toBe('study-page_2026-01-02T03-04-05.pdf');
  });

  test('waits through two animation frames so pending UI can paint', async () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }));
    let resolved = false;
    const paintPromise = waitForNextPaint().then(() => {
      resolved = true;
    });

    callbacks.shift()?.(0);
    await Promise.resolve();
    expect(resolved).toBe(false);

    callbacks.shift()?.(16);
    await paintPromise;
    expect(resolved).toBe(true);
  });

  test('prepares the cloned study layout without changing the live element', () => {
    const liveElement = document.createElement('div');
    liveElement.setAttribute('data-pdf-export-root', '');
    liveElement.innerHTML = `
      <header data-pdf-export-header style="display: none"></header>
      <aside class="sidebar" style="display: block; width: 300px"></aside>
      <main class="main" style="width: calc(100% - 310px)"><iframe title="Chart"></iframe></main>
    `;
    const clonedContainer = document.createElement('div');
    clonedContainer.append(liveElement.cloneNode(true));

    Object.defineProperty(clonedContainer.firstElementChild, 'scrollHeight', { value: 1260 });
    const iframeImages = replacePdfIframesWithSnapshots(clonedContainer, [
      { dataUrl: 'data:image/png;base64,chart', index: 0 },
    ]);
    preparePdfClone(clonedContainer, {
      exportHeight: 630,
      exportWidth: 920,
      sidebarWidth: 300,
    });

    const clonedElement = clonedContainer.querySelector<HTMLElement>('[data-pdf-export-root]');
    expect(clonedElement?.style.padding).toBe('16px 16px 32px');
    expect(clonedElement?.style.display).toBe('grid');
    expect(clonedElement?.style.width).toBe('920px');
    expect(clonedElement?.style.gridTemplateColumns).toBe('300px minmax(0, 1fr)');
    expect(clonedElement?.querySelector<HTMLElement>('[data-pdf-export-header]')?.style.display).toBe('flex');
    expect(clonedElement?.querySelector<HTMLElement>('.sidebar')?.style.width).toBe('300px');
    expect(clonedElement?.querySelector<HTMLElement>('.main')?.style.gridColumn).toBe('2');
    expect(clonedElement?.querySelector<HTMLElement>('.main')?.style.width).toBe('100%');
    expect(clonedElement?.querySelector<HTMLElement>('.main')?.style.paddingInline).toBe('16px');
    expect(clonedElement?.querySelector<HTMLElement>('.main')?.style.paddingBottom).toBe('32px');
    const iframeImage = clonedElement?.querySelector<HTMLImageElement>('img[alt="Chart"]');
    expect(iframeImage?.src).toBe('data:image/png;base64,chart');
    expect(iframeImage?.style.width).toBe('100%');
    expect(iframeImage?.style.height).toBe('auto');
    expect(iframeImages).toEqual([iframeImage]);
    expect(clonedElement?.querySelector('iframe')).toBeNull();
    expect(clonedElement?.style.transform).toBe('scale(0.5)');
    expect(clonedElement?.style.transformOrigin).toBe('top left');
    expect(liveElement.querySelector<HTMLElement>('[data-pdf-export-header]')?.style.display).toBe('none');
    expect(liveElement.style.padding).toBe('');
  });

  test('identifies cross-origin iframes that cannot be captured', () => {
    const element = document.createElement('main');
    element.innerHTML = `
      <iframe src="/same-origin-content"></iframe>
      <iframe src="https://example.com/external-content"></iframe>
    `;

    expect(getPdfExportUnsupportedReason(element))
      .toBe('Pages containing external websites cannot currently be exported to PDF.');

    element.querySelector('iframe:last-child')?.remove();
    expect(getPdfExportUnsupportedReason(element)).toBeUndefined();
  });

  test('captures an accessible iframe document for the PDF clone', async () => {
    const element = document.createElement('main');
    const iframe = document.createElement('iframe');
    element.append(iframe);
    const iframeDocument = document.implementation.createHTMLDocument('Embedded chart');
    const sourceBase = iframeDocument.createElement('base');
    sourceBase.href = 'https://revisit.test/study/example/assets/';
    iframeDocument.head.prepend(sourceBase);
    Object.defineProperty(iframeDocument, 'styleSheets', {
      value: [{ cssRules: [{ cssText: '#chart { display: grid; }' }] }],
    });
    Object.defineProperty(iframe, 'contentDocument', { value: iframeDocument });
    Object.defineProperty(iframe, 'clientWidth', { value: 600 });
    Object.defineProperty(iframe, 'clientHeight', { value: 450 });
    Object.defineProperty(iframeDocument.documentElement, 'scrollWidth', { value: 600 });
    Object.defineProperty(iframeDocument.documentElement, 'scrollHeight', { value: 450 });
    const overflowingChart = iframeDocument.createElement('div');
    iframeDocument.body.append(overflowingChart);
    Object.defineProperty(overflowingChart, 'scrollWidth', { value: 1920 });
    Object.defineProperty(overflowingChart, 'scrollHeight', { value: 1080 });
    html2CanvasMocks.capture.mockResolvedValue({
      getContext: () => null,
      height: 0,
      toDataURL: () => 'data:image/png;base64,chart',
      width: 0,
    });

    await expect(capturePdfIframeSnapshots(element)).resolves.toEqual([
      { dataUrl: 'data:image/png;base64,chart', index: 0 },
    ]);
    expect(html2CanvasMocks.capture).toHaveBeenCalledWith(
      iframeDocument.documentElement,
      expect.objectContaining({
        height: 1080,
        width: 1920,
        windowHeight: 1080,
        windowWidth: 1920,
      }),
    );

    const captureOptions = html2CanvasMocks.capture.mock.calls[0][1] as {
      onclone: (clonedDocument: Document) => Promise<unknown>;
    };
    const clonedDocument = document.implementation.createHTMLDocument('Cloned chart');
    const stylesheet = clonedDocument.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'css/chart.css';
    clonedDocument.head.append(stylesheet);
    Object.defineProperty(stylesheet, 'sheet', { value: {} });
    await captureOptions.onclone(clonedDocument);

    expect(clonedDocument.querySelector('base')?.href)
      .toBe('https://revisit.test/study/example/assets/');
    expect(stylesheet.href).toBe('https://revisit.test/study/example/assets/css/chart.css');
    expect(clonedDocument.querySelector('style')?.textContent).toContain('display: grid');
    expect(clonedDocument.documentElement.style.width).toBe('1920px');
    expect(clonedDocument.documentElement.style.overflow).toBe('visible');
  });

  test('captures the current video frame for the PDF clone', async () => {
    const element = document.createElement('main');
    const video = document.createElement('video');
    element.append(video);
    Object.defineProperty(video, 'readyState', { value: HTMLMediaElement.HAVE_CURRENT_DATA });
    Object.defineProperty(video, 'videoWidth', { value: 1280 });
    Object.defineProperty(video, 'videoHeight', { value: 720 });
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({ height: 360, width: 640 } as DOMRect);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,video-frame');

    await expect(capturePdfVideoSnapshots(element)).resolves.toEqual([{
      dataUrl: 'data:image/png;base64,video-frame',
      height: 360,
      index: 0,
      width: 640,
    }]);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
  });

  test('replaces Plyr controls with the captured frame or a readable fallback', () => {
    const element = document.createElement('main');
    element.innerHTML = `
      <div class="plyr plyr--video"><video></video><button>Play</button></div>
      <div class="plyr plyr--video"><video></video><button>Play</button></div>
    `;

    const images = replacePdfVideosWithSnapshots(element, [
      {
        dataUrl: 'data:image/png;base64,video-frame', height: 360, index: 0, width: 640,
      },
      { height: 360, index: 1, width: 640 },
    ]);

    expect(element.querySelectorAll('video')).toHaveLength(0);
    expect(element.querySelectorAll('button')).toHaveLength(0);
    expect(images[0]?.alt).toBe('Current video frame');
    expect(images[0]?.style.width).toBe('640px');
    expect(element.querySelector('[aria-label="Video frame unavailable in PDF"]')?.textContent)
      .toBe('Video frame unavailable in PDF');
  });

  test('passes a prepared temporary clone and filename to html2pdf', async () => {
    html2PdfMocks.set.mockClear();
    html2PdfMocks.from.mockClear();
    html2PdfMocks.save.mockReset().mockResolvedValue(undefined);
    const element = document.createElement('main');
    element.setAttribute('data-pdf-export-root', '');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 2400 } as DOMRect);

    await saveElementAsPdf(element, 'introduction_2026-08-20T14-37-09.pdf');

    const pdfSource = html2PdfMocks.from.mock.calls[0][0] as HTMLElement;
    expect(pdfSource).not.toBe(element);
    expect(html2PdfMocks.from).toHaveBeenCalledWith(pdfSource, true);
    expect(pdfSource.style.width).toBe('920px');
    expect(pdfSource.style.display).toBe('grid');
    expect(pdfSource.isConnected).toBe(false);
    expect(element.style.width).toBe('');
    expect(html2PdfMocks.save).toHaveBeenCalledTimes(1);
    expect(html2PdfMocks.set).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'introduction_2026-08-20T14-37-09.pdf',
      margin: 10,
      html2canvas: expect.objectContaining({
        height: 631,
        width: 920,
        windowHeight: 631,
        windowWidth: 920,
      }),
      jsPDF: expect.objectContaining({ format: 'a4', orientation: 'landscape' }),
    }));

    const options = html2PdfMocks.set.mock.calls[0][0] as {
      html2canvas: { onclone: (document: Document, element: HTMLElement) => void };
    };
    const clonedElement = document.createElement('main');
    clonedElement.setAttribute('data-pdf-export-root', '');
    options.html2canvas.onclone(document, clonedElement);
    expect(clonedElement.style.width).toBe('920px');
  });
});
