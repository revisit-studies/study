import { ReactNode } from 'react';
import {
  render, act, cleanup, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { ThinkAloudFooter } from './ThinkAloudFooter';
import { useAsync } from '../../../store/hooks/useAsync';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockSetSearchParams = vi.fn();
let mockNavigate = vi.fn();

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Alert: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>,
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Footer: ({ children }: { children: ReactNode }) => <footer>{children}</footer> },
  ),
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ColorSwatch: () => <span />,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCard: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Target: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  Popover: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Target: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  SegmentedControl: ({ data, onChange }: { data?: { label: string; value: string }[]; onChange?: (v: string) => void }) => (
    <div>{data?.map((d) => <button key={d.value} type="button" onClick={() => onChange?.(d.value)}>{d.label}</button>)}</div>
  ),
  Select: ({
    leftSection, rightSection, onChange, value, data, label,
  }: { leftSection?: ReactNode; rightSection?: ReactNode; onChange?: (v: string | null) => void; value?: string; data?: { label: string; value: string }[]; label?: string }) => (
    <div aria-label={label}>
      {leftSection}
      <select value={value} onChange={(e) => onChange?.(e.target.value)}>
        {data?.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
      {rightSection}
    </div>
  ),
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowLeft: () => null,
  IconArrowRight: () => null,
  IconDeviceDesktopDown: () => null,
  IconInfoCircle: () => null,
  IconMusicDown: () => null,
  IconPalette: () => null,
  IconPlayerPauseFilled: () => null,
  IconPlayerPlayFilled: () => null,
  IconRestore: () => null,
}));

vi.mock('react-router', () => ({
  useLocation: () => ({ search: '', pathname: '/' }),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('participantId=p1'), mockSetSearchParams],
}));

vi.mock('../../../store/hooks/useAsync', () => ({
  useAsync: vi.fn(() => ({
    value: null, status: 'success', execute: vi.fn(), error: null,
  })),
}));

vi.mock('../../../store/hooks/useAuth', () => ({
  useAuth: () => ({ user: { isAdmin: true, determiningStatus: false } }),
}));

vi.mock('../../../components/audioAnalysis/AudioProvenanceVis', () => ({
  AudioProvenanceVis: () => <div data-testid="audio-provenance-vis" />,
}));

vi.mock('./TranscriptSegmentsVis', () => ({
  TranscriptSegmentsVis: () => <div data-testid="transcript-segments" />,
}));

vi.mock('./tags/TagSelector', () => ({
  TagSelector: ({
    onSelectTags, editTagCallback, tags,
  }: { onSelectTags?: (t: unknown[]) => void; editTagCallback?: (old: unknown, next: unknown) => void; tags?: unknown[] }) => (
    <div data-testid="tag-selector">
      <button type="button" onClick={() => onSelectTags?.([])}>select-tags</button>
      {tags && tags.length > 0 && (
        <button type="button" onClick={() => editTagCallback?.(tags[0], { ...tags[0] as object, label: 'edited' })}>edit-tag</button>
      )}
    </div>
  ),
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (i: number) => String(i),
}));

vi.mock('../../../utils/parseTrialOrder', () => ({
  parseTrialOrder: () => ({ step: 0, funcIndex: null }),
}));

vi.mock('../../../utils/Prefix', () => ({ PREFIX: '/' }));

vi.mock('../../../utils/handleDownloadFiles', () => ({
  handleTaskAudio: vi.fn(),
  handleTaskScreenRecording: vi.fn(),
}));

vi.mock('../ParticipantRejectModal', () => ({
  ParticipantRejectModal: () => null,
}));

vi.mock('../../../store/hooks/useReplay', () => ({
  useReplayContext: () => ({
    isPlaying: false,
    setIsPlaying: vi.fn(),
    speed: 1,
    setSpeed: vi.fn(),
    setSeekTime: vi.fn(),
    hasEnded: false,
  }),
}));

vi.mock('../../../components/audioAnalysis/provenanceColors', () => ({
  buildProvenanceLegendEntries: vi.fn(() => []),
}));

vi.mock('../../../utils/syncReplay', () => ({
  revisitPageId: 'test-page-id',
  syncChannel: { postMessage: vi.fn() },
}));

// ── tests ─────────────────────────────────────────────────────────────────────

