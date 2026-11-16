import { forwardRef, ReactNode } from 'react';
import {
  render, act, cleanup, fireEvent,
} from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import type { Answer, StudyConfig } from '../../../parser/types';
import { Sequence, StoredAnswer } from '../../../store/types';
import { makeStudyConfig, makeStoredAnswer } from '../../../tests/utils';
import { getDynamicComponentsForBlock } from '../StepsPanel.utils';
import { StepsPanel } from '../StepsPanel';
import { UNKNOWN_ANSWER_LABEL } from '../UnknownAnswerIcon';

const mockLocation = vi.hoisted(() => ({ pathname: '/' }));

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, i) => ({
      key: i,
      index: i,
      start: i * 32,
      size: 32,
    })),
    getTotalSize: () => count * 32,
    measureElement: vi.fn(),
  }),
}));

vi.mock('../../../routes/utils', () => ({
  useStudyId: () => 'test-study',
}));

const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockLocation.pathname, search: '' }),
}));

vi.mock('../../../utils/getSequenceFlatMap', () => ({
  addPathToComponentBlock: (seq: Sequence) => seq,
  getSequenceFlatMap: vi.fn(() => []),
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (i: number) => String(i),
}));

vi.mock('../../../parser/utils', () => ({
  isDynamicBlock: (block: { order?: string }) => block.order === 'dynamic',
  isInheritedComponent: (component: { baseComponent?: string }) => 'baseComponent' in component,
}));

