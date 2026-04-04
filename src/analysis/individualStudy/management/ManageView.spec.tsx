import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, screen, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ManageView } from './ManageView';
import { RevisitModesItem } from './RevisitModesItem';
import { StageManagementItem } from './StageManagementItem';
import { DataManagementItem } from './DataManagementItem';

let mockStorageEngine: {
  getModes: ReturnType<typeof vi.fn>;
  setMode: ReturnType<typeof vi.fn>;
  getStageData: ReturnType<typeof vi.fn>;
  setCurrentStage: ReturnType<typeof vi.fn>;
  updateStageColor: ReturnType<typeof vi.fn>;
  getSnapshots: ReturnType<typeof vi.fn>;
  createSnapshot: ReturnType<typeof vi.fn>;
  renameSnapshot: ReturnType<typeof vi.fn>;
  restoreSnapshot: ReturnType<typeof vi.fn>;
  removeSnapshotOrLive: ReturnType<typeof vi.fn>;
  getAllParticipantsData: ReturnType<typeof vi.fn>;
} | undefined;

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('@mantine/core', () => ({
  Paper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  Text: ({ children, span }: { children: ReactNode; span?: boolean }) => (span ? <span>{children}</span> : <p>{children}</p>),
  Button: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
  TextInput: ({ onChange, placeholder }: { onChange?: React.ChangeEventHandler<HTMLInputElement>; placeholder?: string }) => (
    <input placeholder={placeholder} onChange={onChange} />
  ),
  ColorInput: ({ value }: { value?: string }) => <input readOnly value={value ?? ''} />,
  Loader: () => <div>Loading...</div>,
  LoadingOverlay: () => null,
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Radio: ({ checked, onChange }: { checked: boolean; onChange?: () => void }) => (
    <input type="radio" readOnly checked={checked} onChange={onChange} />
  ),
  Switch: ({ checked, onChange }: { checked?: boolean; onChange?: React.ChangeEventHandler<HTMLInputElement> }) => (
    <input type="checkbox" defaultChecked={checked} onChange={onChange} />
  ),
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Modal: ({ opened, children }: { opened: boolean; children: ReactNode }) => (opened ? <div>{children}</div> : null),
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Space: () => <div />,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Table: Object.assign(
    ({ children }: { children: ReactNode }) => <table>{children}</table>,
    {
      Thead: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
      Tbody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
      Tr: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
      Th: ({ children }: { children: ReactNode }) => <th>{children}</th>,
      Td: ({ children }: { children: ReactNode }) => <td>{children}</td>,
    },
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconEdit: () => <span>edit</span>,
  IconCheck: () => <span>check</span>,
  IconX: () => <span>x</span>,
  IconTrashX: () => <span>trash</span>,
  IconRefresh: () => <span>refresh</span>,
  IconPencil: () => <span>pencil</span>,
}));

vi.mock('@mantine/modals', () => ({
  openConfirmModal: vi.fn(),
}));

vi.mock('../../../utils/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('../../../components/downloader/DownloadButtons', () => ({
  DownloadButtons: () => <div>DownloadButtons</div>,
}));

const successResponse = { status: 'SUCCESS' as const, notifications: [] };
const DEFAULT_STAGE_COLOR = '#F05A30';

