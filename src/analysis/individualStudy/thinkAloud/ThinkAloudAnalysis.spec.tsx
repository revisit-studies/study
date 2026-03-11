import { MantineProvider } from '@mantine/core';
import { createContext, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as d3 from 'd3';
import {
  describe, expect, it, vi,
} from 'vitest';
import { TextEditor } from './TextEditor';
import { ThinkAloudFooter } from './ThinkAloudFooter';
import { TranscriptLine } from './TranscriptLine';
import { TranscriptSegmentsVis } from './TranscriptSegmentsVis';
import { TagSelector } from './tags/TagSelector';
import { TagEditor } from './tags/TagEditor';
import { Pills } from './tags/Pills';
import { AddTagDropdown } from './tags/AddTagDropdown';
import { ThinkAloudAnalysis } from './ThinkAloudAnalysis';

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  type AppShellWithFooter = {
    ({ children }: { children: ReactNode }): ReactNode;
    Footer: ({ children }: { children: ReactNode }) => ReactNode;
  };

  function MockAppShell({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  function MockAppShellFooter({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  const mockAppShellWithFooter = MockAppShell as AppShellWithFooter;
  mockAppShellWithFooter.Footer = MockAppShellFooter;

  return {
    ...actual,
    AppShell: mockAppShellWithFooter,
  };
});

vi.mock('react-router', () => ({
  useLocation: () => ({ search: '', pathname: '/analysis/stats/study-a/tagging' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ studyId: 'study-a', trialId: undefined }),
  useSearchParams: () => [new URLSearchParams('participantId=p1'), vi.fn()],
}));

vi.mock('@mantine/hooks', () => ({
  useResizeObserver: () => [vi.fn(), { width: 220 }],
}));

vi.mock('../../../store/hooks/useAuth', () => ({
  useAuth: () => ({ user: { user: { email: 'a@b.com' } } }),
}));

vi.mock('../../../store/hooks/useAsync', () => ({
  useAsync: () => ({ value: null, status: 'success', execute: vi.fn() }),
}));

vi.mock('../../../store/hooks/useEvent', () => ({
  useEvent: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('../../../store/hooks/useReplay', () => {
  const ctx = createContext({});
  return {
    ReplayContext: ctx,
    useReplay: () => ({}),
    useReplayContext: () => ({
      isPlaying: false,
      setIsPlaying: vi.fn(),
      speed: 1,
      setSpeed: vi.fn(),
      setSeekTime: vi.fn(),
      hasEnded: false,
    }),
  };
});

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: undefined }),
}));

vi.mock('uuid', () => ({
  v4: () => 'uuid-1',
}));

vi.mock('../../../components/audioAnalysis/AudioProvenanceVis', () => ({
  AudioProvenanceVis: () => <div>audio-provenance</div>,
}));

vi.mock('../ParticipantRejectModal', () => ({
  ParticipantRejectModal: () => <div>reject-modal</div>,
}));

vi.mock('../../../components/audioAnalysis/provenanceColors', () => ({
  buildProvenanceLegendEntries: () => new Map(),
}));

vi.mock('../../../utils/syncReplay', () => ({
  revisitPageId: 'page-1',
  syncChannel: { postMessage: vi.fn() },
}));

vi.mock('../../../utils/handleDownloadFiles', () => ({
  handleTaskAudio: vi.fn(),
  handleTaskScreenRecording: vi.fn(),
}));

describe('ThinkAloudAnalysis', () => {
  it('renders selection prompt when participant or trial is missing', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ThinkAloudAnalysis visibleParticipants={[]} storageEngine={{} as never} />
      </MantineProvider>,
    );

    expect(html).toContain('Select a Participant and Trial to Analyze');
    expect(html).toContain('Participant Id');
  });
});