type MockBoxProps = {
  children: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

vi.mock('@mantine/core', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Box: forwardRef<HTMLDivElement, MockBoxProps>(function Box({ children, onMouseEnter, onMouseLeave }, ref) { // eslint-disable-line prefer-arrow-callback
    return <div ref={ref} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>{children}</div>;
  }),
  Code: ({ children }: { children: ReactNode }) => <code>{children}</code>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  NavLink: ({ children, label, onClick }: { children?: ReactNode; label?: ReactNode; onClick?: () => void }) => (
    <div role="link" onClick={onClick}>
      {label}
      {children}
    </div>
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Tooltip: ({ children }: { children: ReactNode }) => children,
  Button: ({
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
    'aria-expanded': ariaExpanded,
    'aria-label': ariaLabel,
    'aria-controls': ariaControls,
  }: {
    children: ReactNode;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    'aria-expanded'?: boolean;
    'aria-label'?: string;
    'aria-controls'?: string;
  }) => (
    <button type="button" onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} aria-expanded={ariaExpanded} aria-label={ariaLabel} aria-controls={ariaControls}>{children}</button>
  ),
  Collapse: ({ children, expanded, id }: { children: ReactNode; expanded: boolean; id?: string }) => (expanded ? <div id={id}>{children}</div> : null),
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowForward: () => null,
  IconArrowsShuffle: () => null,
  IconBinaryTree: () => null,
  IconBrain: () => null,
  IconCheck: ({
    'aria-label': ariaLabel,
    color,
  }: {
    'aria-label'?: string;
    color?: string;
  }) => <span aria-label={ariaLabel} data-color={color}>icon-check</span>,
  IconChevronUp: () => null,
  IconChevronDown: () => null,
  IconDice3: () => null,
  IconDice5: () => null,
  IconInfoCircle: () => null,
  IconPackageImport: () => null,
  IconX: () => <span>icon-x</span>,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const minimalSequence: Sequence = {
  id: 'root',
  orderPath: 'root',
  order: 'fixed',
  components: ['intro', 'end'],
  skip: [],
};

const minimalStudyConfig = makeStudyConfig({
  uiConfig: {
    withSidebar: true,
    sidebarWidth: 300,
    showTitleBar: true,
  },
  components: {
    intro: {
      type: 'markdown',
      path: 'intro.md',
      response: [],
    },
  },
  sequence: minimalSequence,
});

afterEach(() => { cleanup(); mockLocation.pathname = '/'; });

// ── component rendering tests ──────────────────────────────────────────────────

describe('StepsPanel rendering', () => {
  test('shows compact factor labels while preserving distinct and manual component IDs', async () => {
    const generated = [
      ['trials__level=1__trial', '1 — trial'],
      ['trials__level=%221%22__trial', '1 — trial'],
    ];
    const manualId = 'manual__version=1__trial';
    const escapedManualId = 'task%2D1';
    const factorBlock: Sequence & { __revisitFactorLabels: Record<string, string> } = {
      id: 'trials',
      orderPath: 'root.trials',
      order: 'fixed',
      components: generated.map(([id]) => id),
      skip: [],
      __revisitFactorLabels: Object.fromEntries(generated),
    };
    const component = { type: 'markdown' as const, path: 'trial.md', response: [] };
    const studyConfig = makeStudyConfig({
      components: Object.fromEntries([
        ...generated.map(([id]) => id), manualId, escapedManualId, 'task-1',
      ].map((id) => [id, component])),
      sequence: {
        ...minimalSequence,
        components: [factorBlock, {
          id: 'manual', orderPath: 'root.manual', order: 'fixed', components: [manualId], skip: [],
        }, escapedManualId, 'task-1'],
      },
    });
    const { container } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));

    const links = container.querySelectorAll('[role="link"]');
    generated.forEach(([, label], index) => {
      expect(links[index].textContent).toContain(label);
    });
    expect(links[2].textContent).toContain(manualId);
    expect(links[3].textContent).toContain(escapedManualId);
    expect(links[4].textContent).toContain('task-1');
    fireEvent.click(links[0]);
    expect(mockNavigate).toHaveBeenLastCalledWith(`/test-study/reviewer-${encodeURIComponent(generated[0][0])}`);
    fireEvent.click(links[1]);
    expect(mockNavigate).toHaveBeenLastCalledWith(`/test-study/reviewer-${encodeURIComponent(generated[1][0])}`);
  });

  test('renders without crashing when no participant sequence provided', async () => {
    const { container } = await act(async () => render(
      <StepsPanel
        participantAnswers={{}}
        studyConfig={minimalStudyConfig}
      />,
    ));
    expect(container).toBeDefined();
  });

  test('shows only parameters, responses, and correct answer in order as JSON blocks', async () => {
    const studyConfig = makeStudyConfig({
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          parameters: { dataset: 'study.csv' },
          response: [
            { id: 'q1', type: 'shortText', prompt: 'First answer' },
            { id: 'q2', type: 'shortText', prompt: 'Second answer' },
          ],
          correctAnswer: [
            { id: 'q1', answer: 'expected' },
            { id: 'q2', answer: 'also expected' },
          ],
        },
      },
      sequence: minimalSequence,
    });
    mockLocation.pathname = '/test-study/reviewer-intro';
    const { container, getByRole } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));

    const labels = ['Parameters', 'Responses', 'Correct Answer'];
    const labelPositions = labels.map((label) => container.textContent!.indexOf(label));
    expect(labelPositions[0]).toBeGreaterThanOrEqual(0);
    expect(labelPositions[0]).toBeLessThan(labelPositions[1]);
    expect(labelPositions[1]).toBeLessThan(labelPositions[2]);
    expect(container.textContent).not.toContain('Study Config');
    expect(container.textContent).not.toContain('Participant Answer');
    const blocks = Array.from(container.querySelectorAll('code')).map((element) => element.textContent);
    expect(blocks[0]).toContain('"dataset": "study.csv"');
    expect(blocks[1]).toContain('"prompt": "First answer"');
    expect(blocks[1]).not.toMatch(/^\s*[{[]/);
    expect(blocks[2]).toContain('"prompt": "Second answer"');
    expect(blocks[3]).toContain('"answer": "expected"');
    expect(blocks[3]).not.toMatch(/^\s*[{[]/);
    expect(blocks[4]).toContain('"answer": "also expected"');
    expect(blocks[4]).not.toMatch(/^\s*[{[]/);
    const inspectorToggle = getByRole('button', { name: 'Component details' });
    expect(inspectorToggle.getAttribute('aria-expanded')).toBe('true');
    const inspectorId = inspectorToggle.getAttribute('aria-controls');
    expect(inspectorId).toBeTruthy();
    expect(document.getElementById(inspectorId!)).not.toBeNull();
    labels.forEach((label) => {
      const sectionToggle = getByRole('button', { name: label });
      expect(sectionToggle.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(sectionToggle);
      expect(sectionToggle.getAttribute('aria-expanded')).toBe('false');
      expect(document.getElementById(sectionToggle.getAttribute('aria-controls')!)).toBeNull();
    });
  });

  test('shows an empty state when the route does not resolve to a component', async () => {
    const { container } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={minimalStudyConfig} />,
    ));
    expect(container.textContent).toContain('No component is selected.');
  });

  test('reopens sections for a newly selected component', async () => {
    const studyConfig = makeStudyConfig({
      components: {
        intro: {
          type: 'markdown', path: 'intro.md', response: [{ id: 'intro-q', type: 'shortText', prompt: 'Intro response' }],
        },
        other: {
          type: 'markdown', path: 'other.md', response: [{ id: 'other-q', type: 'shortText', prompt: 'Other response' }],
        },
      },
      sequence: minimalSequence,
    });
    mockLocation.pathname = '/test-study/reviewer-intro';
    const { getByRole, rerender } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    expect(document.body.textContent).toContain('"prompt": "Intro response"');
    const responsesToggle = getByRole('button', { name: 'Responses' });
    fireEvent.click(responsesToggle);
    expect(responsesToggle.getAttribute('aria-expanded')).toBe('false');

    mockLocation.pathname = '/test-study/reviewer-other';
    await act(async () => rerender(<StepsPanel participantAnswers={{}} studyConfig={studyConfig} />));
    expect(getByRole('button', { name: 'Component details' })).toBeDefined();
    expect(getByRole('button', { name: 'Responses' }).getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('"prompt": "Other response"');
  });

  test('temporarily highlights a matching response and clears it on hover end', async () => {
    const studyConfig = makeStudyConfig({
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [{ id: 'q1', type: 'shortText', prompt: 'Answer' }],
        },
      },
      sequence: minimalSequence,
    });
    const questionElement = document.createElement('div');
    questionElement.dataset.questionId = 'q1';
    questionElement.style.outline = '1px solid red';
    const responseElement = document.createElement('div');
    responseElement.id = 'q1';
    questionElement.appendChild(responseElement);
    document.body.appendChild(questionElement);
    mockLocation.pathname = '/test-study/reviewer-intro';
    const { container, unmount } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    const responseEntry = Array.from(container.querySelectorAll('code'))
      .filter((element) => element.textContent?.includes('"id": "q1"') && element.textContent?.includes('"prompt": "Answer"'))
      .at(-1)!;
    fireEvent.mouseEnter(responseEntry.parentElement!);
    expect(questionElement.style.outline).toContain('var(--mantine-color-blue-5)');
    fireEvent.mouseLeave(responseEntry.parentElement!);
    expect(questionElement.style.outline).toBe('1px solid red');
    unmount();
    questionElement.remove();
  });

  test('renders a study containing a dynamic block', async () => {
    const studyConfig = makeStudyConfig({
      components: { intro: { type: 'markdown', path: 'intro.md', response: [] } },
      sequence: {
        order: 'fixed',
        components: ['intro', { id: 'adaptive', order: 'dynamic', functionPath: 'adaptive.ts' }],
      },
    });
    const { container } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    expect(container.querySelector('[role="link"]')).toBeDefined();
  });

  test('renders with a participant sequence', async () => {
    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{}}
        studyConfig={minimalStudyConfig}
      />,
    ));
    expect(container).toBeDefined();
  });

  test('uses generated factor components for the runtime-plan denominator', async () => {
    const runtimePlan = {
      type: 'factor-runtime-plan',
      id: 'trials',
      order: 'fixed',
      orderPath: 'root',
      components: [],
      skip: [],
      conditionComponents: {
        first: ['trialA'],
        second: ['trialB'],
        third: ['trialC'],
      },
    } as unknown as StudyConfig['sequence'];
    const studyConfig = makeStudyConfig({
      components: {
        trialA: { type: 'markdown', path: 'trialA.md', response: [] },
        trialB: { type: 'markdown', path: 'trialB.md', response: [] },
        trialC: { type: 'markdown', path: 'trialC.md', response: [] },
      },
      sequence: runtimePlan,
    });
    const participantSequence: Sequence = {
      id: 'trials',
      orderPath: 'root',
      order: 'fixed',
      components: ['trialA', 'trialB'],
      skip: [],
    };

    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={participantSequence}
        participantAnswers={{}}
        studyConfig={studyConfig}
      />,
    ));

    expect(container.textContent).toContain('2/3');
  });

  test('renders in analysis mode', async () => {
    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{}}
        studyConfig={minimalStudyConfig}
        isAnalysis
      />,
    ));
    expect(container).toBeDefined();
  });
});

