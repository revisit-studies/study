import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import {
  buildPdfFilename, getPdfExportUnsupportedReason, preparePdfClone, saveElementAsPdf,
  waitForNextPaint,
} from '../pdfExport';

const html2PdfMocks = vi.hoisted(() => ({
  from: vi.fn(),
  save: vi.fn(),
  set: vi.fn(),
}));

vi.mock('html2pdf.js', () => ({
  default: () => ({
    set: (options: unknown) => {
      html2PdfMocks.set(options);
      return {
        from: (element: HTMLElement) => {
          html2PdfMocks.from(element);
          return { save: html2PdfMocks.save };
        },
      };
    },
  }),
}));

describe('PDF export helpers', () => {
  afterEach(() => {
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
      <main class="main" style="width: calc(100% - 310px)"></main>
    `;
    const clonedContainer = document.createElement('div');
    clonedContainer.append(liveElement.cloneNode(true));

    Object.defineProperty(clonedContainer.firstElementChild, 'scrollHeight', { value: 1260 });

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

  test('passes the current element and filename to html2pdf', async () => {
    html2PdfMocks.set.mockClear();
    html2PdfMocks.from.mockClear();
    html2PdfMocks.save.mockReset().mockResolvedValue(undefined);
    const element = document.createElement('main');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 2400 } as DOMRect);

    await saveElementAsPdf(element, 'introduction_2026-08-20T14-37-09.pdf');

    expect(html2PdfMocks.from).toHaveBeenCalledWith(element);
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
