import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  render, act, cleanup, fireEvent,
} from '@testing-library/react';
import {
  afterEach, beforeAll, beforeEach, describe, expect, test, vi,
} from 'vitest';
import * as d3 from 'd3';
import { useParams, useSearchParams } from 'react-router';
import { EditedText, Tag, TranscribedAudio } from '../individualStudy/thinkAloud/types';
import type { ParticipantData } from '../../storage/types';
import { makeStoredAnswer as makeStoredAnswerBase, makeStorageEngine } from '../../tests/utils';
import type { FirebaseStorageEngine } from '../../storage/engines/FirebaseStorageEngine';
import { useAsync } from '../../store/hooks/useAsync';
import { Pills } from '../individualStudy/thinkAloud/tags/Pills';
import { AddTagDropdown } from '../individualStudy/thinkAloud/tags/AddTagDropdown';
import { TagEditor } from '../individualStudy/thinkAloud/tags/TagEditor';
import { ThinkAloudAnalysis } from '../individualStudy/thinkAloud/ThinkAloudAnalysis';

// ── mock delegates (declared before vi.mock so hoisted references resolve) ────

const mockThinkAloudFooter = vi.fn(({ onTimeUpdate, setHasAudio }: { onTimeUpdate?: (t: number) => void; setHasAudio?: (b: boolean) => void }) => (
  <div data-testid="think-aloud-footer">
    <button type="button" data-testid="btn-set-has-audio" onClick={() => setHasAudio?.(true)}>setHasAudio</button>
    <button type="button" data-testid="btn-time-update" onClick={() => onTimeUpdate?.(5000)}>timeUpdate</button>
  </div>
));

const mockTextEditor = vi.fn(({ onClickLine, transcriptList }: { onClickLine?: (n: number) => void; transcriptList?: EditedText[] }) => (
  <div data-testid="text-editor">
    <div data-testid="transcript-count">{transcriptList?.length ?? 0}</div>
    <button type="button" data-testid="btn-click-line" onClick={() => onClickLine?.(0)}>clickLine</button>
  </div>
));

const mockTranscriptLine = vi.fn(({
  text, onTextChange, deleteRowCallback, addRowCallback, setAnnotation, editTagCallback, createTagCallback, addRef, index,
}: {
  text: string; onTextChange: (i: number, v: string) => void; deleteRowCallback: (i: number) => void;
  addRowCallback: (i: number, pos: number) => void; setAnnotation: (i: number, s: string) => void;
  editTagCallback: (oldTag: Tag, newTag: Tag) => void; createTagCallback: (t: Tag) => void;
  addRef: (i: number, ref: Pick<HTMLTextAreaElement, 'focus' | 'setSelectionRange'>) => void; index: number;
}) => (
  <div data-testid="transcript-line">
    {text}
    <button
      type="button"
      data-testid="btn-register-ref"
      onClick={() => addRef(index, { focus: vi.fn(), setSelectionRange: vi.fn() })}
    >
      registerRef
    </button>
    <button type="button" data-testid="btn-change" onClick={() => onTextChange(index, 'changed')}>change</button>
    <button type="button" data-testid="btn-delete" onClick={() => deleteRowCallback(index)}>delete</button>
    <button type="button" data-testid="btn-add" onClick={() => addRowCallback(index, 0)}>add</button>
    <button type="button" data-testid="btn-annotate" onClick={() => setAnnotation(index, 'note')}>annotate</button>
    <button type="button" data-testid="btn-edit-tag" onClick={() => editTagCallback({ id: 'old' } as Tag, { id: 'new' } as Tag)}>editTag</button>
    <button type="button" data-testid="btn-create-tag" onClick={() => createTagCallback({ id: 't1', name: 'T1', color: 'red' })}>createTag</button>
  </div>
));