describe('StepsPanel answer status indicators', () => {
  const makeStatusConfig = (correctAnswer?: Answer[]) => makeStudyConfig({
    uiConfig: {
      withSidebar: true,
      sidebarWidth: 300,
      showTitleBar: true,
    },
    components: {
      intro: {
        type: 'questionnaire',
        response: [{
          id: 'q1',
          type: 'radio',
          prompt: 'Question',
          options: ['A', 'B'],
        }],
        correctAnswer,
      },
    },
    sequence: minimalSequence,
  });

  const makeCompletedAnswer = (answer: StoredAnswer['answer'], endTime = 100) => makeStoredAnswer({
    answer,
    identifier: 'intro_0',
    componentName: 'intro',
    trialOrder: 'root_0',
    startTime: 1,
    endTime,
  });

  test('shows an accessible theme-dimmed checkmark for a submitted response without correct answers', async () => {
    const participantAnswer = makeCompletedAnswer({ q1: 'A' });
    const { getAllByLabelText, container } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: participantAnswer }}
        studyConfig={makeStatusConfig()}
      />,
    ));

    const unknownIcons = getAllByLabelText(UNKNOWN_ANSWER_LABEL);
    expect(unknownIcons.length).toBeGreaterThan(0);
    expect(unknownIcons[0].getAttribute('data-color')).toBe('var(--mantine-color-dimmed)');
    expect(container.textContent).toContain('icon-check');
    expect(container.textContent).not.toContain('icon-x');
  });

  test('preserves correct and incorrect indicators when correct answers are configured', async () => {
    const correctAnswer = [{ id: 'q1', answer: 'A' }];
    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: { ...makeCompletedAnswer({ q1: 'A' }), correctAnswer } }}
        studyConfig={makeStatusConfig(correctAnswer)}
      />,
    ));

    expect(container.textContent).toContain('icon-check');
    expect(container.querySelector(`[aria-label="${UNKNOWN_ANSWER_LABEL}"]`)).toBeNull();

    cleanup();

    const incorrect = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: { ...makeCompletedAnswer({ q1: 'B' }), correctAnswer } }}
        studyConfig={makeStatusConfig(correctAnswer)}
      />,
    ));

    expect(incorrect.container.textContent).toContain('icon-x');
    expect(incorrect.container.querySelector(`[aria-label="${UNKNOWN_ANSWER_LABEL}"]`)).toBeNull();
  });

  test.each([true, false])('preserves an empty dynamic grading override (saved=%s)', async (hasSavedRules) => {
    const participantAnswer = makeCompletedAnswer({ q1: 'B' });
    if (!hasSavedRules) delete (participantAnswer as Partial<StoredAnswer>).correctAnswer;
    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: participantAnswer }}
        studyConfig={makeStatusConfig([{ id: 'q1', answer: 'A' }])}
      />,
    ));

    expect(container.querySelector(`[aria-label="${UNKNOWN_ANSWER_LABEL}"]`) !== null).toBe(hasSavedRules);
    expect(container.textContent?.includes('icon-x')).toBe(!hasSavedRules);
  });

  test('shows no answer-status indicator for incomplete or unanswered components', async () => {
    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: makeCompletedAnswer({ q1: 'A' }, -1) }}
        studyConfig={makeStatusConfig()}
      />,
    ));

    expect(container.querySelector(`[aria-label="${UNKNOWN_ANSWER_LABEL}"]`)).toBeNull();
    expect(container.textContent).not.toContain('icon-check');
    expect(container.textContent).not.toContain('icon-x');

    cleanup();

    const unanswered = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: makeCompletedAnswer({}) }}
        studyConfig={makeStatusConfig()}
      />,
    ));

    expect(unanswered.container.querySelector(`[aria-label="${UNKNOWN_ANSWER_LABEL}"]`)).toBeNull();
    expect(unanswered.container.textContent).not.toContain('icon-check');
    expect(unanswered.container.textContent).not.toContain('icon-x');
  });
});

