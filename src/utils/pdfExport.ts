import html2pdf from 'html2pdf.js';

const PDF_MARGIN_MM = 10;
const PDF_MAX_WIDTH_PX = 920;

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

export function preparePdfClone(
  clonedElement: HTMLElement,
  layout: { exportWidth?: number; sidebarWidth?: number } = {},
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
}

export async function saveElementAsPdf(element: HTMLElement, filename: string) {
  const exportWidth = Math.min(element.getBoundingClientRect().width, PDF_MAX_WIDTH_PX);
  const sidebar = element.querySelector<HTMLElement>('.sidebar');
  const sidebarWidth = sidebar && sidebar.style.display !== 'none'
    ? sidebar.getBoundingClientRect().width
    : undefined;
  const options = {
    margin: PDF_MARGIN_MM,
    filename,
    image: { type: 'jpeg' as const, quality: 0.95 },
    enableLinks: true,
    pagebreak: {
      avoid: ['[data-question-id]', 'img', 'svg', 'canvas', 'video'],
      mode: ['css', 'legacy'],
    },
    html2canvas: {
      backgroundColor: '#ffffff',
      logging: false,
      onclone: (_clonedDocument: Document, clonedElement: HTMLElement) => {
        preparePdfClone(clonedElement, { exportWidth, sidebarWidth });
      },
      scale: 2,
      useCORS: true,
      width: exportWidth,
      windowWidth: exportWidth,
    },
    jsPDF: {
      format: 'a4',
      orientation: 'landscape' as const,
      unit: 'mm',
    },
  };

  await html2pdf().set(options).from(element).save();
}