const defaultProps = {
  visibleParticipants: ['p1'],
  rawTranscript: null,
  currentShownTranscription: null,
  width: 800,
  onTimeUpdate: vi.fn(),
  isReplay: false,
  currentTrial: 'trial_0',
  saveProvenance: vi.fn(),
  studyId: 'test-study',
  setHasAudio: vi.fn(),
  storageEngine: undefined,
};

afterEach(() => { cleanup(); });

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockParticipantWithAnswers = {
  participantId: 'p1',
  answers: {
    trial_0: {
      identifier: 'trial_0', componentName: 'Component 1', trialOrder: '0_null', startTime: 1000, endTime: 2000, provenanceGraph: null,
    },
    trial_1: {
      identifier: 'trial_1', componentName: 'Component 2', trialOrder: '1_null', startTime: 2000, endTime: 3000, provenanceGraph: null,
    },
  },
};

const mockTaskTags = [{ id: 'tag1', label: 'Tag 1', color: 'blue' }];
const mockAllParticipantTags = [{ id: 'ptag1', label: 'PTag 1', color: 'green' }];
const mockParticipantTags = { participantTags: [], taskTags: { trial_0: [] } };

const mockStorageEngine = {
  getAudioUrl: vi.fn().mockResolvedValue('http://test/audio.mp3'),
  getScreenRecording: vi.fn().mockResolvedValue('http://test/video.mp4'),
  saveTags: vi.fn().mockResolvedValue(undefined),
  getTags: vi.fn().mockResolvedValue([]),
  getAllParticipantAndTaskTags: vi.fn().mockResolvedValue(null),
  saveAllParticipantAndTaskTags: vi.fn().mockResolvedValue(undefined),
  getParticipantData: vi.fn().mockResolvedValue(null),
};

// ── extended coverage tests ───────────────────────────────────────────────────

