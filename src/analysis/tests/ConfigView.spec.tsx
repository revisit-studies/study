import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, screen, act, cleanup, fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ParticipantData } from '../../storage/types';
import { ConfigInfo } from '../individualStudy/config/utils';
import { ConfigView } from '../individualStudy/config/ConfigView';
import { downloadConfigFile, downloadConfigFilesZip } from '../../utils/handleDownloadFiles';

function makeParticipant(configHash: string): ParticipantData {
  return {
    participantId: 'p1',
    participantConfigHash: configHash,
    sequence: {
      id: 'root', order: 'fixed', orderPath: 'root', components: [], skip: [], interruptions: [],
    },
    participantIndex: 0,
    answers: {},
    searchParams: {},
    metadata: {
      userAgent: '', resolution: { width: 0, height: 0 }, language: '', ip: '',
    },
    completed: false,
    rejected: false,
    participantTags: [],
    stage: 'DEFAULT',
  } as ParticipantData;
}

// Capture what gets passed to useMantineReactTable so we can test columns / options
type CapturedTableOptions = Record<string, unknown> & {
  columns: { id?: string; header?: string; accessorKey?: string; Cell: (arg: Record<string, unknown>) => unknown }[];
  enableRowSelection: boolean;
  enableRowVirtualization: boolean;
  enablePagination: boolean;
  enableDensityToggle: boolean;
  onRowSelectionChange: (sel: Record<string, boolean>) => void;
  renderTopToolbarCustomActions: () => ReactNode;
};

let capturedTableOptions: CapturedTableOptions | null = null;

let mockStorageEngine: { getAllConfigsFromHash: ReturnType<typeof vi.fn> } | undefined;

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('mantine-react-table', () => ({
  useMantineReactTable: (options: CapturedTableOptions) => {
    capturedTableOptions = options;
    return {};
  },
  MantineReactTable: () => <div>table</div>,
}));

vi.mock('@mantine/core', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Space: () => <div />,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Tooltip: ({ label, children }: { label: string; children: ReactNode }) => <div title={label}>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Modal: ({ opened, children }: { opened: boolean; children: ReactNode }) => (opened ? <div>{children}</div> : null),
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Loader: () => <div>Loading...</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Paper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconInfoCircle: () => <span>info</span>,
  IconDownload: () => <span>download</span>,
  IconEye: () => <span>eye</span>,
  IconArrowsLeftRight: () => <span>compare</span>,
  IconCopy: () => <span>copy</span>,
}));

vi.mock('../../utils/handleDownloadFiles', () => ({
  downloadConfigFile: vi.fn().mockResolvedValue(undefined),
  downloadConfigFilesZip: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../individualStudy/config/ConfigDiffModal', () => ({
  ConfigDiffModal: () => <div>diff modal</div>,
}));

const mockConfigInfo: ConfigInfo = {
  hash: 'abcdef1234567890',
  version: '1.0.0',
  date: '2026-01-01',
  timeFrame: 'N/A',
  participantCount: 2,
  config: { studyMetadata: { version: '1.0.0', date: '2026-01-01' } } as ConfigInfo['config'],
};

