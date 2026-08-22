import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, screen, fireEvent, waitFor,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { openConfirmModal } from '@mantine/modals';
import { ManageView } from '../ManageView';
import { RevisitModesItem } from '../RevisitModesItem';
import {
  getDefaultDesiredParticipantCounts, getDesiredParticipantCounts, getNextStageColor, StageManagementItem,
} from '../StageManagementItem';
import { DataManagementItem } from '../DataManagementItem';
import { showNotification } from '../../../../utils/notifications';
import { StudyConfig } from '../../../../parser/types';
import { getBetweenSubjectsCombinationKey } from '../../../../storage/engines/types';

let mockStorageEngine: {
  getModes: ReturnType<typeof vi.fn>;
  setMode: ReturnType<typeof vi.fn>;
  getStageData: ReturnType<typeof vi.fn>;
  getAllSequenceAssignments: ReturnType<typeof vi.fn>;
  setCurrentStage: ReturnType<typeof vi.fn>;
  updateStage: ReturnType<typeof vi.fn>;
  getSnapshots: ReturnType<typeof vi.fn>;
  createSnapshot: ReturnType<typeof vi.fn>;
  renameSnapshot: ReturnType<typeof vi.fn>;
  restoreSnapshot: ReturnType<typeof vi.fn>;
  removeSnapshotOrLive: ReturnType<typeof vi.fn>;
  getAllParticipantsData: ReturnType<typeof vi.fn>;
  updateSnapshotParticipantCounts: ReturnType<typeof vi.fn>;
} | undefined;

vi.mock('../../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../../ParticipantTimeoutModal', () => ({
  ParticipantTimeoutModal: ({
    opened,
    participants,
    description,
  }: {
    opened?: boolean;
    participants: { participantId: string }[];
    description?: string;
  }) => (opened ? (
    <div>
      <div data-testid="timeout-participants">{participants.map((participant) => participant.participantId).join(',')}</div>
      <div data-testid="timeout-description">{description}</div>
    </div>
  ) : null),
}));

vi.mock('@mantine/core', () => ({
  Paper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Title: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
  Text: ({ children, span }: { children: ReactNode; span?: boolean }) => (span ? <span>{children}</span> : <p>{children}</p>),
  Button: ({
    children, onClick, disabled, 'aria-label': ariaLabel,
  }: { children: ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{children}</button>
  ),
  TextInput: ({ onChange, placeholder }: { onChange?: React.ChangeEventHandler<HTMLInputElement>; placeholder?: string }) => (
    <input placeholder={placeholder} onChange={onChange} />
  ),
  NumberInput: ({
    onChange, placeholder, value, 'aria-label': ariaLabel,
  }: { onChange?: (value: number | string) => void; placeholder?: string; value?: number | string; 'aria-label'?: string }) => (
    <input aria-label={ariaLabel} placeholder={placeholder} value={value ?? ''} onChange={(event) => onChange?.(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))} />
  ),
  ColorInput: ({ value }: { value?: string }) => <input readOnly value={value ?? ''} />,
  Loader: () => <div>Loading...</div>,
  LoadingOverlay: () => null,
  ActionIcon: ({
    children, onClick, 'aria-label': ariaLabel,
  }: { children: ReactNode; onClick?: () => void; 'aria-label'?: string }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>{children}</button>
  ),
  Radio: ({ checked, onChange, 'aria-label': ariaLabel }: { checked: boolean; onChange?: () => void; 'aria-label'?: string }) => (
    <input type="radio" readOnly checked={checked} onChange={onChange} aria-label={ariaLabel} />
  ),
  Switch: ({
    checked, label, onChange, 'aria-label': ariaLabel,
  }: { checked?: boolean; label?: ReactNode; onChange?: React.ChangeEventHandler<HTMLInputElement>; 'aria-label'?: string }) => (
    <label>
      {label}
      <input type="checkbox" defaultChecked={checked} onChange={onChange} aria-label={ariaLabel} />
    </label>
  ),
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Modal: ({ opened, children }: { opened: boolean; children: ReactNode }) => (opened ? <div>{children}</div> : null),
  Popover: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Target: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Space: () => <div />,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Collapse: ({ children, in: open }: { children: ReactNode; in: boolean }) => (open ? <div>{children}</div> : null),
  Badge: ({
    children, component, onClick, 'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    component?: string;
    onClick?: () => void;
    'aria-label'?: string;
  }) => (component === 'button'
    ? <button type="button" aria-label={ariaLabel} onClick={onClick}>{children}</button>
    : <span>{children}</span>),
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
  IconChevronDown: () => <span>down</span>,
  IconChevronUp: () => <span>up</span>,
  IconTrashX: () => <span>trash</span>,
  IconRefresh: () => <span>refresh</span>,
  IconPencil: () => <span>pencil</span>,
}));