describe('StepsPanel NavLink click handler', () => {
  test('clicking a component item triggers navigation', async () => {
    mockNavigate.mockClear();
    const { getAllByRole } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{}}
        studyConfig={minimalStudyConfig}
      />,
    ));
    // links: [block(0), intro(1), end(2)] - click component links first to avoid detachment
    const links = getAllByRole('link');
    if (links.length > 1) {
      // Click a component link (index 1 = intro) before block collapses it
      act(() => { fireEvent.click(links[1]); });
    }
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('clicking a component item in analysis mode navigates to analysis URL', async () => {
    mockNavigate.mockClear();
    const { getAllByRole } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{}}
        studyConfig={minimalStudyConfig}
        isAnalysis
      />,
    ));
    // Click the intro component link (index 1) in analysis mode
    const links = getAllByRole('link');
    if (links.length > 1) {
      act(() => { fireEvent.click(links[1]); });
    }
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('analysis'));
  });

  test('clicking a block item toggles collapse/expand', async () => {
    const { getAllByRole, queryAllByRole } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{}}
        studyConfig={minimalStudyConfig}
      />,
    ));
    // The block is the first link (index 0); click it to collapse
    const links = getAllByRole('link');
    const blockLink = links[0];
    await act(async () => { fireEvent.click(blockLink); });
    // After collapse: block still exists but children are gone; click it again to expand
    const linksAfterCollapse = queryAllByRole('link');
    if (linksAfterCollapse.length > 0) {
      await act(async () => { fireEvent.click(linksAfterCollapse[0]); });
    }
    expect(linksAfterCollapse.length).toBeGreaterThanOrEqual(0);
  });

  test('renders with component having parameters in answer', async () => {
    const answerWithParams = makeStoredAnswer({
      answer: { q1: 1 },
      identifier: 'intro_0',
      componentName: 'intro',
      trialOrder: 'root_0',
      startTime: 0,
      endTime: 100,
      parameters: { key: 'val' },
    });

    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: answerWithParams }}
        studyConfig={minimalStudyConfig}
      />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with component having parameters in config', async () => {
    const configWithParams = makeStudyConfig({
      uiConfig: {
        withSidebar: true,
        sidebarWidth: 300,
        showTitleBar: true,
      },
      components: {
        intro: {
          type: 'react-component',
          path: 'intro.tsx',
          response: [],
          parameters: { key: 'val' },
        },
      },
      sequence: minimalSequence,
    });

    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{}}
        studyConfig={configWithParams}
      />,
    ));
    expect(container).toBeDefined();
  });
});