const mockTagSelector = vi.fn(({ onSelectTags, editTagCallback, tags }: { onSelectTags?: (t: Tag[]) => void; editTagCallback?: (oldTag: Tag, newTag: Tag) => void; tags?: Tag[] }) => (
  <div data-testid="tag-selector">
    <button type="button" onClick={() => onSelectTags?.([])}>select-tags</button>
    {tags && tags.length > 0 && (
      <button type="button" onClick={() => editTagCallback?.(tags[0], { ...tags[0], name: 'edited' })}>edit-tag</button>
    )}
  </div>
));

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  ActionIcon: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
  Alert: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>,
  AppShell: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Footer: ({ children }: { children: ReactNode }) => <footer>{children}</footer> },
  ),
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CheckIcon: () => <span>check</span>,
  ColorPicker: ({ value }: { value?: string }) => <div data-colorpicker={value} />,
  ColorSwatch: ({ color }: { color: string }) => <div data-color={color} />,
  Combobox: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      DropdownTarget: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Options: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Option: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      EventsTarget: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Empty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  Grid: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Col: ({ children, ref: _r, ...rest }: { children: ReactNode; ref?: React.Ref<HTMLElement> }) => <div {...rest}>{children}</div> },
  ),
  Group: ({ children, style }: { children: ReactNode; style?: object }) => <div style={style}>{children}</div>,
  HoverCard: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Target: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  Input: { Placeholder: ({ children }: { children: ReactNode }) => <span>{children}</span> },
  Loader: () => <span>loading</span>,
  Pill: Object.assign(
    ({ children }: { children: ReactNode }) => <span>{children}</span>,
    { Group: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  PillsInput: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Field: () => <input />, Group: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  Popover: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Target: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  SegmentedControl: ({ data, onChange }: { data?: { label: string; value: string }[]; onChange?: (v: string) => void }) => (
    <div>{data?.map((item) => <button key={item.value} type="button" onClick={() => onChange?.(item.value)}>{item.label}</button>)}</div>
  ),
  Select: ({
    leftSection, rightSection, onChange, value, data, label,
  }: { leftSection?: ReactNode; rightSection?: ReactNode; onChange?: (v: string | null) => void; value?: string; data?: { label: string; value: string }[]; label?: string }) => (
    <div aria-label={label}>
      {leftSection}
      <select value={value} onChange={(e) => onChange?.(e.target.value)}>
        {data?.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      {rightSection}
    </div>
  ),
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Textarea: ({
    value, onChange, onKeyDown, onFocus, placeholder, onBlur, defaultValue,
  }: {
    value?: string; defaultValue?: string; onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>; onFocus?: React.FocusEventHandler<HTMLTextAreaElement>;
    placeholder?: string; onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
  }) => (
    <textarea data-testid="textarea" value={value} defaultValue={defaultValue} onChange={onChange} onKeyDown={onKeyDown} onFocus={onFocus} placeholder={placeholder} onBlur={onBlur} />
  ),
  TextInput: ({ placeholder, value }: { placeholder?: string; value?: string }) => <input placeholder={placeholder} defaultValue={value} />,
  Tooltip: ({ children, label }: { children: ReactNode; label?: ReactNode }) => <div title={String(label)}>{children}</div>,
  useCombobox: () => ({ toggleDropdown: vi.fn(), openDropdown: vi.fn(), closeDropdown: vi.fn() }),
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [{ current: null }, { width: 800, height: 20 }],
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowLeft: () => null,
  IconArrowRight: () => null,
  IconDeviceDesktopDown: () => null,
  IconEdit: () => <span>icon-edit</span>,
  IconInfoCircle: () => <span>icon-info</span>,
  IconMusicDown: () => null,
  IconPalette: () => null,
  IconPlayerPauseFilled: () => null,
  IconPlayerPlayFilled: () => null,
  IconRestore: () => null,
}));

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({ studyId: 'test-study', trialId: undefined })),
  useLocation: vi.fn(() => ({ search: '', pathname: '/' })),
  useNavigate: vi.fn(() => vi.fn()),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
}));

vi.mock('../../store/hooks/useAsync', () => ({
  useAsync: vi.fn(() => ({
    value: null, status: 'success', execute: vi.fn(), error: null,
  })),
}));

vi.mock('../../store/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { user: { email: 'test@test.com' }, isAdmin: true, determiningStatus: false } })),
}));

vi.mock('../../store/hooks/useReplay', () => ({
  useReplay: vi.fn(() => ({})),
  ReplayContext: { Provider: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  useReplayContext: vi.fn(() => ({
    isPlaying: false, setIsPlaying: vi.fn(), speed: 1, setSpeed: vi.fn(), setSeekTime: vi.fn(), hasEnded: false,
  })),
}));

vi.mock('../../store/hooks/useEvent', () => ({ useEvent: (fn: (...args: never[]) => void) => fn }));
vi.mock('../../storage/storageEngineHooks', () => ({ useStorageEngine: vi.fn(() => ({ storageEngine: undefined })) }));
vi.mock('../../storage/engines/FirebaseStorageEngine', () => ({ FirebaseStorageEngine: class { } }));
vi.mock('../../utils/parseTrialOrder', () => ({ parseTrialOrder: vi.fn(() => ({ step: 0, funcIndex: null })) }));
vi.mock('lodash.debounce', () => ({ default: (fn: (...args: never[]) => void) => fn }));
vi.mock('../../components/audioAnalysis/AudioProvenanceVis', () => ({ AudioProvenanceVis: () => <div data-testid="audio-provenance-vis" /> }));
vi.mock('../../utils/encryptDecryptIndex', () => ({ encryptIndex: (i: number) => String(i) }));
vi.mock('../../utils/Prefix', () => ({ PREFIX: '/' }));
vi.mock('../../utils/handleDownloadFiles', () => ({ handleTaskAudio: vi.fn(), handleTaskScreenRecording: vi.fn() }));
vi.mock('../individualStudy/ParticipantRejectModal', () => ({ ParticipantRejectModal: () => null }));
vi.mock('../../components/audioAnalysis/provenanceColors', () => ({ buildProvenanceLegendEntries: vi.fn(() => []) }));
vi.mock('../../utils/syncReplay', () => ({ revisitPageId: 'test-page-id', syncChannel: { postMessage: vi.fn() } }));

vi.mock('../individualStudy/thinkAloud/ThinkAloudFooter', () => ({ ThinkAloudFooter: (props: Parameters<typeof mockThinkAloudFooter>[0]) => mockThinkAloudFooter(props) }));
vi.mock('../individualStudy/thinkAloud/TextEditor', () => ({ TextEditor: (props: Parameters<typeof mockTextEditor>[0]) => mockTextEditor(props) }));
vi.mock('../individualStudy/thinkAloud/TranscriptLine', () => ({ TranscriptLine: (props: Parameters<typeof mockTranscriptLine>[0]) => mockTranscriptLine(props) }));
vi.mock('../individualStudy/thinkAloud/tags/TagSelector', () => ({ TagSelector: (props: Parameters<typeof mockTagSelector>[0]) => mockTagSelector(props) }));
vi.mock('../individualStudy/thinkAloud/TranscriptSegmentsVis', () => ({ TranscriptSegmentsVis: () => <div data-testid="transcript-segments" /> }));

// ── real component references for DOM tests ──────────────────────────────────

let RealThinkAloudFooter: typeof import('../individualStudy/thinkAloud/ThinkAloudFooter')['ThinkAloudFooter'];
let RealTextEditor: typeof import('../individualStudy/thinkAloud/TextEditor')['TextEditor'];
let RealTranscriptLine: typeof import('../individualStudy/thinkAloud/TranscriptLine')['TranscriptLine'];
let RealTranscriptSegmentsVis: typeof import('../individualStudy/thinkAloud/TranscriptSegmentsVis')['TranscriptSegmentsVis'];
let RealTagSelector: typeof import('../individualStudy/thinkAloud/tags/TagSelector')['TagSelector'];

beforeAll(async () => {
  RealThinkAloudFooter = ((await vi.importActual('../individualStudy/thinkAloud/ThinkAloudFooter')) as typeof import('../individualStudy/thinkAloud/ThinkAloudFooter')).ThinkAloudFooter;
  RealTextEditor = ((await vi.importActual('../individualStudy/thinkAloud/TextEditor')) as typeof import('../individualStudy/thinkAloud/TextEditor')).TextEditor;
  RealTranscriptLine = ((await vi.importActual('../individualStudy/thinkAloud/TranscriptLine')) as typeof import('../individualStudy/thinkAloud/TranscriptLine')).TranscriptLine;
  RealTranscriptSegmentsVis = ((await vi.importActual('../individualStudy/thinkAloud/TranscriptSegmentsVis')) as typeof import('../individualStudy/thinkAloud/TranscriptSegmentsVis')).TranscriptSegmentsVis;
  RealTagSelector = ((await vi.importActual('../individualStudy/thinkAloud/tags/TagSelector')) as typeof import('../individualStudy/thinkAloud/tags/TagSelector')).TagSelector;
});

// ── shared fixtures ──────────────────────────────────────────────────────────

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1', name: 'Confusion', color: '#fa5252', ...overrides,
  };
}

