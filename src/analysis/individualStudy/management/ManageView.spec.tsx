import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, it, vi,
} from 'vitest';
import { StageInfo } from '../../../storage/engines/types';
import { DataManagementItem } from './DataManagementItem';
import { ManageView } from './ManageView';
import { RevisitModesItem } from './RevisitModesItem';
import { StageManagementItem, validateStageName } from './StageManagementItem';

let mockedStorageEngine: object | undefined;

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockedStorageEngine }),
}));

vi.mock('../../../components/downloader/DownloadButtons', () => ({
  DownloadButtons: () => <div>download-buttons</div>,
}));

describe('ManageView', () => {
  it('renders stage and data management content', () => {
    mockedStorageEngine = {};

    const html = renderToStaticMarkup(
      <MantineProvider>
        <ManageView studyId="study-a" refresh={vi.fn()} />
      </MantineProvider>,
    );

    expect(html).toContain('Loading stage data');
    expect(html).toContain('Data Management');
  });
});

describe('DataManagementItem', () => {
  it('renders null when storage engine is unavailable', () => {
    mockedStorageEngine = undefined;
    const html = renderToStaticMarkup(<DataManagementItem studyId="study-a" refresh={vi.fn()} />);
    expect(html).toBe('');
  });

  it('renders management content when storage engine exists', () => {
    mockedStorageEngine = {};
    const html = renderToStaticMarkup(
      <MantineProvider>
        <DataManagementItem studyId="study-a" refresh={vi.fn()} />
      </MantineProvider>,
    );
    expect(html).toContain('Data Management');
    expect(html).toContain('No snapshots');
  });
});

describe('RevisitModesItem', () => {
  it('renders nothing before async mode data resolves', () => {
    mockedStorageEngine = undefined;
    const html = renderToStaticMarkup(<RevisitModesItem studyId="study-a" />);
    expect(html).toBe('');
  });
});

describe('StageManagementItem', () => {
  it('renders loading state before async data resolves', () => {
    mockedStorageEngine = undefined;
    const html = renderToStaticMarkup(
      <MantineProvider>
        <StageManagementItem studyId="study-a" />
      </MantineProvider>,
    );
    expect(html).toContain('Loading stage data');
  });
});

describe('validateStageName', () => {
  const existing: StageInfo[] = [{ stageName: 'DEFAULT', color: '#F05A30' }, { stageName: 'Pilot', color: '#000000' }];

  it('rejects empty stage name', () => {
    expect(validateStageName('   ', existing)).toBe('Stage name cannot be empty');
  });

  it('rejects reserved names', () => {
    expect(validateStageName('n/a', existing)).toContain('reserved');
    expect(validateStageName('all', existing)).toContain('reserved');
    expect(validateStageName('default', existing)).toContain('reserved');
  });

  it('rejects duplicates and allows unique values', () => {
    expect(validateStageName('Pilot', existing)).toBe('A stage with this name already exists');
    expect(validateStageName('Final', existing)).toBeNull();
  });
});