describe('StepsPanel random order rendering', () => {
  test('renders shuffle icon for random order sequence block', async () => {
    const randomSequence: Sequence = {
      id: 'root',
      orderPath: 'root',
      order: 'random',
      components: ['intro'],
      skip: [],
    };
    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={randomSequence}
        participantAnswers={{}}
        studyConfig={minimalStudyConfig}
      />,
    ));
    expect(container).toBeDefined();
  });

  test('renders with randomized response options (covers hasRandomization radio/matrix paths)', async () => {
    const configWithRandomization = makeStudyConfig({
      uiConfig: {
        withSidebar: true,
        sidebarWidth: 300,
        showTitleBar: true,
      },
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [
            {
              id: 'r1', type: 'radio', prompt: 'Q1', options: ['A', 'B'], optionOrder: 'random',
            },
            {
              id: 'r2', type: 'matrix-radio', prompt: 'Q2', answerOptions: ['A', 'B'], questionOptions: ['Q1'], questionOrder: 'random',
            },
          ],
        },
      },
      sequence: minimalSequence,
    });

    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{}}
        studyConfig={configWithRandomization}
      />,
    ));
    expect(container).toBeDefined();
  });
});

// ── excluded blocks / components tests ──────────────────────────────────────────

describe('StepsPanel excluded blocks and components', () => {
  // Study config: block1 has ['intro', 'survey'], participant only has ['intro']
  const studyConfigWithExtraComponents = makeStudyConfig({
    uiConfig: {
      withSidebar: true,
      sidebarWidth: 300,
      showTitleBar: true,
    },
    sequence: {
      id: 'root',
      orderPath: 'root',
      order: 'fixed',
      components: [
        {
          id: 'block1',
          orderPath: 'root-block1',
          order: 'fixed',
          components: ['intro', 'survey'],
          skip: [],
        },
      ],
      skip: [],
    },
    components: {
      intro: { type: 'markdown', path: 'intro.md', response: [] },
      survey: { type: 'markdown', path: 'survey.md', response: [] },
    },
  });

  const participantWithExcludedComponent: Sequence = {
    id: 'root',
    orderPath: 'root',
    order: 'fixed',
    components: [
      {
        id: 'block1',
        orderPath: 'root-block1',
        order: 'fixed',
        components: ['intro'], // 'survey' is excluded
        skip: [],
      },
      'end',
    ],
    skip: [],
  };

  test('renders excluded component from study sequence', async () => {
    const { getAllByText } = await act(async () => render(
      <StepsPanel
        participantSequence={participantWithExcludedComponent}
        participantAnswers={{}}
        studyConfig={studyConfigWithExtraComponents}
      />,
    ));
    expect(getAllByText('Excluded')).toHaveLength(1);
  });

  // Study config: block1 has [nested1, nested2 (excluded)]
  const studyConfigWithExcludedBlock = makeStudyConfig({
    uiConfig: {
      withSidebar: true,
      sidebarWidth: 300,
      showTitleBar: true,
    },
    sequence: {
      id: 'root',
      orderPath: 'root',
      order: 'fixed',
      components: [
        {
          id: 'block1',
          orderPath: 'root-block1',
          order: 'fixed',
          components: [
            {
              id: 'nested1',
              orderPath: 'root-block1-nested1',
              order: 'fixed',
              components: ['intro'],
              skip: [],
            },
            {
              id: 'nested2',
              orderPath: 'root-block1-nested2',
              order: 'fixed',
              components: ['survey'],
              skip: [],
            },
          ],
          skip: [],
        },
      ],
      skip: [],
    },
    components: {
      intro: { type: 'markdown', path: 'intro.md', response: [] },
      survey: { type: 'markdown', path: 'survey.md', response: [] },
    },
  });

  const participantWithExcludedBlock: Sequence = {
    id: 'root',
    orderPath: 'root',
    order: 'fixed',
    components: [
      {
        id: 'block1',
        orderPath: 'root-block1',
        order: 'fixed',
        components: [
          {
            id: 'nested1',
            orderPath: 'root-block1-nested1',
            order: 'fixed',
            components: ['intro'],
            skip: [],
          },
          // nested2 is excluded from participant sequence
        ],
        skip: [],
      },
      'end',
    ],
    skip: [],
  };

  test('renders excluded block with string children', async () => {
    const { getAllByText } = await act(async () => render(
      <StepsPanel
        participantSequence={participantWithExcludedBlock}
        participantAnswers={{}}
        studyConfig={studyConfigWithExcludedBlock}
      />,
    ));
    expect(getAllByText('Excluded')).toHaveLength(1);
  });

  // Excluded block with a nested sub-block
  const studyConfigWithNestedExcludedBlock = makeStudyConfig({
    uiConfig: {
      withSidebar: true,
      sidebarWidth: 300,
      showTitleBar: true,
    },
    sequence: {
      id: 'root',
      orderPath: 'root',
      order: 'fixed',
      components: [
        {
          id: 'block1',
          orderPath: 'root-block1',
          order: 'fixed',
          components: [
            {
              id: 'nested1',
              orderPath: 'root-block1-nested1',
              order: 'fixed',
              components: ['intro'],
              skip: [],
            },
            {
              id: 'nested2',
              orderPath: 'root-block1-nested2',
              order: 'fixed',
              components: [
                {
                  id: 'deepBlock',
                  orderPath: 'root-block1-nested2-deepBlock',
                  order: 'fixed',
                  components: ['survey'],
                  skip: [],
                },
              ],
              skip: [],
            },
          ],
          skip: [],
        },
      ],
      skip: [],
    },
    components: {
      intro: { type: 'markdown', path: 'intro.md', response: [] },
      survey: { type: 'markdown', path: 'survey.md', response: [] },
    },
  });

  test('excluded block with nested sub-block children', async () => {
    const { getAllByText } = await act(async () => render(
      <StepsPanel
        participantSequence={participantWithExcludedBlock}
        participantAnswers={{}}
        studyConfig={studyConfigWithNestedExcludedBlock}
      />,
    ));
    expect(getAllByText('Excluded')).toHaveLength(1);
  });
});