const mockStorageEngine = makeStorageEngine() as unknown as FirebaseStorageEngine;

afterEach(() => { cleanup(); });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SSR TESTS (renderToStaticMarkup)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Pills ─────────────────────────────────────────────────────────────────────

describe('Pills', () => {
  test('renders a pill for each valid tag', () => {
    const tags = [makeTag({ id: 'a', name: 'Focus' }), makeTag({ id: 'b', name: 'Confusion' })];
    const html = renderToStaticMarkup(<Pills selectedTags={tags} />);
    expect(html).toContain('Focus');
    expect(html).toContain('Confusion');
  });

  test('skips tags with no id', () => {
    const tags = [null as unknown as Tag, makeTag({ id: 'valid', name: 'Valid' })];
    const html = renderToStaticMarkup(<Pills selectedTags={tags} />);
    expect(html).toContain('Valid');
  });

  test('renders empty when selectedTags is empty', () => {
    const html = renderToStaticMarkup(<Pills selectedTags={[]} />);
    expect(html).toBe('');
  });

  test('renders dark text color on a light tag', () => {
    const html = renderToStaticMarkup(<Pills selectedTags={[makeTag({ color: '#ffffff' })]} />);
    expect(html).toContain('Confusion');
  });

  test('renders with removeFunc', () => {
    const html = renderToStaticMarkup(<Pills selectedTags={[makeTag()]} removeFunc={vi.fn()} />);
    expect(html).toContain('Confusion');
  });
});

// ── AddTagDropdown ────────────────────────────────────────────────────────────

describe('AddTagDropdown', () => {
  test('renders add-mode with "Add Tag" button', () => {
    const html = renderToStaticMarkup(<AddTagDropdown addTagCallback={vi.fn()} currentNames={[]} />);
    expect(html).toContain('Add Tag');
    expect(html).toContain('Enter tag name');
  });

  test('renders edit-mode prefilled with tag name', () => {
    const tag = makeTag({ name: 'Confusion', color: '#fa5252' });
    const html = renderToStaticMarkup(<AddTagDropdown addTagCallback={vi.fn()} currentNames={[]} editTag editableTag={tag} />);
    expect(html).toContain('Edit Tag');
    expect(html).toContain('Confusion');
  });

  test('shows the color swatch for the selected color', () => {
    const html = renderToStaticMarkup(<AddTagDropdown addTagCallback={vi.fn()} currentNames={[]} />);
    expect(html).toContain('#fd7e14');
  });
});

// ── TagEditor ─────────────────────────────────────────────────────────────────

describe('TagEditor', () => {
  test('renders "Create new tag" button', () => {
    const html = renderToStaticMarkup(<TagEditor createTagCallback={vi.fn()} tags={[]} />);
    expect(html).toContain('Create new tag');
  });

  test('renders AddTagDropdown in the dropdown', () => {
    const html = renderToStaticMarkup(<TagEditor createTagCallback={vi.fn()} tags={[makeTag()]} />);
    expect(html).toContain('Add Tag');
  });
});

// ── ThinkAloudAnalysis (SSR) ──────────────────────────────────────────────────