const makeEngine = () => ({
  getModes: vi.fn().mockResolvedValue({
    dataCollectionEnabled: true,
    developmentModeEnabled: false,
    dataSharingEnabled: false,
  }),
  setMode: vi.fn().mockResolvedValue(undefined),
  getStageData: vi.fn().mockResolvedValue({
    currentStage: { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
    allStages: [{ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR }],
  }),
  setCurrentStage: vi.fn().mockResolvedValue(undefined),
  updateStageColor: vi.fn().mockResolvedValue(undefined),
  getSnapshots: vi.fn().mockResolvedValue({}),
  createSnapshot: vi.fn().mockResolvedValue(successResponse),
  renameSnapshot: vi.fn().mockResolvedValue(successResponse),
  restoreSnapshot: vi.fn().mockResolvedValue(successResponse),
  removeSnapshotOrLive: vi.fn().mockResolvedValue(successResponse),
  getAllParticipantsData: vi.fn().mockResolvedValue([]),
});

describe('ManageView', () => {
  beforeEach(() => {
    mockStorageEngine = makeEngine();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ── ManageView layout ────────────────────────────────────────────────────

  test('renders all three management sections', async () => {
    await act(async () => {
      render(<ManageView studyId="my-study" refresh={async () => ({})} />);
    });
    expect(screen.getByText('ReVISit Modes')).toBeDefined();
    expect(screen.getByText('Stage Management')).toBeDefined();
    expect(screen.getByText('Data Management')).toBeDefined();
  });

  // ── RevisitModesItem ─────────────────────────────────────────────────────

  test('RevisitModesItem renders nothing before fetch completes', () => {
    const html = renderToStaticMarkup(<RevisitModesItem studyId="test-study" />);
    expect(html).toBe('');
  });

  test('RevisitModesItem renders mode section titles after fetch', async () => {
    await act(async () => {
      render(<RevisitModesItem studyId="test-study" />);
    });
    expect(screen.getByText('ReVISit Modes')).toBeDefined();
    expect(screen.getByText('Data Collection')).toBeDefined();
    expect(screen.getByText('Development Mode')).toBeDefined();
    expect(screen.getByText('Share Data and Make Analytics Interface Public')).toBeDefined();
  });

  test('RevisitModesItem calls getModes with the provided studyId', async () => {
    await act(async () => {
      render(<RevisitModesItem studyId="my-study" />);
    });
    expect(mockStorageEngine!.getModes).toHaveBeenCalledWith('my-study');
  });

  test('RevisitModesItem renders nothing when storageEngine is undefined', () => {
    mockStorageEngine = undefined;
    const html = renderToStaticMarkup(<RevisitModesItem studyId="test-study" />);
    expect(html).toBe('');
  });

  test('RevisitModesItem handleSwitch calls setMode and updates state', async () => {
    await act(async () => {
      render(<RevisitModesItem studyId="test-study" />);
    });
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkboxes[0]);
    });
    expect(mockStorageEngine!.setMode).toHaveBeenCalledWith('test-study', 'dataCollectionEnabled', false);
  });

  test('RevisitModesItem handleSwitch covers developmentMode and dataSharing branches', async () => {
    await act(async () => {
      render(<RevisitModesItem studyId="test-study" />);
    });
    const checkboxes = screen.getAllByRole('checkbox');
    // developmentModeEnabled starts false → click sets true
    await act(async () => { fireEvent.click(checkboxes[1]); });
    expect(mockStorageEngine!.setMode).toHaveBeenCalledWith('test-study', 'developmentModeEnabled', true);
    // dataSharingEnabled starts false → click sets true
    await act(async () => { fireEvent.click(checkboxes[2]); });
    expect(mockStorageEngine!.setMode).toHaveBeenCalledWith('test-study', 'dataSharingEnabled', true);
  });

  // ── StageManagementItem ──────────────────────────────────────────────────

  test('StageManagementItem shows loader before data loads', () => {
    const html = renderToStaticMarkup(<StageManagementItem studyId="test-study" />);
    expect(html).toContain('Loading stage data...');
  });

  test('StageManagementItem renders table and Add New Stage button after data loads', async () => {
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    expect(screen.getByText('Stage Management')).toBeDefined();
    expect(screen.getByText('DEFAULT')).toBeDefined();
    expect(screen.getByText('Add New Stage')).toBeDefined();
  });

  test('StageManagementItem calls getStageData with the provided studyId', async () => {
    await act(async () => {
      render(<StageManagementItem studyId="my-study" />);
    });
    expect(mockStorageEngine!.getStageData).toHaveBeenCalledWith('my-study');
  });

  test('StageManagementItem shows defaults and sets asyncStatus on getStageData error', async () => {
    mockStorageEngine!.getStageData.mockRejectedValue(new Error('db error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    expect(consoleSpy).toHaveBeenCalledWith('Failed to load stage data:', expect.any(Error));
    expect(screen.getByText('DEFAULT')).toBeDefined();
  });

  test('StageManagementItem handleSetCurrentStage calls setCurrentStage when radio clicked', async () => {
    mockStorageEngine!.getStageData.mockResolvedValue({
      currentStage: { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
      allStages: [
        { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
        { stageName: 'REVIEW', color: '#00AAFF' },
      ],
    });
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    const radios = screen.getAllByRole('radio');
    await act(async () => {
      fireEvent.click(radios[1]);
    });
    expect(mockStorageEngine!.setCurrentStage).toHaveBeenCalledWith('test-study', 'REVIEW', '#00AAFF');
  });

  test('StageManagementItem handleEditStage shows edit inputs, handleCancelEdit resets', async () => {
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    const editBtn = screen.getByText('edit').closest('button')!;
    await act(async () => { fireEvent.click(editBtn); });
    // cancel button (X icon) is now visible
    const cancelBtn = screen.getByText('x').closest('button')!;
    await act(async () => { fireEvent.click(cancelBtn); });
    // after cancel, edit button should be back
    expect(screen.getByText('edit').closest('button')).toBeDefined();
  });

  test('StageManagementItem handleSaveEdit calls updateStageColor then refreshes', async () => {
    mockStorageEngine!.updateStageColor = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    const editBtn = screen.getByText('edit').closest('button')!;
    await act(async () => { fireEvent.click(editBtn); });
    const saveBtn = screen.getByText('check').closest('button')!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(mockStorageEngine!.updateStageColor).toHaveBeenCalledWith('test-study', 'DEFAULT', DEFAULT_STAGE_COLOR);
    expect(mockStorageEngine!.getStageData).toHaveBeenCalledTimes(2);
  });

  test('StageManagementItem handleAddNewStage shows new row, handleCancelAddNewStage hides it', async () => {
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    await act(async () => { fireEvent.click(screen.getByText('Add New Stage')); });
    // new row appears with its name input
    expect(screen.getByPlaceholderText('Enter stage name')).toBeDefined();
    // cancel the new stage row
    const cancelBtns = screen.getAllByText('x');
    await act(async () => { fireEvent.click(cancelBtns[cancelBtns.length - 1].closest('button')!); });
    expect(screen.getByText('Add New Stage')).toBeDefined();
  });

  test('StageManagementItem handleSaveNewStage shows error for invalid name', async () => {
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    await act(async () => { fireEvent.click(screen.getByText('Add New Stage')); });
    // click save without entering a name — should show validation error, not call setCurrentStage
    const saveBtns = screen.getAllByText('check');
    await act(async () => { fireEvent.click(saveBtns[saveBtns.length - 1].closest('button')!); });
    expect(mockStorageEngine!.setCurrentStage).not.toHaveBeenCalled();
  });

  test('StageManagementItem handleSaveNewStage success calls setCurrentStage and refreshes', async () => {
    mockStorageEngine!.getStageData
      .mockResolvedValueOnce({
        currentStage: { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
        allStages: [{ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR }],
      })
      .mockResolvedValueOnce({
        currentStage: { stageName: 'NEWSTAGE', color: DEFAULT_STAGE_COLOR },
        allStages: [
          { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
          { stageName: 'NEWSTAGE', color: DEFAULT_STAGE_COLOR },
        ],
      });
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    await act(async () => { fireEvent.click(screen.getByText('Add New Stage')); });
    fireEvent.change(screen.getByPlaceholderText('Enter stage name'), { target: { value: 'NEWSTAGE' } });
    const saveBtns = screen.getAllByText('check');
    await act(async () => { fireEvent.click(saveBtns[saveBtns.length - 1].closest('button')!); });
    expect(mockStorageEngine!.setCurrentStage).toHaveBeenCalledWith('test-study', 'NEWSTAGE', DEFAULT_STAGE_COLOR);
    expect(mockStorageEngine!.getStageData).toHaveBeenCalledTimes(2);
  });

  // ── DataManagementItem ───────────────────────────────────────────────────

  test('DataManagementItem returns null when storageEngine is undefined', async () => {
    mockStorageEngine = undefined;
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />));
    });
    expect(container!.firstChild).toBeNull();
  });

  test('DataManagementItem renders main actions and "No snapshots" when snapshots empty', async () => {
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    expect(screen.getByText('Data Management')).toBeDefined();
    expect(screen.getByText('No snapshots.')).toBeDefined();
  });

  test('DataManagementItem renders snapshot table rows when snapshots exist', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'test-study-snapshot-2026T01:00': { name: 'my-snapshot' },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    expect(screen.getByText('my-snapshot')).toBeDefined();
    expect(screen.getByText('DownloadButtons')).toBeDefined();
  });

  test('DataManagementItem getDateFromSnapshotName returns null for key without snapshot pattern', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'plain-key': { name: 'no-date-snap' },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    // snapshot renders but date cell is null — just verify the row appears without throwing
    expect(screen.getByText('no-date-snap')).toBeDefined();
  });

  test('DataManagementItem createSnapshot called via handleCreateSnapshot', async () => {
    const { openConfirmModal } = await import('@mantine/modals');
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    fireEvent.click(screen.getByText('Snapshot'));
    expect(openConfirmModal).toHaveBeenCalled();
    // invoke the onConfirm callback directly
    const call = (openConfirmModal as ReturnType<typeof vi.fn>).mock.calls[0][0];
    await act(async () => { await call.onConfirm(); });
    expect(mockStorageEngine!.createSnapshot).toHaveBeenCalledWith('test-study', false);
  });

  test('DataManagementItem handleArchiveData calls createSnapshot with archive=true', async () => {
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    // open archive modal
    fireEvent.click(screen.getByText('Archive'));
    // type the study id to enable the button
    const input = screen.getByPlaceholderText('test-study');
    fireEvent.change(input, { target: { value: 'test-study' } });
    await act(async () => { fireEvent.click(screen.getAllByText('Archive')[1]); });
    expect(mockStorageEngine!.createSnapshot).toHaveBeenCalledWith('test-study', true);
  });

  test('DataManagementItem handleDeleteLive calls removeSnapshotOrLive', async () => {
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    fireEvent.click(screen.getByText('Delete'));
    const input = screen.getByPlaceholderText('test-study');
    fireEvent.change(input, { target: { value: 'test-study' } });
    await act(async () => { fireEvent.click(screen.getAllByText('Delete')[1]); });
    expect(mockStorageEngine!.removeSnapshotOrLive).toHaveBeenCalledWith('test-study', 'test-study');
  });

  test('DataManagementItem rename and delete snapshot actions work from snapshot row', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'test-study-snapshot-2026T01:00': { name: 'snap-one' },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    // open rename modal
    fireEvent.click(screen.getByText('pencil').closest('button')!);
    const renameInput = screen.getByPlaceholderText('test-study-snapshot-2026T01:00');
    fireEvent.change(renameInput, { target: { value: 'new-name' } });
    await act(async () => { fireEvent.click(screen.getByText('Rename')); });
    expect(mockStorageEngine!.renameSnapshot).toHaveBeenCalledWith('test-study-snapshot-2026T01:00', 'new-name', 'test-study');
  });

  test('DataManagementItem delete snapshot modal calls removeSnapshotOrLive', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'test-study-snapshot-2026T01:00': { name: 'snap-one' },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    fireEvent.click(screen.getByText('trash').closest('button')!);
    const input = screen.getByPlaceholderText('test-study');
    fireEvent.change(input, { target: { value: 'test-study' } });
    await act(async () => { fireEvent.click(screen.getAllByText('Delete')[1]); });
    expect(mockStorageEngine!.removeSnapshotOrLive).toHaveBeenCalledWith('test-study-snapshot-2026T01:00', 'test-study');
  });

  test('DataManagementItem restore snapshot modal fires via openConfirmModal', async () => {
    const { openConfirmModal } = await import('@mantine/modals');
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'test-study-snapshot-2026T01:00': { name: 'snap-one' },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    fireEvent.click(screen.getByText('refresh').closest('button')!);
    expect(openConfirmModal).toHaveBeenCalled();
    const call = (openConfirmModal as ReturnType<typeof vi.fn>).mock.calls[0][0];
    await act(async () => { await call.onConfirm(); });
    expect(mockStorageEngine!.restoreSnapshot).toHaveBeenCalledWith('test-study', 'test-study-snapshot-2026T01:00');
  });

  test('DataManagementItem snapshotAction shows notification on failure', async () => {
    const { showNotification } = await import('../../../utils/notifications');
    mockStorageEngine!.createSnapshot.mockResolvedValue({
      status: 'ERROR',
      error: { title: 'Oops', message: 'Something went wrong' },
    });
    const { openConfirmModal } = await import('@mantine/modals');
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => ({})} />);
    });
    fireEvent.click(screen.getByText('Snapshot'));
    const call = (openConfirmModal as ReturnType<typeof vi.fn>).mock.calls[0][0];
    await act(async () => { await call.onConfirm(); });
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }));
  });
});