vi.mock('@mantine/modals', () => ({
  openConfirmModal: vi.fn(),
}));

vi.mock('../../../../utils/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('../../../../components/downloader/DownloadButtons', () => ({
  DownloadButtons: () => <div>DownloadButtons</div>,
}));

const successResponse = { status: 'SUCCESS', notifications: [] };
const DEFAULT_STAGE_COLOR = '#F35C34';
const FIRST_ADDITIONAL_STAGE_COLOR = '#F35C34';

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
  getAllSequenceAssignments: vi.fn().mockResolvedValue([]),
  setCurrentStage: vi.fn().mockResolvedValue(undefined),
  updateStage: vi.fn().mockResolvedValue(undefined),
  getSnapshots: vi.fn().mockResolvedValue({}),
  createSnapshot: vi.fn().mockResolvedValue(successResponse),
  renameSnapshot: vi.fn().mockResolvedValue(successResponse),
  restoreSnapshot: vi.fn().mockResolvedValue(successResponse),
  removeSnapshotOrLive: vi.fn().mockResolvedValue(successResponse),
  getAllParticipantsData: vi.fn().mockResolvedValue([]),
  updateSnapshotParticipantCounts: vi.fn().mockResolvedValue(undefined),
});

describe('ManageView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageEngine = makeEngine();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ── ManageView layout ────────────────────────────────────────────────────

  test('renders modes and data management sections', async () => {
    await act(async () => {
      render(<ManageView studyId="my-study" refresh={async () => []} />);
    });
    expect(screen.getByText('ReVISit Modes')).toBeDefined();
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
    const dataCollectionSwitch = screen.getByRole('checkbox', { name: 'Data Collection' });
    await act(async () => {
      fireEvent.click(dataCollectionSwitch);
    });
    expect(mockStorageEngine!.setMode).toHaveBeenCalledWith('test-study', 'dataCollectionEnabled', false);
  });

  test('RevisitModesItem handleSwitch covers developmentMode and dataSharing branches', async () => {
    await act(async () => {
      render(<RevisitModesItem studyId="test-study" />);
    });
    const devModeSwitch = screen.getByRole('checkbox', { name: 'Development Mode' });
    const dataSharingSwitch = screen.getByRole('checkbox', { name: 'Share Data and Make Analytics Interface Public' });
    await act(async () => { fireEvent.click(devModeSwitch); });
    expect(mockStorageEngine!.setMode).toHaveBeenCalledWith('test-study', 'developmentModeEnabled', true);
    await act(async () => { fireEvent.click(dataSharingSwitch); });
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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
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
    const reviewRadio = screen.getByRole('radio', { name: 'Set current stage to REVIEW' });
    await act(async () => {
      fireEvent.click(reviewRadio);
    });
    expect(mockStorageEngine!.setCurrentStage).toHaveBeenCalledWith('test-study', 'REVIEW', '#00AAFF');
  });

  test('StageManagementItem handleEditStage shows edit inputs, handleCancelEdit resets', async () => {
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    const editBtn = screen.getByRole('button', { name: 'Edit stage DEFAULT' });
    await act(async () => { fireEvent.click(editBtn); });
    const cancelBtn = screen.getByRole('button', { name: 'Cancel editing stage DEFAULT' });
    await act(async () => { fireEvent.click(cancelBtn); });
    expect(screen.getByRole('button', { name: 'Edit stage DEFAULT' })).toBeDefined();
  });

  test('StageManagementItem handleSaveEdit updates the stage maximum then refreshes', async () => {
    mockStorageEngine!.updateStage = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    const editBtn = screen.getByRole('button', { name: 'Edit stage DEFAULT' });
    await act(async () => { fireEvent.click(editBtn); });
    const saveBtn = screen.getByRole('button', { name: 'Save stage DEFAULT' });
    await act(async () => { fireEvent.click(saveBtn); });
    expect(mockStorageEngine!.updateStage).toHaveBeenCalledWith('test-study', 'DEFAULT', {
      color: DEFAULT_STAGE_COLOR,
      maxParticipants: null,
      desiredParticipantsByCombination: null,
    });
    expect(mockStorageEngine!.getStageData).toHaveBeenCalledTimes(2);
  });

  test('StageManagementItem handleAddNewStage shows new row, handleCancelAddNewStage hides it', async () => {
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    await act(async () => { fireEvent.click(screen.getByText('Add New Stage')); });
    expect(screen.getByPlaceholderText('Enter stage name')).toBeDefined();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel new stage' })); });
    expect(screen.getByText('Add New Stage')).toBeDefined();
  });

  test('getNextStageColor selects an unused color from the shared palette', () => {
    expect(getNextStageColor([{ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR }]))
      .toBe(FIRST_ADDITIONAL_STAGE_COLOR);
    expect(getNextStageColor([
      { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
      { stageName: 'STAGE 2', color: FIRST_ADDITIONAL_STAGE_COLOR },
    ])).not.toBe(FIRST_ADDITIONAL_STAGE_COLOR);
  });

  test('getDefaultDesiredParticipantCounts evenly distributes a stage maximum', () => {
    const combinations = [
      { key: 'a', parameters: {} },
      { key: 'b', parameters: {} },
      { key: 'c', parameters: {} },
      { key: 'd', parameters: {} },
    ];

    expect(getDefaultDesiredParticipantCounts(10, combinations)).toEqual({
      a: 3, b: 3, c: 2, d: 2,
    });
    expect(getDefaultDesiredParticipantCounts(undefined, combinations)).toEqual({});
  });

  test('getDesiredParticipantCounts distributes the remaining maximum after overrides', () => {
    const combinations = [
      { key: 'a', parameters: {} },
      { key: 'b', parameters: {} },
      { key: 'c', parameters: {} },
      { key: 'd', parameters: {} },
    ];

    expect(getDesiredParticipantCounts(10, combinations, { a: 4 })).toEqual({
      a: 4, b: 2, c: 2, d: 2,
    });
    expect(getDesiredParticipantCounts(10, combinations, { a: 4, d: 1 })).toEqual({
      a: 4, b: 3, c: 2, d: 1,
    });
  });

  test('StageManagementItem handleSaveNewStage shows error for invalid name', async () => {
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    await act(async () => { fireEvent.click(screen.getByText('Add New Stage')); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save new stage' })); });
    expect(mockStorageEngine!.setCurrentStage).not.toHaveBeenCalled();
  });

  test('StageManagementItem handleSaveNewStage success calls setCurrentStage and refreshes', async () => {
    mockStorageEngine!.getStageData
      .mockResolvedValueOnce({
        currentStage: { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
        allStages: [{ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR }],
      })
      .mockResolvedValueOnce({
        currentStage: { stageName: 'NEWSTAGE', color: FIRST_ADDITIONAL_STAGE_COLOR },
        allStages: [
          { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
          { stageName: 'NEWSTAGE', color: FIRST_ADDITIONAL_STAGE_COLOR },
        ],
      });
    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });
    await act(async () => { fireEvent.click(screen.getByText('Add New Stage')); });
    fireEvent.change(screen.getByPlaceholderText('Enter stage name'), { target: { value: 'NEWSTAGE' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save new stage' })); });
    expect(mockStorageEngine!.setCurrentStage).toHaveBeenCalledWith('test-study', 'NEWSTAGE', FIRST_ADDITIONAL_STAGE_COLOR);
    expect(mockStorageEngine!.getStageData).toHaveBeenCalledTimes(2);
  });

  test('StageManagementItem shows each stage participant count and maximum', async () => {
    mockStorageEngine!.getStageData.mockResolvedValue({
      currentStage: { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
      allStages: [{ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR, maxParticipants: 5 }],
    });
    mockStorageEngine!.getAllParticipantsData.mockResolvedValue([
      { stage: 'DEFAULT', rejected: false, completed: true },
      { stage: 'DEFAULT', rejected: false, completed: false },
      { stage: 'DEFAULT', rejected: { reason: 'test', timestamp: 1 } },
    ]);

    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });

    expect(screen.getByText('Participants')).toBeDefined();
    expect(screen.getByText('Max Participants')).toBeDefined();
    expect(screen.getByText('Completed 1')).toBeDefined();
    expect(screen.getByText('In Progress 1')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  test('StageManagementItem reviews only the clicked stage in-progress participants', async () => {
    mockStorageEngine!.getStageData.mockResolvedValue({
      currentStage: { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
      allStages: [{ stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR }],
    });
    mockStorageEngine!.getAllParticipantsData.mockResolvedValue([
      {
        participantId: 'in-progress', stage: 'DEFAULT', rejected: false, completed: false,
      },
      {
        participantId: 'completed', stage: 'DEFAULT', rejected: false, completed: true,
      },
      {
        participantId: 'other-stage', stage: 'OTHER', rejected: false, completed: false,
      },
      {
        participantId: 'rejected', stage: 'DEFAULT', rejected: { reason: 'test', timestamp: 1 }, completed: false,
      },
    ]);

    await act(async () => {
      render(<StageManagementItem studyId="test-study" />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Review 1 in-progress participant' }));
    });

    expect(screen.getByTestId('timeout-participants').textContent).toBe('in-progress');
    expect(screen.getByTestId('timeout-description').textContent).toBe(
      'Showing only in-progress participants in the DEFAULT stage — not all in-progress participants in the study.',
    );
  });

  test('StageManagementItem expands between-subjects combinations with counts and switches', async () => {
    const disabledCombination = getBetweenSubjectsCombinationKey(
      { letter: 'a', number: 2 },
      ['letter', 'number'],
    );
    mockStorageEngine!.getStageData.mockResolvedValue({
      currentStage: { stageName: 'DEFAULT', color: DEFAULT_STAGE_COLOR },
      allStages: [{
        stageName: 'DEFAULT',
        color: DEFAULT_STAGE_COLOR,
        disabledBetweenSubjectsCombinations: [disabledCombination],
      }],
    });
    mockStorageEngine!.getAllParticipantsData.mockResolvedValue([
      {
        stage: 'DEFAULT',
        rejected: false,
        sequence: { parameters: { letter: 'a', number: 1 } },
      },
      {
        stage: 'DEFAULT',
        rejected: false,
        sequence: { parameters: { letter: 'a', number: 2 } },
      },
      {
        stage: 'DEFAULT',
        rejected: false,
        sequence: { parameters: { letter: 'b', number: 1 } },
      },
    ]);
    const studyConfig = {
      factors: { letter: ['a', 'b'], number: [1, 2] },
      betweenSubjects: ['letter', 'number'],
    } as unknown as StudyConfig;

    await act(async () => {
      render(<StageManagementItem studyId="test-study" studyConfig={studyConfig} />);
    });

    expect(screen.getByRole('button', { name: 'Collapse stage DEFAULT' })).toBeDefined();
    expect(screen.getByText('letter')).toBeDefined();
    expect(screen.getByText('number')).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit participant limits for DEFAULT' }));
    });
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Enable a / 2 for DEFAULT' }));
    });
    expect(mockStorageEngine!.updateStage).toHaveBeenCalledWith('test-study', 'DEFAULT', {
      disabledBetweenSubjectsCombinations: null,
    });
  });

  // ── DataManagementItem ───────────────────────────────────────────────────

  test('DataManagementItem returns null when storageEngine is undefined', async () => {
    mockStorageEngine = undefined;
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<DataManagementItem studyId="test-study" refresh={async () => []} />));
    });
    expect(container!.firstChild).toBeNull();
  });

  test('DataManagementItem renders main actions and "No snapshots" when snapshots empty', async () => {
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });
    expect(screen.getByText('Data Management')).toBeDefined();
    expect(screen.getByText('No snapshots.')).toBeDefined();
  });

  test('DataManagementItem renders snapshot table rows when snapshots exist', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'test-study-snapshot-2026T01:00': {
        name: 'my-snapshot',
        participantCounts: { completed: 4, inProgress: 2, rejected: 1 },
      },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });
    expect(screen.getByText('my-snapshot')).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('Rejected')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('DownloadButtons')).toBeDefined();
  });

  test('DataManagementItem sorts snapshots by newest creation date first', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'test-study-snapshot-2026-06-09T01:00:00': {
        name: 'older-snapshot',
        participantCounts: { completed: 1, inProgress: 0, rejected: 0 },
      },
      'test-study-snapshot-2026-06-10T01:00:00': {
        name: 'newer-snapshot',
        participantCounts: { completed: 2, inProgress: 0, rejected: 0 },
      },
    });

    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });

    expect(screen.getAllByText(/-snapshot$/).map((element) => element.textContent)).toEqual([
      'newer-snapshot',
      'older-snapshot',
    ]);
  });

  test('DataManagementItem backfills missing snapshot participant counts', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'dev-test-study-snapshot-2026T01:00': { name: 'my-snapshot' },
    });
    mockStorageEngine!.getAllParticipantsData.mockResolvedValue([
      { completed: true, rejected: false },
      { completed: true, rejected: { reason: 'quality', timestamp: 1 } },
      { completed: false, rejected: false },
      { completed: false, rejected: false },
      { completed: false, rejected: { reason: 'duplicate', timestamp: 2 } },
    ]);

    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });

    await waitFor(() => {
      expect(mockStorageEngine!.updateSnapshotParticipantCounts).toHaveBeenCalledWith(
        'test-study',
        'dev-test-study-snapshot-2026T01:00',
        { completed: 1, inProgress: 2, rejected: 2 },
      );
    });
    expect(mockStorageEngine!.getAllParticipantsData).toHaveBeenCalledWith('test-study-snapshot-2026T01:00');
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getAllByText('2').length).toBe(2);
  });

  test('DataManagementItem backfills missing snapshot participant counts one at a time', async () => {
    let resolveFirstBackfill: (participants: unknown[]) => void = () => { };
    const firstBackfill = new Promise((resolve) => {
      resolveFirstBackfill = resolve;
    });
    let resolveFirstUpdate: () => void = () => { };
    const firstUpdate = new Promise<void>((resolve) => {
      resolveFirstUpdate = resolve;
    });
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'dev-test-study-snapshot-2026T01:00': { name: 'first-snapshot' },
      'dev-test-study-snapshot-2026T02:00': { name: 'second-snapshot' },
    });
    mockStorageEngine!.getAllParticipantsData.mockImplementation((snapshotStudyId: string) => {
      if (snapshotStudyId === 'test-study-snapshot-2026T01:00') {
        return firstBackfill;
      }

      return Promise.resolve([{ completed: false, rejected: false }]);
    });
    mockStorageEngine!.updateSnapshotParticipantCounts.mockImplementation((_, snapshotName: string) => {
      if (snapshotName === 'dev-test-study-snapshot-2026T01:00') {
        return firstUpdate;
      }

      return Promise.resolve();
    });

    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });

    await waitFor(() => {
      expect(mockStorageEngine!.getAllParticipantsData).toHaveBeenCalledTimes(1);
    });
    expect(mockStorageEngine!.getAllParticipantsData).toHaveBeenCalledWith('test-study-snapshot-2026T01:00');
    expect(mockStorageEngine!.updateSnapshotParticipantCounts).not.toHaveBeenCalled();

    await act(async () => {
      resolveFirstBackfill([{ completed: true, rejected: false }]);
      await firstBackfill;
    });

    await waitFor(() => {
      expect(mockStorageEngine!.updateSnapshotParticipantCounts).toHaveBeenCalledTimes(1);
    });
    expect(mockStorageEngine!.getAllParticipantsData).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstUpdate();
      await firstUpdate;
    });

    await waitFor(() => {
      expect(mockStorageEngine!.getAllParticipantsData).toHaveBeenCalledTimes(2);
    });
    expect(mockStorageEngine!.getAllParticipantsData).toHaveBeenCalledWith('test-study-snapshot-2026T02:00');
  });

  test('DataManagementItem keeps snapshot actions available when count backfill fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'dev-test-study-snapshot-2026T01:00': { name: 'snap-one' },
    });
    mockStorageEngine!.getAllParticipantsData.mockRejectedValue(new Error('snapshot unavailable'));

    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText('Unavailable').length).toBe(3);
    });
    expect(screen.getByRole('button', { name: 'Rename snapshot snap-one' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restore snapshot snap-one' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete snapshot snap-one' })).toBeDefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to backfill participant counts for snapshot dev-test-study-snapshot-2026T01:00:',
      expect.any(Error),
    );
  });

  test('DataManagementItem getDateFromSnapshotName returns null for key without snapshot pattern', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'plain-key': { name: 'no-date-snap' },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });
    // snapshot renders but date cell is null — just verify the row appears without throwing
    expect(screen.getByText('no-date-snap')).toBeDefined();
  });

  test('DataManagementItem createSnapshot called via handleCreateSnapshot', async () => {
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
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
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });
    // open archive modal
    fireEvent.click(screen.getByText('Archive'));
    // type the study id to enable the button
    const input = screen.getByPlaceholderText('test-study');
    fireEvent.change(input, { target: { value: 'test-study' } });
    // The second "Archive" text is the confirm button inside the modal
    const archiveButtons = screen.getAllByText('Archive').map((el) => el.closest('button')!);
    await act(async () => { fireEvent.click(archiveButtons[archiveButtons.length - 1]); });
    expect(mockStorageEngine!.createSnapshot).toHaveBeenCalledWith('test-study', true);
  });

  test('DataManagementItem handleDeleteLive calls removeSnapshotOrLive', async () => {
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });
    fireEvent.click(screen.getByText('Delete'));
    const input = screen.getByPlaceholderText('test-study');
    fireEvent.change(input, { target: { value: 'test-study' } });
    // The second "Delete" text is the confirm button inside the modal
    const deleteButtons = screen.getAllByText('Delete').map((el) => el.closest('button')!);
    await act(async () => { fireEvent.click(deleteButtons[deleteButtons.length - 1]); });
    expect(mockStorageEngine!.removeSnapshotOrLive).toHaveBeenCalledWith('test-study', 'test-study');
  });

  test('DataManagementItem rename snapshot action works from snapshot row', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'test-study-snapshot-2026T01:00': { name: 'snap-one' },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });
    const pencilBtn = screen.getByRole('button', { name: 'Rename snapshot snap-one' });
    fireEvent.click(pencilBtn);
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
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });
    const trashBtn = screen.getByRole('button', { name: 'Delete snapshot snap-one' });
    fireEvent.click(trashBtn);
    const input = screen.getByPlaceholderText('test-study');
    fireEvent.change(input, { target: { value: 'test-study' } });
    // The second "Delete" text is the confirm button inside the modal
    const deleteButtons = screen.getAllByText('Delete').map((el) => el.closest('button')!);
    await act(async () => { fireEvent.click(deleteButtons[deleteButtons.length - 1]); });
    expect(mockStorageEngine!.removeSnapshotOrLive).toHaveBeenCalledWith('test-study-snapshot-2026T01:00', 'test-study');
  });

  test('DataManagementItem restore snapshot modal fires via openConfirmModal', async () => {
    mockStorageEngine!.getSnapshots.mockResolvedValue({
      'test-study-snapshot-2026T01:00': { name: 'snap-one' },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });
    const refreshBtn = screen.getByRole('button', { name: 'Restore snapshot snap-one' });
    fireEvent.click(refreshBtn);
    expect(openConfirmModal).toHaveBeenCalled();
    const call = (openConfirmModal as ReturnType<typeof vi.fn>).mock.calls[0][0];
    await act(async () => { await call.onConfirm(); });
    expect(mockStorageEngine!.restoreSnapshot).toHaveBeenCalledWith('test-study', 'test-study-snapshot-2026T01:00');
  });

  test('DataManagementItem snapshotAction shows notification on failure', async () => {
    mockStorageEngine!.createSnapshot.mockResolvedValue({
      status: 'ERROR',
      error: { title: 'Test error', message: 'Something went wrong' },
    });
    await act(async () => {
      render(<DataManagementItem studyId="test-study" refresh={async () => []} />);
    });
    fireEvent.click(screen.getByText('Snapshot'));
    const call = (openConfirmModal as ReturnType<typeof vi.fn>).mock.calls[0][0];
    await act(async () => { await call.onConfirm(); });
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }));
  });
});
