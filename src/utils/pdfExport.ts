import html2pdf from 'html2pdf.js';

const PDF_MARGIN_MM = 10;

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

export function preparePdfClone(clonedElement: HTMLElement) {
  clonedElement.style.display = 'block';
  clonedElement.style.width = '100%';
  clonedElement.style.maxWidth = 'none';
  clonedElement.style.backgroundColor = 'white';

  const sidebar = clonedElement.querySelector<HTMLElement>('.sidebar');
  if (sidebar && sidebar.style.display !== 'none') {
    sidebar.style.width = '100%';
    sidebar.style.minWidth = '0';
    sidebar.style.marginTop = '0';
    sidebar.style.marginBottom = '16px';
  }

  const main = clonedElement.querySelector<HTMLElement>('.main');
  if (main) {
    main.style.width = '100%';
    main.style.minHeight = 'auto';
    main.style.padding = '0';
  }
}

export async function saveElementAsPdf(element: HTMLElement, filename: string) {
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
        preparePdfClone(clonedElement);
      },
      scale: 2,
      useCORS: true,
    },
    jsPDF: {
      format: 'a4',
      orientation: 'portrait' as const,
      unit: 'mm',
    },
  };

  await html2pdf().set(options).from(element).save();
}