describe('TextEditor', () => {
  it('renders transcript header and transcript lines', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TextEditor
          currentShownTranscription={0}
          transcriptList={[{
            transcriptMappingStart: 0,
            transcriptMappingEnd: 0,
            text: 'hello world',
            selectedTags: [],
            annotation: '',
          }]}
          setTranscriptList={vi.fn()}
          onClickLine={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Transcripts');
    expect(html).toContain('Text Tags');
    expect(html).toContain('Annotations');
    expect(html).toContain('hello world');
  });
});

describe('TranscriptLine', () => {
  it('renders transcript, tag selector, and annotation input', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TranscriptLine
          annotation=""
          setAnnotation={vi.fn()}
          start={0}
          current={0}
          end={1}
          text="hello line"
          tags={[]}
          selectedTags={[]}
          onTextChange={vi.fn()}
          deleteRowCallback={vi.fn()}
          addRowCallback={vi.fn()}
          onSelectTags={vi.fn()}
          addRef={vi.fn()}
          index={0}
          editTagCallback={vi.fn()}
          createTagCallback={vi.fn()}
          onClickLine={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(html).toContain('hello line');
    expect(html).toContain('Add Text Tags');
    expect(html).toContain('Add Annotation');
  });
});

describe('ThinkAloudFooter', () => {
  it('renders footer controls and replay/transcript toggle button', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ThinkAloudFooter
          visibleParticipants={['p1', 'p2']}
          rawTranscript={null}
          currentShownTranscription={0}
          width={1000}
          onTimeUpdate={vi.fn()}
          isReplay={false}
          editedTranscript={[]}
          currentTrial="trial-1"
          saveProvenance={vi.fn()}
          jumpedToLine={0}
          studyId="study-a"
          setHasAudio={vi.fn()}
          storageEngine={{} as never}
        />
      </MantineProvider>,
    );

    expect(html).toContain('audio-provenance');
    expect(html).toContain('Participant Id');
    expect(html).toContain('Task');
    expect(html).toContain('Replay');
    expect(html).toContain('reject-modal');
  });
});

describe('TranscriptSegmentsVis', () => {
  it('renders segment line and tag swatches', () => {
    const scale = d3.scaleLinear([0, 200]).domain([0, 1000]);
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TranscriptSegmentsVis
          transcriptLines={[{
            start: 0,
            end: 0.5,
            lineStart: 0,
            lineEnd: 0,
            tags: [[{ id: 't1', name: 'Tag 1', color: '#ff0000' }]],
          }]}
          xScale={scale}
          startTime={0}
          currentShownTranscription={0}
        />
      </MantineProvider>,
    );

    expect(html).toContain('<line');
    expect(html).toContain('mantine-ColorSwatch-root');
  });
});

describe('TagSelector', () => {
  it('shows empty placeholder and editor when no selected tags', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TagSelector
          tags={[{ id: 't1', name: 'Tag 1', color: '#f00' }]}
          selectedTags={[]}
          onSelectTags={vi.fn()}
          tagsEmptyText="Add Text Tags"
          editTagCallback={vi.fn()}
          createTagCallback={vi.fn()}
          width={220}
        />
      </MantineProvider>,
    );

    expect(html).toContain('Add Text Tags');
  });
});

describe('TagEditor', () => {
  it('renders create new tag button and dropdown', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <TagEditor createTagCallback={vi.fn()} tags={[]} />
      </MantineProvider>,
    );

    expect(html).toContain('Create new tag');
  });
});

describe('Pills', () => {
  it('renders pills for selected tags', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <>
          {Pills({
            selectedTags: [{ id: 't1', name: 'Tag A', color: '#ff0000' }],
            removeFunc: vi.fn(),
          })}
        </>
      </MantineProvider>,
    );

    expect(html).toContain('Tag A');
  });
});

describe('AddTagDropdown', () => {
  it('renders add tag UI elements', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <AddTagDropdown addTagCallback={vi.fn()} currentNames={[]} />
      </MantineProvider>,
    );

    expect(html).toContain('Enter tag name');
    expect(html).toContain('Add Tag');
  });
});
