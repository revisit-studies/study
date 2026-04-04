import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  describe, expect, test, vi,
} from 'vitest';
import * as d3 from 'd3';
import { useParams, useSearchParams } from 'react-router';
import { EditedText, Tag } from './types';
import type { FirebaseStorageEngine } from '../../../storage/engines/FirebaseStorageEngine';
import { TranscriptSegmentsVis } from './TranscriptSegmentsVis';
import { Pills } from './tags/Pills';
import { AddTagDropdown } from './tags/AddTagDropdown';
import { TagEditor } from './tags/TagEditor';
import { TagSelector } from './tags/TagSelector';
import { TranscriptLine } from './TranscriptLine';
import { TextEditor } from './TextEditor';
import { ThinkAloudAnalysis } from './ThinkAloudAnalysis';

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('@mantine/core', () => ({
  Center: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Grid: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    { Col: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  Textarea: ({ value, placeholder }: { value?: string; placeholder?: string }) => (
    <textarea defaultValue={value} placeholder={placeholder} />
  ),
  Tooltip: ({ children, label }: { children: ReactNode; label?: ReactNode }) => (
    <div title={String(label)}>{children}</div>
  ),
  ColorSwatch: ({ color }: { color: string }) => <div data-color={color} />,
  Pill: Object.assign(
    ({ children }: { children: ReactNode }) => <span>{children}</span>,
    { Group: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  ),
  Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  ColorPicker: ({ value }: { value?: string }) => <div data-colorpicker={value} />,
  TextInput: ({ placeholder, value }: { placeholder?: string; value?: string }) => (
    <input placeholder={placeholder} defaultValue={value} />
  ),
  Popover: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Target: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  Loader: () => <span>loading</span>,
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
  PillsInput: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Field: () => <input />,
      Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  Input: { Placeholder: ({ children }: { children: ReactNode }) => <span>{children}</span> },
  ActionIcon: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CheckIcon: () => <span>check</span>,
  useCombobox: () => ({
    toggleDropdown: vi.fn(),
    openDropdown: vi.fn(),
    closeDropdown: vi.fn(),
  }),
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [{ current: null }, { width: 200, height: 20 }],
}));

vi.mock('@tabler/icons-react', () => ({
  IconInfoCircle: () => <span>icon-info</span>,
  IconEdit: () => <span>icon-edit</span>,
}));

vi.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));

vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({ studyId: 'test-study', trialId: undefined })),
  useLocation: vi.fn(() => ({ search: '' })),
  useNavigate: vi.fn(() => vi.fn()),
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
}));

vi.mock('../../../store/hooks/useAsync', () => ({
  useAsync: vi.fn(() => ({
    value: null, status: 'idle', error: null, execute: vi.fn(),
  })),
}));

vi.mock('../../../store/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { user: { email: 'test@test.com' } } })),
}));

vi.mock('../../../store/hooks/useReplay', () => ({
  useReplay: vi.fn(() => ({})),
  ReplayContext: { Provider: ({ children }: { children: ReactNode }) => <div>{children}</div> },
}));

vi.mock('../../../store/hooks/useEvent', () => ({
  useEvent: (fn: unknown) => fn,
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: vi.fn(() => ({ storageEngine: undefined })),
}));

vi.mock('./ThinkAloudFooter', () => ({
  ThinkAloudFooter: () => <div>ThinkAloudFooter</div>,
}));

vi.mock('../../../storage/engines/FirebaseStorageEngine', () => ({
  FirebaseStorageEngine: class { },
}));

vi.mock('../../../utils/parseTrialOrder', () => ({
  parseTrialOrder: vi.fn(() => ({ step: 0, funcIndex: null })),
}));

vi.mock('lodash.debounce', () => ({
  default: (fn: unknown) => fn,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1', name: 'Confusion', color: '#fa5252', ...overrides,
  };
}

const xScale = d3.scaleLinear([0, 500]).domain([0, 10_000]);

// ── TranscriptSegmentsVis ─────────────────────────────────────────────────────

describe('TranscriptSegmentsVis', () => {
  test('renders an SVG element', () => {
    const html = renderToStaticMarkup(
      <TranscriptSegmentsVis
        transcriptLines={[]}
        xScale={xScale}
        startTime={0}
        currentShownTranscription={0}
      />,
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
      <TranscriptSegmentsVis
        transcriptLines={lines}
        xScale={xScale}
        startTime={0}
        currentShownTranscription={0}
      />,
    );
    // Two <line> elements expected
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
      <TranscriptSegmentsVis
        transcriptLines={lines}
        xScale={xScale}
        startTime={0}
        currentShownTranscription={0}
      />,
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
      <TranscriptSegmentsVis
        transcriptLines={lines}
        xScale={xScale}
        startTime={0}
        currentShownTranscription={0}
      />,
    );
    expect(html).toContain(tag.color);
  });

  test('skips null tags gracefully', () => {
    const lines = [
      {
        start: 0,
        end: 2,
        lineStart: 0,
        lineEnd: 0,
        tags: [[null as unknown as Tag]],
      },
    ];
    const html = renderToStaticMarkup(
      <TranscriptSegmentsVis
        transcriptLines={lines}
        xScale={xScale}
        startTime={0}
        currentShownTranscription={0}
      />,
    );
    expect(html).toContain('<svg');
  });
});

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
});