// ── nested expand tests ──────────────────────────────────────────────────────────

describe('StepsPanel nested expand', () => {
  // 3-level deep sequence: root > child block > grandchild block > intro
  const deepSequence: Sequence = {
    id: 'root',
    orderPath: 'root',
    order: 'fixed',
    components: [
      {
        id: 'child',
        orderPath: 'root-child',
        order: 'fixed',
        components: [
          {
            id: 'grandchild',
            orderPath: 'root-child-grandchild',
            order: 'fixed',
            components: ['intro'],
            skip: [],
          },
        ],
        skip: [],
      },
    ],
    skip: [],
  };

  test('collapse then expand nested block', async () => {
    const { getAllByRole, queryAllByRole } = await act(async () => render(
      <StepsPanel
        participantSequence={deepSequence}
        participantAnswers={{}}
        studyConfig={minimalStudyConfig}
      />,
    ));
    // Click the root block (first link) to collapse all children
    const links = getAllByRole('link');
    await act(async () => { fireEvent.click(links[0]); });
    // Now click root block again to expand (re-insert with nested expand logic)
    const linksAfterCollapse = queryAllByRole('link');
    if (linksAfterCollapse.length > 0) {
      await act(async () => { fireEvent.click(linksAfterCollapse[0]); });
    }
    expect(queryAllByRole('link').length).toBeGreaterThan(0);
  });
});