describe('ConfigView', () => {
  beforeEach(() => {
    capturedTableOptions = null;
    mockStorageEngine = {
      getAllConfigsFromHash: vi.fn().mockResolvedValue({ [mockConfigInfo.hash]: mockConfigInfo.config }),
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ── SSR / static rendering ───────────────────────────────────────────────

  test('shows loader in initial loading state', () => {
    const html = renderToStaticMarkup(
      <ConfigView visibleParticipants={[]} studyId="test-study" />,
    );
    expect(html).toContain('Loading config data...');
  });

  test('renders without crashing when no storageEngine is provided', () => {
    mockStorageEngine = undefined;
    const html = renderToStaticMarkup(
      <ConfigView visibleParticipants={[]} studyId="test-study" />,
    );
    expect(html).toContain('Loading config data...');
  });

  test('renders without crashing when studyId is omitted', () => {
    const html = renderToStaticMarkup(<ConfigView visibleParticipants={[]} />);
    expect(html).toContain('Loading config data...');
  });

  test('useMantineReactTable is configured with row selection and virtual scroll', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    expect(capturedTableOptions).not.toBeNull();
    expect(capturedTableOptions!.enableRowSelection).toBe(true);
    expect(capturedTableOptions!.enableRowVirtualization).toBe(true);
    expect(capturedTableOptions!.enablePagination).toBe(false);
    expect(capturedTableOptions!.enableDensityToggle).toBe(false);
  });

  test('table columns include expected headers', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const headers = capturedTableOptions!.columns.map((c: { header: string }) => c.header);
    expect(headers).toContain('#');
    expect(headers).toContain('Version');
    expect(headers).toContain('Hash');
    expect(headers).toContain('Date');
    expect(headers).toContain('Time Frame');
    expect(headers).toContain('Participants');
    expect(headers).toContain('Actions');
  });

  test('configIndex column Cell renders row number', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const col = capturedTableOptions!.columns.find((c: { id?: string }) => c.id === 'configIndex');
    expect(col.Cell({ row: { index: 0 } })).toBe(1);
    expect(col.Cell({ row: { index: 4 } })).toBe(5);
  });

  test('version column Cell renders version text', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const col = capturedTableOptions!.columns.find((c: { accessorKey?: string }) => c.accessorKey === 'version');
    const html = renderToStaticMarkup(col.Cell({ row: { original: { version: '2.5.0' } as ConfigInfo } }));
    expect(html).toContain('2.5.0');
  });

  test('hash column Cell renders truncated hash and copy tooltip', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const col = capturedTableOptions!.columns.find((c: { accessorKey?: string }) => c.accessorKey === 'hash');
    const html = renderToStaticMarkup(col.Cell({ row: { original: { hash: 'abcdef1234567890' } as ConfigInfo } }));
    expect(html).toContain('abcdef');
    expect(html).toContain('Copy hash');
  });

  test('actions column Cell renders View and Download buttons', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const col = capturedTableOptions!.columns.find((c: { id?: string }) => c.id === 'actions');
    const html = renderToStaticMarkup(col.Cell({ cell: { getValue: () => 'hashA' } }));
    expect(html).toContain('View');
    expect(html).toContain('Download');
  });

  test('renderTopToolbarCustomActions renders nothing when no rows are checked', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const html = renderToStaticMarkup(capturedTableOptions!.renderTopToolbarCustomActions());
    expect(html).not.toContain('Download Configs');
    expect(html).not.toContain('Compare');
  });

  // ── useEffect: post-mount state transitions ──────────────────────────────

  test('useEffect clears configs and stops loading when storageEngine is missing', async () => {
    mockStorageEngine = undefined;
    await act(async () => {
      render(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    });
    expect(screen.getByText('No data available')).toBeDefined();
  });

  test('useEffect clears configs and stops loading when studyId is missing', async () => {
    await act(async () => {
      render(<ConfigView visibleParticipants={[]} />);
    });
    expect(screen.getByText('No data available')).toBeDefined();
  });

  test('useEffect fetches configs and renders table when storageEngine and studyId are present', async () => {
    const participants = [makeParticipant(mockConfigInfo.hash)];
    await act(async () => {
      render(<ConfigView visibleParticipants={participants} studyId="test-study" />);
    });
    expect(mockStorageEngine!.getAllConfigsFromHash).toHaveBeenCalledWith(
      [mockConfigInfo.hash],
      'test-study',
    );
    expect(screen.getByText('table')).toBeDefined();
  });

  test('useEffect sets empty configs and stops loading when fetch throws', async () => {
    mockStorageEngine!.getAllConfigsFromHash.mockRejectedValue(new Error('network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    await act(async () => {
      render(<ConfigView visibleParticipants={[makeParticipant('x')]} studyId="test-study" />);
    });
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching configs:', expect.any(Error));
    expect(screen.getByText('No data available')).toBeDefined();
  });

  // ── useCallback handlers ─────────────────────────────────────────────────

  test('handleCopyHash writes to clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const hashCol = capturedTableOptions!.columns.find(
      (c: { accessorKey?: string }) => c.accessorKey === 'hash',
    );

    const { container } = render(
      hashCol.Cell({ row: { original: { hash: 'abcdef1234' } as ConfigInfo } }),
    );
    fireEvent.click(container.querySelector('button')!);

    expect(writeText).toHaveBeenCalledWith('abcdef1234');
  });

  test('handleDownloadConfig calls downloadConfigFile with correct args', async () => {
    const participants = [makeParticipant(mockConfigInfo.hash)];
    await act(async () => {
      render(<ConfigView visibleParticipants={participants} studyId="test-study" />);
    });

    const col = capturedTableOptions!.columns.find((c: { id?: string }) => c.id === 'actions');
    const user = userEvent.setup();
    const { getAllByText } = render(col.Cell({ cell: { getValue: () => mockConfigInfo.hash } }));
    await user.click(getAllByText('Download')[0]);

    expect(downloadConfigFile).toHaveBeenCalledWith({
      studyId: 'test-study',
      hash: mockConfigInfo.hash,
      config: mockConfigInfo.config,
    });
  });

  test('handleDownloadConfigs calls downloadConfigFilesZip with selected hashes', async () => {
    const participants = [makeParticipant(mockConfigInfo.hash)];
    await act(async () => {
      render(<ConfigView visibleParticipants={participants} studyId="test-study" />);
    });
    await act(async () => {
      capturedTableOptions!.onRowSelectionChange({ [mockConfigInfo.hash]: true });
    });

    const toolbar = renderToStaticMarkup(capturedTableOptions!.renderTopToolbarCustomActions());
    expect(toolbar).toContain('Download Configs');

    const user = userEvent.setup();
    const { getByText } = render(capturedTableOptions!.renderTopToolbarCustomActions());
    await user.click(getByText(/Download Configs/));

    expect(downloadConfigFilesZip).toHaveBeenCalledWith(expect.objectContaining({
      studyId: 'test-study',
      hashes: [mockConfigInfo.hash],
    }));
  });

  test('handleCompareConfigs opens compare modal when two rows are selected', async () => {
    const participants = [makeParticipant(mockConfigInfo.hash)];
    await act(async () => {
      render(<ConfigView visibleParticipants={participants} studyId="test-study" />);
    });

    await act(async () => {
      capturedTableOptions!.onRowSelectionChange({ hashA: true, hashB: true });
    });

    const toolbar = renderToStaticMarkup(capturedTableOptions!.renderTopToolbarCustomActions());
    expect(toolbar).toContain('Compare');

    const user = userEvent.setup();
    const { getByText } = render(capturedTableOptions!.renderTopToolbarCustomActions());
    await user.click(getByText('Compare'));

    // Compare button should open the diff modal
    expect(screen.getByText('diff modal')).toBeDefined();
  });

  test('handleViewConfig opens view modal when View button is clicked', async () => {
    await act(async () => {
      render(<ConfigView visibleParticipants={[makeParticipant(mockConfigInfo.hash)]} studyId="test-study" />);
    });

    const col = capturedTableOptions!.columns.find((c: { id?: string }) => c.id === 'actions');
    const user = userEvent.setup();
    const { getAllByText } = render(col.Cell({ cell: { getValue: () => mockConfigInfo.hash } }));

    await act(async () => {
      await user.click(getAllByText('View')[0]);
    });

    const body = document.body.textContent || '';
    expect(body).toContain('studyMetadata');
    expect(body).toContain('1.0.0');
    expect(body).toContain('2026-01-01');
  });
});