// ── AddTagDropdown ────────────────────────────────────────────────────────────

describe('AddTagDropdown', () => {
  test('renders add-mode with "Add Tag" button', () => {
    const html = renderToStaticMarkup(
      <AddTagDropdown
        addTagCallback={vi.fn()}
        currentNames={[]}
      />,
    );
    expect(html).toContain('Add Tag');
    expect(html).toContain('Enter tag name');
  });

  test('renders edit-mode prefilled with tag name', () => {
    const tag = makeTag({ name: 'Confusion', color: '#fa5252' });
    const html = renderToStaticMarkup(
      <AddTagDropdown
        addTagCallback={vi.fn()}
        currentNames={[]}
        editTag
        editableTag={tag}
      />,
    );
    expect(html).toContain('Edit Tag');
    expect(html).toContain('Confusion');
  });

  test('shows the color swatch for the selected color', () => {
    const html = renderToStaticMarkup(
      <AddTagDropdown
        addTagCallback={vi.fn()}
        currentNames={[]}
      />,
    );
    // Default color is #fd7e14
    expect(html).toContain('#fd7e14');
  });
});

// ── TagEditor ─────────────────────────────────────────────────────────────────

describe('TagEditor', () => {
  test('renders "Create new tag" button', () => {
    const html = renderToStaticMarkup(
      <TagEditor createTagCallback={vi.fn()} tags={[]} />,
    );
    expect(html).toContain('Create new tag');
  });

  test('renders AddTagDropdown in the dropdown', () => {
    const html = renderToStaticMarkup(
      <TagEditor createTagCallback={vi.fn()} tags={[makeTag()]} />,
    );
    // AddTagDropdown renders "Add Tag" button inside the dropdown
    expect(html).toContain('Add Tag');
  });
});

// ── ThinkAloudAnalysis ────────────────────────────────────────────────────────

describe('ThinkAloudAnalysis', () => {
  test('shows "Select a Participant and Trial" prompt when no participantId', () => {
    const html = renderToStaticMarkup(
      <ThinkAloudAnalysis
        visibleParticipants={[]}
        storageEngine={undefined as unknown as FirebaseStorageEngine}
      />,
    );
    expect(html).toContain('Select a Participant and Trial to Analyze');
  });

  test('renders ThinkAloudFooter', () => {
    const html = renderToStaticMarkup(
      <ThinkAloudAnalysis
        visibleParticipants={[]}
        storageEngine={undefined as unknown as FirebaseStorageEngine}
      />,
    );
    expect(html).toContain('ThinkAloudFooter');
  });

  test('shows "No transcripts found" when participant and trial are selected', () => {
    vi.mocked(useSearchParams).mockReturnValueOnce([new URLSearchParams('participantId=p1'), vi.fn()] as ReturnType<typeof useSearchParams>);
    vi.mocked(useParams).mockReturnValueOnce({ studyId: 'test-study', trialId: 'trial1' });

    const html = renderToStaticMarkup(
      <ThinkAloudAnalysis
        visibleParticipants={[]}
        storageEngine={undefined as unknown as FirebaseStorageEngine}
      />,
    );
    // hasAudio is undefined on initial SSR render (useEffect never runs),
    // so the "no audio" branch renders regardless of transcript fetch status
    expect(html).toContain('No transcripts found for this task');
  });
});

// ── Pills ───────────────────────────────────────

describe('Pills (branch coverage)', () => {
  test('renders dark text color on a light tag (lightness > 0.7 branch)', () => {
    // white has lightness=1, hitting the "color: black" branch in the styles ternary
    const html = renderToStaticMarkup(<Pills selectedTags={[makeTag({ color: '#ffffff' })]} />);
    expect(html).toContain('Confusion');
  });

  test('renders with removeFunc — withRemoveButton is truthy', () => {
    const html = renderToStaticMarkup(
      <Pills selectedTags={[makeTag()]} removeFunc={vi.fn()} />,
    );
    expect(html).toContain('Confusion');
  });
});

// ── TagSelector ───────────────────────────────────────────────────────────────