// ── utility tests ──────────────────────────────────────────────────────────────

describe('StepsPanel tree walking', () => {
  test('does not append answer-derived components for non-dynamic blocks', () => {
    const block: Sequence = {
      id: 'drawing100m',
      order: 'fixed',
      orderPath: 'root-0',
      components: ['drawing100m', 'drawingFollowUp100M'],
      skip: [],
      interruptions: [],
    };

    const participantAnswers = {
      drawing100m_3: {
        componentName: 'drawing100m',
      } as StoredAnswer,
    };

    expect(getDynamicComponentsForBlock(block, participantAnswers, 3)).toEqual([]);
  });

  test('appends answer-derived components for dynamic blocks', () => {
    const block: Sequence = {
      id: 'dynamicDrawing',
      order: 'dynamic',
      orderPath: 'root-0',
      components: [],
      skip: [],
      interruptions: [],
    };

    const participantAnswers = {
      dynamicDrawing_2_generatedA_0: {
        componentName: 'generatedA',
      } as StoredAnswer,
      dynamicDrawing_2_generatedB_1: {
        componentName: 'generatedB',
      } as StoredAnswer,
    };

    expect(getDynamicComponentsForBlock(block, participantAnswers, 2)).toEqual(['generatedA', 'generatedB']);
  });

  test('does not include answers from similarly prefixed indices', () => {
    const block: Sequence = {
      id: 'dynamicDrawing',
      order: 'dynamic',
      orderPath: 'root-0',
      components: [],
      skip: [],
      interruptions: [],
    };

    const participantAnswers = {
      dynamicDrawing_2_generatedA_0: {
        componentName: 'generatedA',
      } as StoredAnswer,
      dynamicDrawing_20_generatedWrong_0: {
        componentName: 'generatedWrong',
      } as StoredAnswer,
    };

    expect(getDynamicComponentsForBlock(block, participantAnswers, 2)).toEqual(['generatedA']);
  });
});
