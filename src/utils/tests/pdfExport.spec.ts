import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import {
  buildPdfFilename, capturePdfCanvasSnapshots, capturePdfIframeSnapshots,
  capturePdfVideoSnapshots,
  copyPdfElementState, getPdfExportUnsupportedReason, preparePdfClone,
  replacePdfIframesWithSnapshots,
  replacePdfCanvasesWithSnapshots, replacePdfVideosWithSnapshots, saveElementAsPdf,
  selectPdfPageLayout, waitForNextPaint,
} from '../pdfExport';

const html2CanvasMocks = vi.hoisted(() => ({ capture: vi.fn() }));
const html2PdfMocks = vi.hoisted(() => ({
  from: vi.fn(),
  save: vi.fn(),
  set: vi.fn(),
  toPdf: vi.fn(),
}));

vi.mock('html2canvas', () => ({ default: html2CanvasMocks.capture }));

vi.mock('html2pdf.js', () => ({
  default: () => ({
    set: (options: unknown) => {
      html2PdfMocks.set(options);
      return {
        from: (element: HTMLElement) => {
          html2PdfMocks.from(element, element.isConnected);
          return { save: html2PdfMocks.save, toPdf: html2PdfMocks.toPdf };
        },
      };
    },
  }),
}));

describe('PDF export helpers', () => {
  beforeEach(() => {
    html2CanvasMocks.capture.mockReset();
    html2PdfMocks.from.mockClear();
    html2PdfMocks.save.mockReset().mockResolvedValue(undefined);
    html2PdfMocks.set.mockClear();
    html2PdfMocks.toPdf.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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

  test('fits the cloned study layout by both width and height', () => {
    const clonedElement = document.createElement('main');
    clonedElement.setAttribute('data-pdf-export-root', '');
    Object.defineProperty(clonedElement, 'scrollWidth', { value: 1840 });
    Object.defineProperty(clonedElement, 'scrollHeight', { value: 630 });

    preparePdfClone(clonedElement, {
      exportHeight: 630,
      exportWidth: 920,
    });

    expect(clonedElement.style.transform).toBe('scale(0.5)');
    expect(clonedElement.style.transformOrigin).toBe('top left');
  });

  test('uses portrait only when it improves the fitted content scale by at least 30%', () => {
    expect(selectPdfPageLayout(920, 1100)).toEqual({
      exportHeight: 631,
      exportWidth: 920,
      orientation: 'landscape',
    });
    expect(selectPdfPageLayout(920, 1400)).toEqual({
      exportHeight: 1341,
      exportWidth: 920,
      orientation: 'portrait',
    });
    expect(selectPdfPageLayout(600, 900, 600)).toEqual({
      exportHeight: 874,
      exportWidth: 600,
      orientation: 'portrait',
    });
    expect(selectPdfPageLayout(920, 1195)).toEqual({
      exportHeight: 631,
      exportWidth: 920,
      orientation: 'landscape',
    });
    expect(selectPdfPageLayout(920, 1196)).toEqual({
      exportHeight: 1341,
      exportWidth: 920,
      orientation: 'portrait',
    });
  });

  test('identifies cross-origin iframes that cannot be captured', () => {
    const element = document.createElement('main');
    const sameOriginIframe = document.createElement('iframe');
    sameOriginIframe.src = '/same-origin-content';
    Object.defineProperty(sameOriginIframe, 'contentDocument', {
      value: document.implementation.createHTMLDocument('Same-origin content'),
    });
    const externalIframe = document.createElement('iframe');
    externalIframe.src = 'https://example.com/external-content';
    element.append(sameOriginIframe, externalIframe);

    expect(getPdfExportUnsupportedReason(element))
      .toBe('Pages containing external websites cannot currently be exported to PDF.');

    externalIframe.remove();
    expect(getPdfExportUnsupportedReason(element)).toBeUndefined();
  });

  test('rejects inaccessible and nested external iframe content', () => {
    const element = document.createElement('main');
    const sandboxedIframe = document.createElement('iframe');
    sandboxedIframe.srcdoc = '<p>Sandboxed content</p>';
    sandboxedIframe.setAttribute('sandbox', '');
    element.append(sandboxedIframe);

    expect(getPdfExportUnsupportedReason(element))
      .toBe('Pages containing external websites cannot currently be exported to PDF.');

    sandboxedIframe.remove();
    const outerIframe = document.createElement('iframe');
    outerIframe.src = '/hosted-content';
    const outerDocument = document.implementation.createHTMLDocument('Hosted content');
    const nestedIframe = outerDocument.createElement('iframe');
    nestedIframe.src = 'https://example.com/nested-content';
    outerDocument.body.append(nestedIframe);
    Object.defineProperty(outerIframe, 'contentDocument', { value: outerDocument });
    element.append(outerIframe);

    expect(getPdfExportUnsupportedReason(element))
      .toBe('Pages containing external websites cannot currently be exported to PDF.');
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
    vi.spyOn(iframe, 'getBoundingClientRect').mockReturnValue({ height: 450, width: 600 } as DOMRect);
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

    await expect(capturePdfIframeSnapshots(element, 1)).resolves.toEqual([
      { dataUrl: 'data:image/png;base64,chart', index: 0 },
    ]);
    expect(html2CanvasMocks.capture).toHaveBeenCalledWith(
      iframeDocument.documentElement,
      expect.objectContaining({
        height: 1080,
        scale: 0.625,
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
    const prepareClone = captureOptions.onclone(clonedDocument);
    stylesheet.dispatchEvent(new Event('load'));
    await prepareClone;

    expect(clonedDocument.querySelector('base')?.href)
      .toBe('https://revisit.test/study/example/assets/');
    expect(stylesheet.href).toBe('https://revisit.test/study/example/assets/css/chart.css');
    expect(clonedDocument.querySelector('style')?.textContent).toContain('display: grid');
    expect(clonedDocument.documentElement.style.width).toBe('1920px');
    expect(clonedDocument.documentElement.style.overflow).toBe('visible');
  });

  test('times out when embedded page resources never become ready', async () => {
    vi.useFakeTimers();
    const element = document.createElement('main');
    const iframe = document.createElement('iframe');
    const iframeDocument = document.implementation.createHTMLDocument('Stalled content');
    Object.defineProperty(iframeDocument, 'fonts', {
      value: { ready: new Promise<void>(() => {}) },
    });
    Object.defineProperty(iframe, 'contentDocument', { value: iframeDocument });
    element.append(iframe);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const capture = expect(capturePdfIframeSnapshots(element)).rejects
      .toThrow('Timed out while preparing embedded page content.');
    await vi.advanceTimersByTimeAsync(10000);

    await capture;
  });

  test('captures the current video frame for the PDF clone', async () => {
    const element = document.createElement('main');
    const video = document.createElement('video');
    video.style.objectFit = 'cover';
    video.style.objectPosition = '25% 75%';
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
      objectFit: 'cover',
      objectPosition: '25% 75%',
      width: 640,
    }]);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
  });

  test('captures canvas pixels and preserves their displayed size in the PDF clone', () => {
    const element = document.createElement('main');
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 600;
    canvas.setAttribute('aria-label', 'Node-link diagram');
    element.append(canvas);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ height: 300, width: 600 } as DOMRect);
    vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,canvas');

    const snapshots = capturePdfCanvasSnapshots(element);
    expect(snapshots).toEqual([{
      dataUrl: 'data:image/png;base64,canvas', height: 300, index: 0, width: 600,
    }]);

    const clonedElement = element.cloneNode(true) as HTMLElement;
    const images = replacePdfCanvasesWithSnapshots(clonedElement, snapshots);
    expect(clonedElement.querySelector('canvas')).toBeNull();
    expect(images[0]?.alt).toBe('Node-link diagram');
    expect(images[0]?.style.width).toBe('600px');
    expect(images[0]?.style.height).toBe('300px');
  });

  test('downsamples oversized source canvases before encoding them', () => {
    const element = document.createElement('main');
    const canvas = document.createElement('canvas');
    canvas.width = 10000;
    canvas.height = 10000;
    element.append(canvas);
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ height: 500, width: 500 } as DOMRect);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,canvas');

    expect(capturePdfCanvasSnapshots(element)).toEqual([{
      dataUrl: 'data:image/png;base64,canvas', height: 500, index: 0, width: 500,
    }]);
    expect(drawImage).toHaveBeenCalledWith(canvas, 0, 0, 1000, 1000);
  });

  test('rejects pages whose combined media exceeds the raster budget', () => {
    const element = document.createElement('main');
    Array.from({ length: 4 }).forEach(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 4000;
      canvas.height = 4000;
      element.append(canvas);
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,canvas');

    expect(() => capturePdfCanvasSnapshots(element))
      .toThrow('The study page contains too much media to export safely.');
  });

  test('uses a readable fallback when canvas pixels cannot be captured', () => {
    const element = document.createElement('main');
    element.append(document.createElement('canvas'));

    replacePdfCanvasesWithSnapshots(element, [{ height: 300, index: 0, width: 600 }]);

    expect(element.querySelector('canvas')).toBeNull();
    expect(element.querySelector('[aria-label="Canvas unavailable in PDF"]')?.textContent)
      .toBe('Canvas unavailable in PDF');
  });

  test('does not expose hidden rendering canvases in the PDF clone', () => {
    const element = document.createElement('main');
    const visibleCanvas = document.createElement('canvas');
    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.style.display = 'none';
    element.append(visibleCanvas, hiddenCanvas);
    vi.spyOn(visibleCanvas, 'toDataURL').mockReturnValue('data:image/png;base64,canvas');

    const snapshots = capturePdfCanvasSnapshots(element);
    expect(snapshots.map(({ index }) => index)).toEqual([0]);

    const clonedElement = element.cloneNode(true) as HTMLElement;
    replacePdfCanvasesWithSnapshots(clonedElement, snapshots);
    expect(clonedElement.querySelectorAll('canvas')).toHaveLength(1);
    expect((clonedElement.querySelector('canvas') as HTMLElement).style.display).toBe('none');
  });

  test('ignores media and external iframes beneath hidden ancestors', async () => {
    const element = document.createElement('main');
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.display = 'none';
    const canvas = document.createElement('canvas');
    const video = document.createElement('video');
    const iframe = document.createElement('iframe');
    iframe.src = 'https://example.com/external-content';
    hiddenContainer.append(canvas, video, iframe);
    element.append(hiddenContainer);

    expect(getPdfExportUnsupportedReason(element)).toBeUndefined();
    expect(capturePdfCanvasSnapshots(element)).toEqual([]);
    await expect(capturePdfVideoSnapshots(element)).resolves.toEqual([]);
    await expect(capturePdfIframeSnapshots(element)).resolves.toEqual([]);
  });

  test('copies current form and scroll state into the mounted PDF clone', () => {
    const source = document.createElement('main');
    source.innerHTML = `
      <select><option>First</option><option>Second</option></select>
      <div style="height: 20px; overflow: auto"><div style="height: 200px"></div></div>
    `;
    const sourceSelect = source.querySelector('select') as HTMLSelectElement;
    const sourceScroller = source.querySelector('div') as HTMLDivElement;
    sourceSelect.selectedIndex = 1;
    sourceScroller.scrollTop = 75;
    const clone = source.cloneNode(true) as HTMLElement;
    document.body.append(source, clone);

    copyPdfElementState(source, clone);

    expect(clone.querySelector('select')?.selectedIndex).toBe(1);
    expect((clone.querySelector('div') as HTMLDivElement).scrollTop).toBe(75);
  });

  test('replaces Plyr controls with the captured frame or a readable fallback', () => {
    const element = document.createElement('main');
    element.innerHTML = `
      <div class="plyr plyr--video"><video></video><button>Play</button></div>
      <div class="plyr plyr--video"><video></video><button>Play</button></div>
    `;

    const images = replacePdfVideosWithSnapshots(element, [
      {
        dataUrl: 'data:image/png;base64,video-frame',
        height: 360,
        index: 0,
        objectFit: 'cover',
        objectPosition: '25% 75%',
        width: 640,
      },
      {
        height: 360,
        index: 1,
        objectFit: 'contain',
        objectPosition: '50% 50%',
        width: 640,
      },
    ]);

    expect(element.querySelectorAll('video')).toHaveLength(0);
    expect(element.querySelectorAll('button')).toHaveLength(0);
    expect(images[0]?.alt).toBe('Current video frame');
    expect(images[0]?.style.width).toBe('640px');
    expect(images[0]?.style.height).toBe('360px');
    expect(images[0]?.style.objectFit).toBe('cover');
    expect(images[0]?.style.objectPosition).toBe('25% 75%');
    expect(element.querySelector('[aria-label="Video frame unavailable in PDF"]')?.textContent)
      .toBe('Video frame unavailable in PDF');
  });

  test('passes a prepared temporary clone and filename to html2pdf', async () => {
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
    expect(html2PdfMocks.toPdf).toHaveBeenCalledTimes(1);
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

  test('freezes the DOM clone before asynchronous media capture', async () => {
    let finishCapture: ((canvas: HTMLCanvasElement) => void) | undefined;
    html2CanvasMocks.capture.mockImplementationOnce(() => new Promise((resolve) => {
      finishCapture = resolve;
    }));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(600);
    const element = document.createElement('main');
    element.setAttribute('data-pdf-export-root', '');
    element.innerHTML = '<p data-export-state>Before capture</p>';
    const iframe = document.createElement('iframe');
    const iframeDocument = document.implementation.createHTMLDocument('Embedded content');
    Object.defineProperty(iframe, 'contentDocument', { value: iframeDocument });
    Object.defineProperty(iframe, 'contentWindow', {
      value: {
        requestAnimationFrame: (callback: FrameRequestCallback) => {
          callback(0);
          return 1;
        },
      },
    });
    Object.defineProperty(iframe, 'clientWidth', { value: 600 });
    Object.defineProperty(iframe, 'clientHeight', { value: 450 });
    vi.spyOn(iframe, 'getBoundingClientRect').mockReturnValue({ height: 450, width: 600 } as DOMRect);
    element.append(iframe);
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 920 } as DOMRect);

    const saving = saveElementAsPdf(element, 'frozen.pdf');
    await vi.waitFor(() => expect(html2CanvasMocks.capture).toHaveBeenCalledTimes(1));
    (element.querySelector('[data-export-state]') as HTMLElement).textContent = 'After capture';
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 450;
    vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,iframe');
    finishCapture?.(canvas);
    await saving;

    const pdfSource = html2PdfMocks.from.mock.calls[0][0] as HTMLElement;
    expect(pdfSource.querySelector('[data-export-state]')?.textContent).toBe('Before capture');
  });

  test('times out a stalled iframe raster and removes the temporary clone', async () => {
    vi.useFakeTimers();
    html2CanvasMocks.capture.mockReturnValueOnce(new Promise(() => {}));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const element = document.createElement('main');
    element.setAttribute('data-pdf-export-root', '');
    const iframe = document.createElement('iframe');
    const iframeDocument = document.implementation.createHTMLDocument('Embedded content');
    Object.defineProperty(iframe, 'contentDocument', { value: iframeDocument });
    Object.defineProperty(iframe, 'contentWindow', {
      value: {
        requestAnimationFrame: (callback: FrameRequestCallback) => {
          callback(0);
          return 1;
        },
      },
    });
    Object.defineProperty(iframe, 'clientWidth', { value: 600 });
    Object.defineProperty(iframe, 'clientHeight', { value: 450 });
    vi.spyOn(iframe, 'getBoundingClientRect').mockReturnValue({ height: 450, width: 600 } as DOMRect);
    element.append(iframe);
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 920 } as DOMRect);

    const saving = expect(saveElementAsPdf(element, 'stalled-iframe.pdf')).rejects
      .toThrow('PDF export timed out.');
    await vi.advanceTimersByTimeAsync(120000);
    await saving;

    expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  test('times out a stalled PDF render without starting a late download', async () => {
    vi.useFakeTimers();
    html2PdfMocks.toPdf.mockReturnValueOnce(new Promise(() => {}));
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const element = document.createElement('main');
    element.setAttribute('data-pdf-export-root', '');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 920 } as DOMRect);

    const saving = expect(saveElementAsPdf(element, 'stalled-pdf.pdf')).rejects
      .toThrow('PDF export timed out.');
    await vi.advanceTimersByTimeAsync(120000);
    await saving;

    expect(html2PdfMocks.save).not.toHaveBeenCalled();
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  test('removes only the html2pdf overlay created by a failed export', async () => {
    const existingOverlay = document.createElement('div');
    existingOverlay.className = 'html2pdf__overlay';
    document.body.append(existingOverlay);
    html2PdfMocks.save.mockImplementationOnce(() => {
      const failedOverlay = document.createElement('div');
      failedOverlay.className = 'html2pdf__overlay';
      document.body.append(failedOverlay);
      return Promise.reject(new Error('canvas failed'));
    });
    const element = document.createElement('main');
    element.setAttribute('data-pdf-export-root', '');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 920 } as DOMRect);

    await expect(saveElementAsPdf(element, 'failed.pdf')).rejects.toThrow('canvas failed');

    expect(Array.from(document.querySelectorAll('.html2pdf__overlay'))).toEqual([existingOverlay]);
  });
});