describe('TagSelector', () => {
  const baseProps = {
    tags: [] as Tag[],
    selectedTags: [] as Tag[],
    onSelectTags: vi.fn(),
    tagsEmptyText: 'Add Text Tags',
    editTagCallback: vi.fn(),
    createTagCallback: vi.fn(),
    width: 200,
  };

  test('shows placeholder text when no tags are selected', () => {
    const html = renderToStaticMarkup(<TagSelector {...baseProps} />);
    expect(html).toContain('Add Text Tags');
  });

  test('shows "No additional tags" when tag list is empty', () => {
    const html = renderToStaticMarkup(<TagSelector {...baseProps} />);
    expect(html).toContain('No additional tags');
  });

  test('renders selected tag name with check icon', () => {
    const tag = makeTag({ id: 'a', name: 'Focus' });
    const html = renderToStaticMarkup(
      <TagSelector {...baseProps} tags={[tag]} selectedTags={[tag]} />,
    );
    expect(html).toContain('Focus');
    expect(html).toContain('check'); // CheckIcon rendered for selected option
  });

  test('renders unselected tag name in dropdown options', () => {
    const tag = makeTag({ id: 'b', name: 'Confusion' });
    const html = renderToStaticMarkup(
      <TagSelector {...baseProps} tags={[tag]} selectedTags={[]} />,
    );
    expect(html).toContain('Confusion');
  });

  test('renders TagEditor "Create new tag" inside the dropdown', () => {
    const html = renderToStaticMarkup(<TagSelector {...baseProps} />);
    expect(html).toContain('Create new tag');
  });

  test('edit button (IconEdit) appears for each tag', () => {
    const tag = makeTag({ id: 'c', name: 'Error' });
    const html = renderToStaticMarkup(
      <TagSelector {...baseProps} tags={[tag]} selectedTags={[tag]} />,
    );
    expect(html).toContain('icon-edit');
  });
});

// ── TranscriptLine ────────────────────────────────────────────────────────────

describe('TranscriptLine', () => {
  const baseProps = {
    annotation: '',
    setAnnotation: vi.fn(),
    start: 0,
    end: 10,
    current: 5,
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

  test('renders the transcript text', () => {
    const html = renderToStaticMarkup(<TranscriptLine {...baseProps} />);
    expect(html).toContain('Hello world');
  });

  test('shows "Add Annotation" placeholder for the annotation field', () => {
    const html = renderToStaticMarkup(<TranscriptLine {...baseProps} />);
    expect(html).toContain('Add Annotation');
  });

  test('shows TagSelector placeholder text', () => {
    const html = renderToStaticMarkup(<TranscriptLine {...baseProps} />);
    expect(html).toContain('Add Text Tags');
  });

  test('renders selected tags inside TagSelector', () => {
    const tag = makeTag({ name: 'Focus' });
    const html = renderToStaticMarkup(
      <TranscriptLine {...baseProps} tags={[tag]} selectedTags={[tag]} />,
    );
    expect(html).toContain('Focus');
  });
});

// ── TextEditor ────────────────────────────────────────────────────────────────

describe('TextEditor', () => {
  function makeEditedText(overrides: Partial<EditedText> = {}): EditedText {
    return {
      transcriptMappingStart: 0,
      transcriptMappingEnd: 0,
      text: 'Sample',
      selectedTags: [],
      annotation: '',
      ...overrides,
    };
  }

  test('renders Transcripts, Text Tags, and Annotations column headers', () => {
    const html = renderToStaticMarkup(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={[]}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    );
    expect(html).toContain('Transcripts');
    expect(html).toContain('Text Tags');
    expect(html).toContain('Annotations');
  });

  test('renders transcript text for each item in the list', () => {
    const items = [
      makeEditedText({ text: 'First line' }),
      makeEditedText({ text: 'Second line' }),
    ];
    const html = renderToStaticMarkup(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={items}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    );
    expect(html).toContain('First line');
    expect(html).toContain('Second line');
  });

  test('renders selected tags inside transcript lines', () => {
    const tag = makeTag({ name: 'Focus' });
    const items = [makeEditedText({ selectedTags: [tag] })];
    const html = renderToStaticMarkup(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={items}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    );
    expect(html).toContain('Focus');
  });

  test('shows tag placeholder text when no tags are selected for a line', () => {
    const items = [makeEditedText()];
    const html = renderToStaticMarkup(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={items}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    );
    expect(html).toContain('Add Text Tags');
  });

  test('shows "Add Annotation" placeholder for each transcript line', () => {
    const items = [makeEditedText()];
    const html = renderToStaticMarkup(
      <TextEditor
        currentShownTranscription={0}
        transcriptList={items}
        setTranscriptList={vi.fn()}
        onClickLine={vi.fn()}
      />,
    );
    expect(html).toContain('Add Annotation');
  });
});
