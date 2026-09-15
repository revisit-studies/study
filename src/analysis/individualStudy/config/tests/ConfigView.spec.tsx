import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, screen, act, cleanup, fireEvent, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ConfigInfo } from '../utils';
import { ConfigView } from '../ConfigView';
import { downloadConfigFile, downloadConfigFilesZip } from '../../../../utils/handleDownloadFiles';
import { makeParticipant } from '../../../../tests/utils';

// Capture what gets passed to useMantineReactTable so we can test columns / options
type CapturedTableOptions = Record<string, unknown> & {
  data: ConfigInfo[];
  columns: { id?: string; header: string; accessorKey?: string; Cell: (arg: Record<string, unknown>) => ReactNode }[];
  enableRowSelection: boolean;
  enableRowVirtualization: boolean;
  enablePagination: boolean;
  enableDensityToggle: boolean;
  onRowSelectionChange: (sel: Record<string, boolean>) => void;
  renderTopToolbarCustomActions: () => ReactNode;
};

let capturedTableOptions: CapturedTableOptions | null = null;

let mockStorageEngine: { getAllConfigsFromHash: ReturnType<typeof vi.fn> } | undefined;

vi.mock('../../../../storage/storageEngineHooks', () => ({
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
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
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

vi.mock('../../../../utils/handleDownloadFiles', () => ({
  downloadConfigFile: vi.fn().mockResolvedValue(undefined),
  downloadConfigFilesZip: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../ConfigDiffModal', () => ({
  ConfigDiffModal: () => <div>diff modal</div>,
}));

const mockConfigInfo: ConfigInfo = {
  hash: 'abcdef1234567890',
  version: '1.0.0',
  date: '2026-04-08',
  timeFrame: 'N/A',
  participantCount: 2,
  config: { studyMetadata: { version: '1.0.0', date: '2026-04-08' } } as ConfigInfo['config'],
};

describe('ConfigView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const col = capturedTableOptions!.columns.find((c) => c.id === 'configIndex');
    expect(col).toBeDefined();
    if (!col) return;
    expect(col.Cell({ row: { index: 0 } })).toBe(1);
    expect(col.Cell({ row: { index: 4 } })).toBe(5);
  });

  test('version column Cell renders version text', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const col = capturedTableOptions!.columns.find((c) => c.accessorKey === 'version');
    expect(col).toBeDefined();
    if (!col) return;
    const html = renderToStaticMarkup(col.Cell({ row: { original: { version: '2.5.0' } as ConfigInfo } }));
    expect(html).toContain('2.5.0');
  });

  test('hash column Cell renders truncated hash and copy tooltip', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const col = capturedTableOptions!.columns.find((c) => c.accessorKey === 'hash');
    expect(col).toBeDefined();
    if (!col) return;
    const html = renderToStaticMarkup(col.Cell({ row: { original: { hash: 'abcdef1234567890' } as ConfigInfo } }));
    expect(html).toContain('abcdef');
    expect(html).toContain('Copy hash');
  });

  test('actions column Cell renders View and Download buttons', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const col = capturedTableOptions!.columns.find((c) => c.id === 'actions');
    expect(col).toBeDefined();
    if (!col) return;
    const html = renderToStaticMarkup(col.Cell({ cell: { getValue: () => 'hashA' } }));
    expect(html).toContain('View');
    expect(html).toContain('Download');
  });

  test('renderTopToolbarCustomActions renders nothing when no rows are checked', () => {
    renderToStaticMarkup(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    const html = renderToStaticMarkup(capturedTableOptions!.renderTopToolbarCustomActions());
    expect(html).not.toContain('Download Config');
    expect(html).not.toContain('Compare');
  });

  // ── useEffect: post-mount state transitions ──────────────────────────────

  test.each([true, false])('shows config guidance when saved configs exist: %s', async (hasConfigs) => {
    mockStorageEngine!.getAllConfigsFromHash.mockResolvedValue(
      hasConfigs ? { [mockConfigInfo.hash]: mockConfigInfo.config } : {},
    );

    await act(async () => {
      render(<ConfigView visibleParticipants={[]} studyId="test-study" currentConfigHash={hasConfigs ? mockConfigInfo.hash : undefined} />);
    });

    expect(screen.getByText('View, download, and compare saved Study Config versions.')).toBeDefined();
    expect(screen.queryByText('table') !== null).toBe(hasConfigs);
    expect(screen.queryByText('No Study Configs have been saved yet.') !== null).toBe(!hasConfigs);
    expect(screen.queryByText('Unable to load saved Study Config versions. Please try again.')).toBeNull();
  });

  test('fetches and shows the current config with zero participants', async () => {
    await act(async () => {
      render(<ConfigView visibleParticipants={[]} studyId="test-study" currentConfigHash={mockConfigInfo.hash} />);
    });

    expect(mockStorageEngine!.getAllConfigsFromHash).toHaveBeenCalledWith([mockConfigInfo.hash], 'test-study');
    expect(screen.getByText('table')).toBeDefined();
    expect(capturedTableOptions!.data).toEqual([
      expect.objectContaining({ hash: mockConfigInfo.hash, participantCount: 0, timeFrame: 'N/A' }),
    ]);

    const versionColumn = capturedTableOptions!.columns.find((column) => column.accessorKey === 'version')!;
    render(versionColumn.Cell({ row: { original: capturedTableOptions!.data[0] } }));
    expect(screen.getByText('Current')).toBeDefined();
  });

  test('keeps the current config and updates row details when participant filters change', async () => {
    const oldHash = 'old-config-hash';
    const savedConfigs: Record<string, ConfigInfo['config']> = {
      [mockConfigInfo.hash]: mockConfigInfo.config,
      [oldHash]: mockConfigInfo.config,
    };
    mockStorageEngine!.getAllConfigsFromHash.mockImplementation(async (hashes: string[]) => (
      Object.fromEntries(hashes.map((hash) => [hash, savedConfigs[hash]]))
    ));
    const participants = [
      makeParticipant({ participantConfigHash: mockConfigInfo.hash, createdTime: 1700000000000 }),
      makeParticipant({ participantConfigHash: oldHash }),
    ];
    const { rerender } = render(
      <ConfigView visibleParticipants={participants} studyId="test-study" currentConfigHash={mockConfigInfo.hash} />,
    );
    await waitFor(() => {
      expect(capturedTableOptions!.data.find((config) => config.hash === mockConfigInfo.hash))
        .toEqual(expect.objectContaining({ participantCount: 1, timeFrame: expect.not.stringMatching(/^N\/A$/) }));
    });

    await act(async () => {
      rerender(<ConfigView visibleParticipants={[participants[1]]} studyId="test-study" currentConfigHash={mockConfigInfo.hash} />);
    });
    expect(mockStorageEngine!.getAllConfigsFromHash).toHaveBeenLastCalledWith([mockConfigInfo.hash, oldHash], 'test-study');
    expect(capturedTableOptions!.data).toEqual([
      expect.objectContaining({ hash: mockConfigInfo.hash, participantCount: 0, timeFrame: 'N/A' }),
      expect.objectContaining({ hash: oldHash, participantCount: 1 }),
    ]);

    await act(async () => {
      rerender(<ConfigView visibleParticipants={[]} studyId="test-study" currentConfigHash={mockConfigInfo.hash} />);
    });
    expect(mockStorageEngine!.getAllConfigsFromHash).toHaveBeenLastCalledWith([mockConfigInfo.hash], 'test-study');
    expect(capturedTableOptions!.data).toEqual([
      expect.objectContaining({ hash: mockConfigInfo.hash, participantCount: 0, timeFrame: 'N/A' }),
    ]);
    expect(screen.getByText('table')).toBeDefined();
  });

  test('useEffect clears configs and stops loading when storageEngine is missing', async () => {
    mockStorageEngine = undefined;
    await act(async () => {
      render(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    });
    expect(screen.getByText('Unable to load saved Study Config versions. Please try again.')).toBeDefined();
  });

  test('useEffect clears configs and stops loading when studyId is missing', async () => {
    await act(async () => {
      render(<ConfigView visibleParticipants={[]} />);
    });
    expect(screen.getByText('Unable to load saved Study Config versions. Please try again.')).toBeDefined();
  });

  test('useEffect fetches configs and renders table when storageEngine and studyId are present', async () => {
    const participants = [makeParticipant({ participantConfigHash: mockConfigInfo.hash })];
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
      render(<ConfigView visibleParticipants={[makeParticipant({ participantConfigHash: 'x' })]} studyId="test-study" />);
    });
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching configs:', expect.any(Error));
    expect(screen.getByText('Unable to load saved Study Config versions. Please try again.')).toBeDefined();
    expect(screen.queryByText('No Study Configs have been saved yet.')).toBeNull();
  });

  test('clears the load error after a successful fetch with no saved configs', async () => {
    mockStorageEngine!.getAllConfigsFromHash.mockRejectedValueOnce(new Error('network error')).mockResolvedValue({});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(<ConfigView visibleParticipants={[]} studyId="test-study" />);
    await screen.findByText('Unable to load saved Study Config versions. Please try again.');

    await act(async () => {
      rerender(<ConfigView visibleParticipants={[]} studyId="another-study" />);
    });

    expect(screen.getByText('No Study Configs have been saved yet.')).toBeDefined();
    expect(screen.queryByText('Unable to load saved Study Config versions. Please try again.')).toBeNull();
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
      (c) => c.accessorKey === 'hash',
    );
    expect(hashCol).toBeDefined();
    if (!hashCol) return;

    const { container } = render(
      hashCol.Cell({ row: { original: { hash: 'abcdef1234' } as ConfigInfo } }),
    );
    fireEvent.click(container.querySelector('button')!);

    expect(writeText).toHaveBeenCalledWith('abcdef1234');
  });

  test.each([true, false])('downloads the current config with participants: %s', async (hasParticipants) => {
    const participants = hasParticipants ? [makeParticipant({ participantConfigHash: mockConfigInfo.hash })] : [];
    await act(async () => {
      render(<ConfigView visibleParticipants={participants} studyId="test-study" currentConfigHash={mockConfigInfo.hash} />);
    });

    const col = capturedTableOptions!.columns.find((c) => c.id === 'actions');
    expect(col).toBeDefined();
    if (!col) return;
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
    const participants = [makeParticipant({ participantConfigHash: mockConfigInfo.hash })];
    await act(async () => {
      render(<ConfigView visibleParticipants={participants} studyId="test-study" />);
    });
    await act(async () => {
      capturedTableOptions!.onRowSelectionChange({ [mockConfigInfo.hash]: true });
    });

    const toolbar = renderToStaticMarkup(capturedTableOptions!.renderTopToolbarCustomActions());
    expect(toolbar).toContain('Download Config ');
    expect(toolbar).not.toContain('Download Configs');

    const user = userEvent.setup();
    const { getByText } = render(capturedTableOptions!.renderTopToolbarCustomActions());
    await user.click(getByText(/Download Config/));

    expect(downloadConfigFilesZip).toHaveBeenCalledWith(expect.objectContaining({
      studyId: 'test-study',
      hashes: [mockConfigInfo.hash],
    }));
  });

  test('toolbar shows plural label when multiple rows are selected', async () => {
    const participants = [makeParticipant({ participantConfigHash: mockConfigInfo.hash })];
    await act(async () => {
      render(<ConfigView visibleParticipants={participants} studyId="test-study" />);
    });
    await act(async () => {
      capturedTableOptions!.onRowSelectionChange({ hashA: true, hashB: true });
    });

    const toolbar = renderToStaticMarkup(capturedTableOptions!.renderTopToolbarCustomActions());
    expect(toolbar).toContain('Download Configs ');
  });

  test('handleCompareConfigs opens compare modal when two rows are selected', async () => {
    const participants = [makeParticipant({ participantConfigHash: mockConfigInfo.hash })];
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

  test.each([true, false])('opens the current config when View is clicked with participants: %s', async (hasParticipants) => {
    const participants = hasParticipants ? [makeParticipant({ participantConfigHash: mockConfigInfo.hash })] : [];
    await act(async () => {
      render(<ConfigView visibleParticipants={participants} studyId="test-study" currentConfigHash={mockConfigInfo.hash} />);
    });

    const col = capturedTableOptions!.columns.find((c) => c.id === 'actions');
    expect(col).toBeDefined();
    if (!col) return;
    const user = userEvent.setup();
    const { getAllByText } = render(col.Cell({ cell: { getValue: () => mockConfigInfo.hash } }));

    await act(async () => {
      await user.click(getAllByText('View')[0]);
    });

    const body = document.body.textContent || '';
    expect(body).toContain('studyMetadata');
    expect(body).toContain('1.0.0');
    expect(body).toContain('2026-04-08');
  });
});
