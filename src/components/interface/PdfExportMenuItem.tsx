import { Menu } from '@mantine/core';
import { IconFileTypePdf } from '@tabler/icons-react';

export function PdfExportMenuItem({
  isExportingPdf,
  onExportPdf,
}: {
  isExportingPdf: boolean;
  onExportPdf: () => Promise<void> | void;
}) {
  return (
    <Menu.Item
      leftSection={<IconFileTypePdf size={14} />}
      disabled={isExportingPdf}
      onClick={onExportPdf}
    >
      {isExportingPdf ? 'Exporting PDF…' : 'Export page as PDF'}
    </Menu.Item>
  );
}
