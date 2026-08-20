import {
  describe, expect, test, vi,
} from 'vitest';
import {
  buildPdfFilename, getPdfExportUnsupportedReason, preparePdfClone, saveElementAsPdf,
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

  test('prepares the cloned study layout without changing the live element', () => {
    const liveElement = document.createElement('div');
    liveElement.style.display = 'flex';
    liveElement.innerHTML = `
      <aside class="sidebar" style="display: block; width: 300px"></aside>
      <main class="main" style="width: calc(100% - 310px)"></main>
    `;
    const clonedElement = liveElement.cloneNode(true) as HTMLElement;

    preparePdfClone(clonedElement);

    expect(clonedElement.style.display).toBe('block');
    expect(clonedElement.querySelector<HTMLElement>('.sidebar')?.style.width).toBe('100%');
    expect(clonedElement.querySelector<HTMLElement>('.main')?.style.width).toBe('100%');
    expect(liveElement.style.display).toBe('flex');
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

    await saveElementAsPdf(element, 'introduction_2026-08-20T14-37-09.pdf');

    expect(html2PdfMocks.from).toHaveBeenCalledWith(element);
    expect(html2PdfMocks.save).toHaveBeenCalledTimes(1);
    expect(html2PdfMocks.set).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'introduction_2026-08-20T14-37-09.pdf',
      margin: 10,
      pagebreak: expect.objectContaining({
        avoid: expect.arrayContaining(['[data-question-id]']),
      }),
      jsPDF: expect.objectContaining({ format: 'a4', orientation: 'portrait' }),
    }));
  });
});