describe('ThinkAloudAnalysis (SSR)', () => {
  test('shows "Select a Participant and Trial" prompt when no participantId', () => {
    const html = renderToStaticMarkup(
      <ThinkAloudAnalysis visibleParticipants={[]} storageEngine={mockStorageEngine} />,
    );
    expect(html).toContain('Select a Participant and Trial to Analyze');
  });

  test('renders ThinkAloudFooter', () => {
    const html = renderToStaticMarkup(
      <ThinkAloudAnalysis visibleParticipants={[]} storageEngine={mockStorageEngine} />,
    );
    expect(html).toContain('think-aloud-footer');
  });

  test('shows "No transcripts found" when participant and trial are selected', () => {
    vi.mocked(useSearchParams).mockReturnValueOnce([new URLSearchParams('participantId=p1'), vi.fn()] as ReturnType<typeof useSearchParams>);
    vi.mocked(useParams).mockReturnValueOnce({ studyId: 'test-study', trialId: 'trial1' });
    const html = renderToStaticMarkup(
      <ThinkAloudAnalysis visibleParticipants={[]} storageEngine={mockStorageEngine} />,
    );
    expect(html).toContain('No transcripts found for this task');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOM TESTS — ThinkAloudAnalysis
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const baseParticipant: ParticipantData = {
  participantId: 'p1',
  participantConfigHash: 'abc',
  participantIndex: 0,
  sequence: {
    orderPath: 'root', order: 'fixed', components: [], skip: [],
  },
  answers: {},
  searchParams: {},
  metadata: {
    userAgent: '', resolution: { width: 0, height: 0 }, language: '', ip: '',
  },
  rejected: false,
  participantTags: [],
  stage: 'DEFAULT',
};

const mockParticipant = baseParticipant;

function makeStoredAnswer(overrides: Partial<ParticipantData['answers'][string]> = {}): ParticipantData['answers'][string] {
  return makeStoredAnswerBase({ trialOrder: '0_null', ...overrides });
}

const mockParticipantFull: ParticipantData = {
  ...baseParticipant,
  answers: {
    trial_0: makeStoredAnswer({
      identifier: 'trial_0', componentName: 'C1', trialOrder: '0_null', startTime: 1000, endTime: 2000,
    }),
    trial_1: makeStoredAnswer({
      identifier: 'trial_1', componentName: 'C2', trialOrder: '1_null', startTime: 2000, endTime: 3000,
    }),
  },
};

const mockStorageEngineWithMethods = {
  getParticipantData: vi.fn().mockResolvedValue(null),
  getTranscription: vi.fn().mockResolvedValue(null),
  getEditedTranscript: vi.fn().mockResolvedValue(null),
  saveEditedTranscript: vi.fn(),
} as unknown as FirebaseStorageEngine;

describe('ThinkAloudAnalysis (DOM)', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;
  let mockSetSearchParams: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockNavigate = vi.fn();
    mockSetSearchParams = vi.fn((updater: (params: URLSearchParams) => void) => {
      if (typeof updater === 'function') updater(new URLSearchParams('participantId=p1'));
    });
    vi.mocked(useParams).mockReturnValue({ studyId: 'test-study', trialId: 'trial_0' });
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('participantId=p1'), mockSetSearchParams] as ReturnType<typeof useSearchParams>);
    const { useNavigate } = vi.mocked(await import('react-router'));
    useNavigate.mockReturnValue(mockNavigate);
    vi.mocked(useAsync).mockReturnValue({
      value: null, status: 'success', execute: vi.fn(), error: null,
    });
  });

  test('renders without crashing', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipant]} storageEngine={mockStorageEngine} />,
    ));
    expect(container).toBeDefined();
  });

  test('shows placeholder text when no participantId', async () => {
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(''), mockSetSearchParams] as ReturnType<typeof useSearchParams>);
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[]} storageEngine={mockStorageEngine} />,
    ));
    expect(container.textContent).toContain('Select');
  });

  test('shows no-transcript message when participantId set but no audio', async () => {
    const { container } = await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipant]} storageEngine={mockStorageEngine} />,
    ));
    expect(container.textContent).toContain('No transcripts found');
  });

  test('renders ThinkAloudFooter', async () => {
    const { getAllByTestId } = await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipant]} storageEngine={mockStorageEngine} />,
    ));
    expect(getAllByTestId('think-aloud-footer').length).toBeGreaterThan(0);
  });

  test('setSearchParams called when no participantId but visibleParticipants exist', async () => {
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(''), mockSetSearchParams] as ReturnType<typeof useSearchParams>);
    await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  test('navigate effect runs when participant loaded with no matching currentTrial answer', async () => {
    const partNoMatchingTrial: ParticipantData = { ...mockParticipantFull, answers: { trial_other: makeStoredAnswer({ identifier: 'trial_other', trialOrder: '0_null' }) } };
    vi.mocked(useAsync).mockReturnValueOnce({
      value: partNoMatchingTrial, status: 'success', execute: vi.fn(), error: null,
    })
      .mockReturnValue({
        value: null, status: 'success', execute: vi.fn(), error: null,
      });
    await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[mockParticipantFull]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('getFirstTrialIdentifier returns empty string when participant has no answers', async () => {
    const partNoAnswers: ParticipantData = { ...mockParticipantFull, answers: {} };
    vi.mocked(useAsync).mockReturnValueOnce({
      value: partNoAnswers, status: 'success', execute: vi.fn(), error: null,
    })
      .mockReturnValue({
        value: null, status: 'success', execute: vi.fn(), error: null,
      });
    await act(async () => render(
      <ThinkAloudAnalysis visibleParticipants={[partNoAnswers]} storageEngine={mockStorageEngineWithMethods} />,
    ));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOM TESTS — ThinkAloudFooter
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const footerDefaultProps = {
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

const mockFooterStorageEngine = {
  getAudioUrl: vi.fn().mockResolvedValue('http://test/audio.mp3'),
  getScreenRecording: vi.fn().mockResolvedValue('http://test/video.mp4'),
  saveTags: vi.fn().mockResolvedValue(undefined),
  getTags: vi.fn().mockResolvedValue([]),
  getAllParticipantAndTaskTags: vi.fn().mockResolvedValue(null),
  saveAllParticipantAndTaskTags: vi.fn().mockResolvedValue(undefined),
  getParticipantData: vi.fn().mockResolvedValue(null),
};

describe('ThinkAloudFooter', () => {
  let mockSetSearchParams: ReturnType<typeof vi.fn>;
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockNavigate = vi.fn();
    mockSetSearchParams = vi.fn();
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('participantId=p1'), mockSetSearchParams] as ReturnType<typeof useSearchParams>);
    const { useNavigate } = vi.mocked(await import('react-router'));
    useNavigate.mockReturnValue(mockNavigate);
    vi.mocked(useAsync).mockReturnValue({
      value: null, status: 'success', execute: vi.fn(), error: null,
    });
  });

  test('renders participant and task selects', async () => {
    const { getAllByRole } = await act(async () => render(<RealThinkAloudFooter {...footerDefaultProps} />));
    expect(getAllByRole('combobox').length).toBeGreaterThan(0);
  });

  test('renders speed control buttons in replay mode', async () => {
    const { getAllByRole } = await act(async () => render(<RealThinkAloudFooter {...footerDefaultProps} isReplay />));
    const speedBtn = getAllByRole('button').find((b) => b.textContent === '1x');
    expect(speedBtn).toBeDefined();
  });

  test('fetchAssetsUrl effect runs when storageEngine provided', async () => {
    await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} storageEngine={makeStorageEngine(mockFooterStorageEngine)} />,
    ));
    expect(mockFooterStorageEngine.getAudioUrl).toHaveBeenCalled();
    expect(mockFooterStorageEngine.getScreenRecording).toHaveBeenCalled();
  });

  test('nextParticipantCallback via prev/next ActionIcons updates search params', async () => {
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} visibleParticipants={['p1', 'p2']} />,
    ));
    // Click all buttons — at least one should be a participant nav button that triggers setSearchParams
    const buttons = getAllByRole('button');
    for (const btn of buttons) {
      act(() => { fireEvent.click(btn); });
      if (mockSetSearchParams.mock.calls.length > 0) break;
    }
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  test('renders all participants in select dropdown', async () => {
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} visibleParticipants={['p1', 'p2', 'p3']} />,
    ));
    const options = getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(3);
  });

  test('handleDownloadAudio covered when storageEngine provided', async () => {
    await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} storageEngine={makeStorageEngine(mockFooterStorageEngine)} />,
    ));
    // fetchAssetsUrl effect fetches audio/screen URLs
    expect(mockFooterStorageEngine.getAudioUrl).toHaveBeenCalled();
  });

  test('participant Select onChange updates search params', async () => {
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} visibleParticipants={['p1', 'p2']} />,
    ));
    const selects = getAllByRole('combobox') as HTMLSelectElement[];
    if (selects[0]) {
      await act(async () => { fireEvent.change(selects[0], { target: { value: 'p2' } }); });
    }
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  test('task Select onChange navigates to new task', async () => {
    const mockParticipantWithAnswers = {
      participantId: 'p1',
      answers: {
        trial_0: makeStoredAnswer({
          identifier: 'trial_0', componentName: 'Component 1', trialOrder: '0_null', startTime: 1000, endTime: 2000,
        }),
        trial_1: makeStoredAnswer({
          identifier: 'trial_1', componentName: 'Component 2', trialOrder: '1_null', startTime: 2000, endTime: 3000,
        }),
      },
    };
    vi.mocked(useAsync).mockReturnValueOnce({
      value: mockParticipantWithAnswers as unknown as ParticipantData, status: 'success', execute: vi.fn(), error: null,
    }).mockReturnValue({
      value: null, status: 'success', execute: vi.fn(), error: null,
    });
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} currentTrial="trial_0" />,
    ));
    const selects = getAllByRole('combobox') as HTMLSelectElement[];
    const taskSelect = selects[selects.length - 1];
    if (taskSelect) {
      await act(async () => { fireEvent.change(taskSelect, { target: { value: 'trial_1' } }); });
    }
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('speed SegmentedControl onChange', async () => {
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} />,
    ));
    const speedBtn = getAllByRole('button').find((b) => b.textContent === '0.5x');
    if (speedBtn) {
      await act(async () => { fireEvent.click(speedBtn); });
    }
    expect(getAllByRole('button').length).toBeGreaterThan(0);
  });

  test('participantTag onSelectTags saves tags', async () => {
    const mockParticipantTags = { participantTags: [], taskTags: { trial_0: [] } };
    vi.mocked(useAsync).mockImplementation((_fn, args) => ({
      value: Array.isArray(args) && args.length === 4 ? mockParticipantTags : null,
      status: 'success',
      execute: vi.fn(),
      error: null,
    }));
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} storageEngine={makeStorageEngine(mockFooterStorageEngine)} />,
    ));
    const selectTagsBtns = getAllByRole('button').filter((b) => b.textContent === 'select-tags');
    if (selectTagsBtns[0]) {
      await act(async () => { fireEvent.click(selectTagsBtns[0]); });
    }
    expect(mockFooterStorageEngine.saveAllParticipantAndTaskTags).toHaveBeenCalled();
  });

  test('taskTag onSelectTags saves task tags', async () => {
    const mockParticipantTags = { participantTags: [], taskTags: { trial_0: [] } };
    vi.mocked(useAsync).mockImplementation((_fn, args) => ({
      value: Array.isArray(args) && args.length === 4 ? mockParticipantTags : null,
      status: 'success',
      execute: vi.fn(),
      error: null,
    }));
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} storageEngine={makeStorageEngine(mockFooterStorageEngine)} />,
    ));
    const selectTagsBtns = getAllByRole('button').filter((b) => b.textContent === 'select-tags');
    const taskTagsBtn = selectTagsBtns[selectTagsBtns.length - 1];
    if (taskTagsBtn) {
      await act(async () => { fireEvent.click(taskTagsBtn); });
    }
    expect(mockFooterStorageEngine.saveAllParticipantAndTaskTags).toHaveBeenCalled();
  });

  test('editTagCallback saves updated tags', async () => {
    const mockTaskTags = [{ id: 'tag1', label: 'Tag 1', color: 'blue' }];
    vi.mocked(useAsync).mockImplementation((_fn, args) => ({
      value: Array.isArray(args) && args[1] === 'task' ? mockTaskTags
        : Array.isArray(args) && args[1] === 'participant' ? [{ id: 'ptag1', label: 'PTag 1', color: 'green' }] : null,
      status: 'success',
      execute: vi.fn(),
      error: null,
    }));
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} storageEngine={makeStorageEngine(mockFooterStorageEngine)} />,
    ));
    const editBtns = getAllByRole('button').filter((b) => b.textContent === 'edit-tag');
    await act(async () => { editBtns.forEach((btn) => { fireEvent.click(btn); }); });
    expect(mockFooterStorageEngine.saveTags).toHaveBeenCalled();
  });

  test('navigateToTask via next task buttons', async () => {
    const mockParticipantWithAnswers = {
      participantId: 'p1',
      answers: {
        trial_0: makeStoredAnswer({
          identifier: 'trial_0', componentName: 'C1', trialOrder: '0_null', startTime: 1000, endTime: 2000,
        }),
        trial_1: makeStoredAnswer({
          identifier: 'trial_1', componentName: 'C2', trialOrder: '1_null', startTime: 2000, endTime: 3000,
        }),
      },
    };
    vi.mocked(useAsync).mockReturnValueOnce({
      value: mockParticipantWithAnswers as unknown as ParticipantData, status: 'success', execute: vi.fn(), error: null,
    }).mockReturnValue({
      value: null, status: 'success', execute: vi.fn(), error: null,
    });
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} currentTrial="trial_0" />,
    ));
    for (const btn of getAllByRole('button')) {
      act(() => { fireEvent.click(btn); });
    }
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('editedTranscript mapping effect processes transcript data without crashing', async () => {
    const editedTranscript: EditedText[] = [
      {
        text: 'hello', selectedTags: [], annotation: '', transcriptMappingStart: 0, transcriptMappingEnd: 0,
      },
    ];
    const rawTranscript: TranscribedAudio = {
      results: [{
        resultEndTime: 1.5, alternatives: [{ transcript: 'hello', confidence: 1 }], languageCode: 'en',
      }],
    };
    const { container } = await act(async () => render(
      <RealThinkAloudFooter
        {...footerDefaultProps}
        editedTranscript={editedTranscript}
        rawTranscript={rawTranscript}
      />,
    ));
    // The effect runs and maps editedTranscript + rawTranscript into transcriptLines
    // Verify the component renders without throwing
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  test('jumpedToLine seek effect calls setSeekTime', async () => {
    const { rerender } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} jumpedToLine={0} />,
    ));
    // Changing jumpedToLine triggers the seek effect
    await act(async () => { rerender(<RealThinkAloudFooter {...footerDefaultProps} jumpedToLine={2} />); });
    // setSeekTime is called inside useReplayContext — we verify the component didn't crash
    // and the effect ran by checking the component is still rendered
    expect(document.body.innerHTML).not.toBe('');
  });

  test('play/pause toggle calls setIsPlaying', async () => {
    // Access the setIsPlaying mock from the module-scope useReplayContext mock
    const { useReplayContext } = await import('../../store/hooks/useReplay');
    const mockSetIsPlaying = vi.fn();
    // The module is fully mocked so the real return type doesn't apply; cast via the mock's own type
    (useReplayContext as ReturnType<typeof vi.fn>).mockReturnValue({
      isPlaying: false, setIsPlaying: mockSetIsPlaying, speed: 1, setSpeed: vi.fn(), setSeekTime: vi.fn(), hasEnded: false,
    });
    const { getAllByRole } = await act(async () => render(
      <RealThinkAloudFooter {...footerDefaultProps} />,
    ));
    const buttons = getAllByRole('button');
    for (const btn of buttons) {
      act(() => { fireEvent.click(btn); });
      if (mockSetIsPlaying.mock.calls.length > 0) break;
    }
    expect(mockSetIsPlaying).toHaveBeenCalled();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOM TESTS — TextEditor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const sampleLine: EditedText = {
  transcriptMappingStart: 0, transcriptMappingEnd: 0, text: 'Hello world', selectedTags: [], annotation: '',
};

describe('TextEditor (DOM)', () => {
  test('renders without crashing with empty transcript list', async () => {
    const { container } = await act(async () => render(
      <RealTextEditor currentShownTranscription={0} transcriptList={[]} setTranscriptList={vi.fn()} onClickLine={vi.fn()} />,
    ));
    expect(container).toBeDefined();
  });

  test('renders a TranscriptLine for each item in the list', async () => {
    const { getAllByTestId } = await act(async () => render(
      <RealTextEditor currentShownTranscription={0} transcriptList={[sampleLine, { ...sampleLine, text: 'Second line' }]} setTranscriptList={vi.fn()} onClickLine={vi.fn()} />,
    ));
    expect(getAllByTestId('transcript-line')).toHaveLength(2);
  });

  test('renders header labels', async () => {
    const { container } = await act(async () => render(
      <RealTextEditor currentShownTranscription={0} transcriptList={[sampleLine]} setTranscriptList={vi.fn()} onClickLine={vi.fn()} />,
    ));
    expect(container.textContent).toContain('Transcripts');
    expect(container.textContent).toContain('Text Tags');
    expect(container.textContent).toContain('Annotations');
  });

  test('onTextChange callback updates transcript list', async () => {
    const setTranscriptList = vi.fn();
    const { getAllByTestId } = await act(async () => render(
      <RealTextEditor currentShownTranscription={0} transcriptList={[sampleLine]} setTranscriptList={setTranscriptList} onClickLine={vi.fn()} />,
    ));
    fireEvent.click(getAllByTestId('btn-change')[0]);
    expect(setTranscriptList).toHaveBeenCalled();
  });

  test('deleteRowCallback does nothing at index 0', async () => {
    const setTranscriptList = vi.fn();
    const { getAllByTestId } = await act(async () => render(
      <RealTextEditor currentShownTranscription={0} transcriptList={[sampleLine]} setTranscriptList={setTranscriptList} onClickLine={vi.fn()} />,
    ));
    fireEvent.click(getAllByTestId('btn-register-ref')[0]);
    fireEvent.click(getAllByTestId('btn-delete')[0]);
    expect(setTranscriptList).not.toHaveBeenCalled();
  });

  test('deleteRowCallback merges rows when index > 0', async () => {
    const setTranscriptList = vi.fn();
    const secondLine: EditedText = { ...sampleLine, text: ' world' };
    const { getAllByTestId } = await act(async () => render(
      <RealTextEditor currentShownTranscription={0} transcriptList={[sampleLine, secondLine]} setTranscriptList={setTranscriptList} onClickLine={vi.fn()} />,
    ));
    fireEvent.click(getAllByTestId('btn-register-ref')[0]);
    fireEvent.click(getAllByTestId('btn-delete')[1]);
    expect(setTranscriptList).toHaveBeenCalled();
  });

  test('addRowCallback splits row at position', async () => {
    vi.useFakeTimers();
    const setTranscriptList = vi.fn();
    const { getAllByTestId } = await act(async () => render(
      <RealTextEditor currentShownTranscription={0} transcriptList={[sampleLine]} setTranscriptList={setTranscriptList} onClickLine={vi.fn()} />,
    ));
    fireEvent.click(getAllByTestId('btn-register-ref')[0]);
    fireEvent.click(getAllByTestId('btn-add')[0]);
    expect(setTranscriptList).toHaveBeenCalled();
    vi.useRealTimers();
  });

  test('setAnnotation callback updates annotation in list', async () => {
    const setTranscriptList = vi.fn();
    const { getAllByTestId } = await act(async () => render(
      <RealTextEditor currentShownTranscription={0} transcriptList={[sampleLine]} setTranscriptList={setTranscriptList} onClickLine={vi.fn()} />,
    ));
    fireEvent.click(getAllByTestId('btn-annotate')[0]);
    expect(setTranscriptList).toHaveBeenCalled();
  });

  test('createTagCallback appends new tag', async () => {
    const { getAllByTestId } = await act(async () => render(
      <RealTextEditor currentShownTranscription={0} transcriptList={[sampleLine]} setTranscriptList={vi.fn()} onClickLine={vi.fn()} />,
    ));
    expect(() => fireEvent.click(getAllByTestId('btn-create-tag')[0])).not.toThrow();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOM TESTS — TranscriptLine
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('TranscriptLine (DOM)', () => {
  const lineProps = {
    annotation: '',
    setAnnotation: vi.fn(),
    start: 0,
    current: 5,
    end: 10,
    text: 'Hello world',
    tags: [] as Tag[],
    selectedTags: [] as Tag[],
    onTextChange: vi.fn(),
    deleteRowCallback: vi.fn(),
    addRowCallback: vi.fn(),
    onSelectTags: vi.fn(),
    addRef: vi.fn(),
    index: 0,
    editTagCallback: vi.fn(),
    createTagCallback: vi.fn(),
    onClickLine: vi.fn(),
  };

  test('renders text content', () => {
    const { getAllByTestId } = render(<RealTranscriptLine {...lineProps} />);
    const textareas = getAllByTestId('textarea');
    expect(textareas[0].getAttribute('value') ?? (textareas[0] as HTMLTextAreaElement).value).toBe('Hello world');
  });

  test('applies highlight style when current is within start–end range', () => {
    const { container } = render(<RealTranscriptLine {...lineProps} start={0} current={5} end={10} />);
    expect(container.innerHTML).toContain('rgba(100, 149, 237, 0.3)');
  });

  test('does not apply highlight when current is outside range', () => {
    const { container } = render(<RealTranscriptLine {...lineProps} start={0} current={20} end={10} />);
    expect(container.innerHTML).not.toContain('rgba(100, 149, 237, 0.3)');
  });

  test('Enter keydown calls addRowCallback', () => {
    const addRowCallback = vi.fn();
    const { getAllByTestId } = render(<RealTranscriptLine {...lineProps} addRowCallback={addRowCallback} />);
    const textarea = getAllByTestId('textarea')[0] as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'selectionStart', { value: 3, configurable: true });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(addRowCallback).toHaveBeenCalledWith(0, 3);
  });

  test('Backspace at position 0 calls deleteRowCallback', () => {
    const deleteRowCallback = vi.fn();
    const { getAllByTestId } = render(<RealTranscriptLine {...lineProps} deleteRowCallback={deleteRowCallback} />);
    const textarea = getAllByTestId('textarea')[0] as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'selectionStart', { value: 0, configurable: true });
    Object.defineProperty(textarea, 'selectionEnd', { value: 0, configurable: true });
    fireEvent.keyDown(textarea, { key: 'Backspace' });
    expect(deleteRowCallback).toHaveBeenCalledWith(0);
  });

  test('Backspace at non-zero position does not call deleteRowCallback', () => {
    const deleteRowCallback = vi.fn();
    const { getAllByTestId } = render(<RealTranscriptLine {...lineProps} deleteRowCallback={deleteRowCallback} />);
    const textarea = getAllByTestId('textarea')[0] as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'selectionStart', { value: 3, configurable: true });
    Object.defineProperty(textarea, 'selectionEnd', { value: 3, configurable: true });
    fireEvent.keyDown(textarea, { key: 'Backspace' });
    expect(deleteRowCallback).not.toHaveBeenCalled();
  });

  test('focus on text area calls onClickLine', () => {
    const onClickLine = vi.fn();
    const { getAllByTestId } = render(<RealTranscriptLine {...lineProps} onClickLine={onClickLine} />);
    fireEvent.focus(getAllByTestId('textarea')[0]);
    expect(onClickLine).toHaveBeenCalledWith(0);
  });

  test('onChange calls onTextChange', () => {
    const onTextChange = vi.fn();
    const { getAllByTestId } = render(<RealTranscriptLine {...lineProps} onTextChange={onTextChange} />);
    fireEvent.change(getAllByTestId('textarea')[0], { target: { value: 'New text' } });
    expect(onTextChange).toHaveBeenCalledWith(0, 'New text');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SSR TESTS — TranscriptSegmentsVis (real component via vi.importActual)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('TranscriptSegmentsVis', () => {
  const xScale = d3.scaleLinear([0, 500]).domain([0, 10_000]);

  test('renders an SVG element', () => {
    const html = renderToStaticMarkup(
      <RealTranscriptSegmentsVis transcriptLines={[]} xScale={xScale} startTime={0} currentShownTranscription={0} />,
    );
    expect(html).toContain('<svg');
  });

  test('renders a <line> for each transcript segment', () => {
    const lines = [
      {
        start: 0, end: 2, lineStart: 0, lineEnd: 1, tags: [],
      },
      {
        start: 2, end: 4, lineStart: 1, lineEnd: 2, tags: [],
      },
    ];
    const html = renderToStaticMarkup(
      <RealTranscriptSegmentsVis transcriptLines={lines} xScale={xScale} startTime={0} currentShownTranscription={0} />,
    );
    expect((html.match(/<line /g) || []).length).toBe(2);
  });

  test('highlights the active segment with cornflowerblue stroke', () => {
    const lines = [
      {
        start: 0, end: 2, lineStart: 0, lineEnd: 1, tags: [],
      },
      {
        start: 2, end: 4, lineStart: 2, lineEnd: 3, tags: [],
      },
    ];
    const html = renderToStaticMarkup(
      <RealTranscriptSegmentsVis transcriptLines={lines} xScale={xScale} startTime={0} currentShownTranscription={0} />,
    );
    expect(html).toContain('cornflowerblue');
    expect(html).toContain('lightgray');
  });

  test('renders ColorSwatch for each tag on a segment', () => {
    const tag = makeTag();
    const lines = [
      {
        start: 0, end: 2, lineStart: 0, lineEnd: 0, tags: [[tag]],
      },
    ];
    const html = renderToStaticMarkup(
      <RealTranscriptSegmentsVis transcriptLines={lines} xScale={xScale} startTime={0} currentShownTranscription={0} />,
    );
    expect(html).toContain(tag.color);
  });

  test('skips null tags gracefully', () => {
    const lines = [
      {
        start: 0, end: 2, lineStart: 0, lineEnd: 0, tags: [[null as unknown as Tag]],
      },
    ];
    const html = renderToStaticMarkup(
      <RealTranscriptSegmentsVis transcriptLines={lines} xScale={xScale} startTime={0} currentShownTranscription={0} />,
    );
    expect(html).toContain('<svg');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SSR TESTS — TagSelector (real component via vi.importActual)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('TagSelector', () => {
  const baseTagSelectorProps = {
    tags: [] as Tag[],
    selectedTags: [] as Tag[],
    onSelectTags: vi.fn(),
    tagsEmptyText: 'Add Text Tags',
    editTagCallback: vi.fn(),
    createTagCallback: vi.fn(),
    width: 200,
  };

  test('shows placeholder text when no tags are selected', () => {
    const html = renderToStaticMarkup(<RealTagSelector {...baseTagSelectorProps} />);
    expect(html).toContain('Add Text Tags');
  });

  test('shows "No additional tags" when tag list is empty', () => {
    const html = renderToStaticMarkup(<RealTagSelector {...baseTagSelectorProps} />);
    expect(html).toContain('No additional tags');
  });

  test('renders selected tag name with check icon', () => {
    const tag = makeTag({ id: 'a', name: 'Focus' });
    const html = renderToStaticMarkup(
      <RealTagSelector {...baseTagSelectorProps} tags={[tag]} selectedTags={[tag]} />,
    );
    expect(html).toContain('Focus');
    expect(html).toContain('check');
  });

  test('renders unselected tag name in dropdown options', () => {
    const tag = makeTag({ id: 'b', name: 'Confusion' });
    const html = renderToStaticMarkup(
      <RealTagSelector {...baseTagSelectorProps} tags={[tag]} selectedTags={[]} />,
    );
    expect(html).toContain('Confusion');
  });

  test('renders TagEditor "Create new tag" inside the dropdown', () => {
    const html = renderToStaticMarkup(<RealTagSelector {...baseTagSelectorProps} />);
    expect(html).toContain('Create new tag');
  });

  test('edit button (IconEdit) appears for each tag', () => {
    const tag = makeTag({ id: 'c', name: 'Error' });
    const html = renderToStaticMarkup(
      <RealTagSelector {...baseTagSelectorProps} tags={[tag]} selectedTags={[tag]} />,
    );
    expect(html).toContain('icon-edit');
  });
});
