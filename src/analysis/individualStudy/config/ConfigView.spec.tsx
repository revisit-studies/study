import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { ConfigView } from './ConfigView';

vi.mock('mantine-react-table', () => ({
  MantineReactTable: () => <div>config-table</div>,
  useMantineReactTable: () => ({ table: 'ok' }),
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: undefined }),
}));

vi.mock('react-router', () => ({
  useParams: () => ({ studyId: undefined }),
}));

vi.mock('../../../utils/handleDownloadFiles', () => ({
  downloadConfigFile: vi.fn(),
  downloadConfigFilesZip: vi.fn(),
}));

vi.mock('./utils', () => ({
  buildConfigRows: () => [],
}));

vi.mock('./ConfigDiffModal', () => ({
  ConfigDiffModal: () => <div>config-diff</div>,
}));

describe('ConfigView', () => {
  it('shows loading state on initial render', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ConfigView visibleParticipants={[]} />
      </MantineProvider>,
    );
    expect(html).toContain('Loading config data');
  });
});