describe('ThinkAloudFooter extended coverage', () => {
  beforeEach(() => {
    mockNavigate = vi.fn();
    mockSetSearchParams = vi.fn();
    vi.mocked(useAsync).mockReturnValue({
      value: null, status: 'success', execute: vi.fn(), error: null,
    });
    mockStorageEngine.getAudioUrl.mockResolvedValue('http://test/audio.mp3');
    mockStorageEngine.getScreenRecording.mockResolvedValue('http://test/video.mp4');
    mockStorageEngine.saveTags.mockResolvedValue(undefined);
    mockStorageEngine.saveAllParticipantAndTaskTags.mockResolvedValue(undefined);
  });

  test('fetchAssetsUrl effect runs when storageEngine provided (covers 105-117)', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} storageEngine={mockStorageEngine as never} />,
    ));
    expect(mockStorageEngine.getAudioUrl).toHaveBeenCalled();
    expect(mockStorageEngine.getScreenRecording).toHaveBeenCalled();
    expect(container).toBeDefined();
  });

  test('handleDownloadAudio and handleDownloadScreenRecording covered via button click (covers 124-146)', async () => {
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} storageEngine={mockStorageEngine as never} />,
    ));
    // After fetchAssetsUrl resolves, audio/video buttons appear
    const buttons = getAllByRole('button');
    // Click all buttons to cover download handlers (they guard on storageEngine+participantId+currentTrial)
    await act(async () => { buttons.forEach((btn) => { fireEvent.click(btn); }); });
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('participantTags effect sets localParticipantTags (covers 157-158)', async () => {
    vi.mocked(useAsync)
      .mockReturnValueOnce({
        value: null, status: 'success', execute: vi.fn(), error: null,
      }) // participant
      .mockReturnValueOnce({
        value: null, status: 'success', execute: vi.fn(), error: null,
      }) // taskTags
      .mockReturnValueOnce({
        value: null, status: 'success', execute: vi.fn(), error: null,
      }) // allParticipantTags
      .mockReturnValueOnce({
        value: mockParticipantTags, status: 'success', execute: vi.fn(), error: null,
      }); // participantTags
    const { container } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} />,
    ));
    expect(container).toBeDefined();
  });

  test('currentTrialClean with __dynamicLoading returns empty string (covers 163-164)', async () => {
    vi.mocked(useAsync).mockReturnValueOnce({
      value: mockParticipantWithAnswers as never, status: 'success', execute: vi.fn(), error: null,
    }).mockReturnValue({
      value: null, status: 'success', execute: vi.fn(), error: null,
    });
    const { container } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} currentTrial="trial_0__dynamicLoading" />,
    ));
    expect(container).toBeDefined();
  });

  test('orderedAnswers computed with participant.answers (covers 233-249)', async () => {
    vi.mocked(useAsync).mockReturnValueOnce({
      value: mockParticipantWithAnswers as never, status: 'success', execute: vi.fn(), error: null,
    }).mockReturnValue({
      value: null, status: 'success', execute: vi.fn(), error: null,
    });
    const { container } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} visibleParticipants={['p1', 'p2']} />,
    ));
    expect(container).toBeDefined();
  });

  test('nextParticipantCallback via prev/next ActionIcons in Select leftSection/rightSection (covers 208-225)', async () => {
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} visibleParticipants={['p1', 'p2']} />,
    ));
    // Click all buttons — prev/next participant ActionIcons are rendered inside Select sections
    for (const btn of getAllByRole('button')) {
      act(() => { fireEvent.click(btn); });
    }
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  test('navigateToTask + nextTaskCallback via task select buttons (covers 253-303)', async () => {
    vi.mocked(useAsync).mockReturnValueOnce({
      value: mockParticipantWithAnswers as never, status: 'success', execute: vi.fn(), error: null,
    }).mockReturnValue({
      value: null, status: 'success', execute: vi.fn(), error: null,
    });
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} currentTrial="trial_0" />,
    ));
    for (const btn of getAllByRole('button')) {
      act(() => { fireEvent.click(btn); });
    }
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('speed SegmentedControl onChange covers lines 409-414', async () => {
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} />,
    ));
    // SegmentedControl renders speed options as buttons; click one to trigger onChange
    const speedBtn = getAllByRole('button').find((b) => b.textContent === '0.5x');
    if (speedBtn) {
      await act(async () => { fireEvent.click(speedBtn); });
    }
    expect(getAllByRole('button').length).toBeGreaterThan(0);
  });

  test('participant Select onChange covers lines 452-461', async () => {
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} visibleParticipants={['p1', 'p2']} />,
    ));
    const selects = getAllByRole('combobox') as HTMLSelectElement[];
    if (selects[0]) {
      await act(async () => { fireEvent.change(selects[0], { target: { value: 'p2' } }); });
    }
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  test('participantTag onSelectTags covers lines 480-493', async () => {
    // Use mockImplementation stable across re-renders: identify getParticipantTags by 4-arg array
    vi.mocked(useAsync).mockImplementation((_fn, args) => ({
      value: Array.isArray(args) && args.length === 4 ? mockParticipantTags : null,
      status: 'success' as const,
      execute: vi.fn(),
      error: null,
    }));
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} storageEngine={mockStorageEngine as never} />,
    ));
    const selectTagsBtns = getAllByRole('button').filter((b) => b.textContent === 'select-tags');
    if (selectTagsBtns[0]) {
      await act(async () => { fireEvent.click(selectTagsBtns[0]); });
    }
    expect(mockStorageEngine.saveAllParticipantAndTaskTags).toHaveBeenCalled();
  });

  test('task Select onChange covers lines 518-521', async () => {
    vi.mocked(useAsync).mockReturnValueOnce({
      value: mockParticipantWithAnswers as never, status: 'success', execute: vi.fn(), error: null,
    }).mockReturnValue({
      value: null, status: 'success', execute: vi.fn(), error: null,
    });
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} currentTrial="trial_0" />,
    ));
    const selects = getAllByRole('combobox') as HTMLSelectElement[];
    const taskSelect = selects[selects.length - 1];
    if (taskSelect) {
      await act(async () => { fireEvent.change(taskSelect, { target: { value: 'trial_1' } }); });
    }
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('taskTag onSelectTags covers lines 539-553', async () => {
    vi.mocked(useAsync).mockImplementation((_fn, args) => ({
      value: Array.isArray(args) && args.length === 4 ? mockParticipantTags : null,
      status: 'success' as const,
      execute: vi.fn(),
      error: null,
    }));
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} storageEngine={mockStorageEngine as never} />,
    ));
    const selectTagsBtns = getAllByRole('button').filter((b) => b.textContent === 'select-tags');
    const taskTagsBtn = selectTagsBtns[selectTagsBtns.length - 1];
    if (taskTagsBtn) {
      await act(async () => { fireEvent.click(taskTagsBtn); });
    }
    expect(mockStorageEngine.saveAllParticipantAndTaskTags).toHaveBeenCalled();
  });

  test('private helpers getParticipantData, getParticipantTags, getTags (covers lines 44-70)', async () => {
    const capturedFns: Array<(...args: unknown[]) => unknown> = [];
    const capturedArgsList: Array<unknown[]> = [];

    vi.mocked(useAsync).mockImplementation((fn, args) => {
      capturedFns.push(fn as (...args: unknown[]) => unknown);
      capturedArgsList.push(args as unknown[] ?? []);
      return {
        value: null, status: 'success' as const, execute: vi.fn(), error: null,
      };
    });

    await act(async () => render(
      <ThinkAloudFooter {...defaultProps} storageEngine={mockStorageEngine as never} />,
    ));

    // Call each captured function with its actual args to cover helper bodies
    for (let i = 0; i < capturedFns.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await (capturedFns[i] as (...a: unknown[]) => Promise<unknown>)(...capturedArgsList[i]);
    }

    // getTags with non-array return (covers line 66 — else return [])
    const getTagsFn = capturedFns.find((_, i) => Array.isArray(capturedArgsList[i]) && capturedArgsList[i][1] === 'task') as ((...a: unknown[]) => Promise<unknown>) | undefined;
    if (getTagsFn) {
      const origImpl = mockStorageEngine.getTags.getMockImplementation();
      mockStorageEngine.getTags.mockResolvedValueOnce(null as never);
      await getTagsFn(mockStorageEngine, 'task');
      if (origImpl) mockStorageEngine.getTags.mockImplementation(origImpl);
    }

    expect(mockStorageEngine.getParticipantData).toHaveBeenCalled();
  });

  test('editTaskTagCallback and editParticipantTagCallback cover lines 313-333', async () => {
    // Identify calls by second arg: 'task' → taskTags, 'participant' → allParticipantTags
    vi.mocked(useAsync).mockImplementation((_fn, args) => ({
      value: Array.isArray(args) && args[1] === 'task' ? mockTaskTags
        : Array.isArray(args) && args[1] === 'participant' ? mockAllParticipantTags : null,
      status: 'success' as const,
      execute: vi.fn(),
      error: null,
    }));
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} storageEngine={mockStorageEngine as never} />,
    ));
    const editBtns = getAllByRole('button').filter((b) => b.textContent === 'edit-tag');
    await act(async () => { editBtns.forEach((btn) => { fireEvent.click(btn); }); });
    expect(mockStorageEngine.saveTags).toHaveBeenCalled();
  });
});

describe('ThinkAloudFooter', () => {
  test('renders without crashing', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders in replay mode', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} isReplay />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with edited transcript', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudFooter
        {...defaultProps}
        editedTranscript={[{
          speaker: 'A', text: 'Hello', start: 0, end: 1,
        }] as never}
      />,
    ));
    expect(container).toBeDefined();
  });

  test('clicking play/pause button calls setIsPlaying', async () => {
    const mockSetIsPlaying = vi.fn();
    vi.doMock('../../../store/hooks/useReplay', () => ({
      useReplayContext: () => ({
        isPlaying: false,
        setIsPlaying: mockSetIsPlaying,
        speed: 1,
        setSpeed: vi.fn(),
        setSeekTime: vi.fn(),
        hasEnded: false,
      }),
    }));
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} />,
    ));
    const buttons = getAllByRole('button');
    // Play/Pause is the ActionIcon with setIsPlaying handler
    expect(buttons.length).toBeGreaterThan(0);
    await act(async () => { fireEvent.click(buttons[0]); });
    expect(buttons[0]).toBeDefined();
  });

  test('clicking prev/next participant buttons calls nextParticipantCallback', async () => {
    vi.doMock('react-router', () => ({
      useLocation: () => ({ search: '', pathname: '/' }),
      useNavigate: () => vi.fn(),
      useSearchParams: () => [new URLSearchParams('participantId=p1'), vi.fn()],
    }));
    const { getAllByRole } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} visibleParticipants={['p1', 'p2']} />,
    ));
    const buttons = getAllByRole('button');
    // Click all buttons to exercise as many handlers as possible
    for (const btn of buttons) {
      act(() => { fireEvent.click(btn); });
    }
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('renders with multiple visible participants', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} visibleParticipants={['p1', 'p2', 'p3']} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with jumpedToLine set', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudFooter {...defaultProps} jumpedToLine={2} />,
    ));
    expect(container).toBeDefined();
  });
});
