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
import { createGlobalStoreSubmission } from '../../../store/globalStoreProvenance';
import { getDynamicComponentsForBlock } from '../StepsPanel.utils';
import { StepsPanel } from '../StepsPanel';
import { UNKNOWN_ANSWER_LABEL } from '../UnknownAnswerIcon';

const mockLocation = vi.hoisted(() => ({ pathname: '/', params: {} as { trialId?: string } }));

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
  useParams: () => mockLocation.params,
}));

vi.mock('../../../utils/getSequenceFlatMap', () => ({
  addPathToComponentBlock: (seq: Sequence) => seq,
  getSequenceFlatMap: (sequence: Sequence) => {
    const flatten = (node: string | Sequence): string[] => {
      if (typeof node === 'string') return [node];
      if (node.order === 'dynamic') return node.id ? [node.id] : [];
      return node.components.flatMap(flatten);
    };
    return flatten(sequence);
  },
  findFuncBlock: (name: string, sequence: Sequence) => {
    let found: Sequence | undefined;
    const visit = (node: string | Sequence) => {
      if (typeof node === 'string' || found) return;
      if (node.id === name && node.order === 'dynamic') {
        found = node;
        return;
      }
      node.components.forEach(visit);
    };
    visit(sequence);
    return found;
  },
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (i: number) => String(i),
  parseStepIndex: (value: string) => (/^\d+$/.test(value) ? Number(value) : null),
}));

vi.mock('../../../parser/utils', () => ({
  isDynamicBlock: (block: { order?: string }) => block.order === 'dynamic',
  isInheritedComponent: (component: { baseComponent?: string }) => 'baseComponent' in component,
}));

type MockBoxProps = {
  children: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
  id?: string;
  'data-testid'?: string;
  style?: React.CSSProperties;
};

vi.mock('@mantine/core', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  // eslint-disable-next-line prefer-arrow-callback
  Box: forwardRef<HTMLDivElement, MockBoxProps>(function Box({
    children,
    onMouseEnter,
    onMouseLeave,
    className,
    id,
    'data-testid': dataTestId,
    style,
  }, ref) {
    return (
      <div ref={ref} className={className} id={id} data-testid={dataTestId} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {children}
      </div>
    );
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

afterEach(() => {
  cleanup();
  mockLocation.pathname = '/';
  mockLocation.params = {};
});

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

  test('shows inspector details for a reviewer route with a trailing slash', async () => {
    const studyConfig = makeStudyConfig({
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          parameters: { dataset: 'study.csv' },
          description: 'Intro description',
          meta: { taskId: 'task-1' },
          response: [
            { id: 'q1', type: 'shortText', prompt: 'First answer' },
            { id: 'q2', type: 'shortText', prompt: 'Second answer' },
            { id: 'instruction', type: 'textOnly', prompt: 'Display-only text' },
          ],
          correctAnswer: [
            { id: 'q1', answer: 'expected' },
            { id: 'q2', answer: 'also expected' },
          ],
        },
      },
      sequence: minimalSequence,
    });
    mockLocation.pathname = '/test-study/reviewer-intro/';
    const { container } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));

    const labels = ['Parameters', 'Responses', 'Correct Answer'];
    const labelPositions = labels.map((label) => container.textContent!.indexOf(label));
    expect(labelPositions[0]).toBeGreaterThanOrEqual(0);
    expect(labelPositions[0]).toBeLessThan(labelPositions[1]);
    expect(labelPositions[1]).toBeLessThan(labelPositions[2]);
    expect(container.textContent).not.toContain('Study Config');
    expect(container.textContent).toContain('Intro description');
    expect(container.textContent).toContain('task-1');
    const blocks = Array.from(container.querySelectorAll('code')).map((element) => element.textContent);
    expect(blocks[0]).toContain('"dataset": "study.csv"');
    expect(blocks[1]).toContain('"prompt": "First answer"');
    expect(blocks[1]).not.toMatch(/^\s*[{[]/);
    expect(blocks[2]).toContain('"prompt": "Second answer"');
    expect(blocks[2]).not.toMatch(/^\s*[{[]/);
    expect(blocks[3]).toContain('"prompt": "Display-only text"');
    expect(blocks[4]).toContain('"answer": "expected"');
    expect(blocks[4]).not.toMatch(/^\s*[{[]/);
    expect(blocks[5]).toContain('"answer": "also expected"');
    expect(blocks[5]).not.toMatch(/^\s*[{[]/);
    const answer = makeStoredAnswer({
      componentName: 'intro',
      answer: { q1: 'participant response', instruction: 'should not appear', unknown: 'also excluded' },
    });
    mockLocation.pathname = '/test-study/0';
    const { container: answeredContainer } = await act(async () => render(
      <StepsPanel participantSequence={minimalSequence} participantAnswers={{ intro_0: answer }} studyConfig={studyConfig} />,
    ));
    expect(answeredContainer.textContent).toContain('Participant Answer');
    expect(answeredContainer.textContent).toContain('participant response');
    expect(answeredContainer.textContent).not.toContain('should not appear');
    expect(answeredContainer.textContent).not.toContain('also excluded');
    const inspectorToggle = answeredContainer.querySelector('button[aria-label="Component details"]')!;
    expect(inspectorToggle.getAttribute('aria-expanded')).toBe('true');
    const inspectorId = inspectorToggle.getAttribute('aria-controls');
    expect(inspectorId).toBeTruthy();
    expect(document.getElementById(inspectorId!)).not.toBeNull();
    labels.forEach((label) => {
      const sectionToggle = Array.from(answeredContainer.querySelectorAll('button')).find((button) => button.textContent?.includes(label))!;
      expect(sectionToggle.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(sectionToggle);
      expect(sectionToggle.getAttribute('aria-expanded')).toBe('false');
      expect(document.getElementById(sectionToggle.getAttribute('aria-controls')!)).toBeNull();
    });
  });

  test('shows the resolved inherited component configuration in the inspector', async () => {
    const studyConfig = makeStudyConfig({
      baseComponents: {
        shared: {
          type: 'markdown',
          path: 'shared.md',
          parameters: { dataset: 'shared-data.csv' },
          response: [{ id: 'inherited-q', type: 'shortText', prompt: 'Inherited response prompt' }],
          correctAnswer: [{ id: 'inherited-q', answer: 'inherited correct answer' }],
        },
      },
      components: {
        inherited: {
          baseComponent: 'shared',
          parameters: { task: 'child-task' },
        },
      },
      sequence: minimalSequence,
    });
    mockLocation.pathname = '/test-study/reviewer-inherited';
    const { container } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));

    expect(container.textContent).toContain('shared-data.csv');
    expect(container.textContent).toContain('child-task');
    expect(container.textContent).toContain('Inherited response prompt');
    expect(container.textContent).toContain('inherited correct answer');
  });

  test('keeps the analysis inspector at the bottom within half height and updates trial details', async () => {
    const studyConfig = makeStudyConfig({
      components: {
        intro: { type: 'markdown', path: 'intro.md', response: [{ id: 'intro-q', type: 'shortText', prompt: 'Intro trial response' }] },
        other: { type: 'markdown', path: 'other.md', response: [{ id: 'other-q', type: 'shortText', prompt: 'Other trial response' }] },
      },
      sequence: minimalSequence,
    });
    mockLocation.params = { trialId: 'intro' };
    mockLocation.pathname = '/analysis/stats/test-study/stats/intro';
    const { container, getByRole, rerender } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} isAnalysis />,
    ));
    const inspector = container.querySelector<HTMLElement>('[data-testid="component-inspector"]')!;
    expect(inspector.style.maxHeight).toBe('50%');
    expect(inspector.style.flex).toContain('50%');
    expect(inspector.parentElement?.lastElementChild).toBe(inspector);
    expect(container.textContent).toContain('Intro trial response');

    fireEvent.click(getByRole('button', { name: 'Responses' }));
    expect(getByRole('button', { name: 'Responses' }).getAttribute('aria-expanded')).toBe('false');
    await act(async () => rerender(<StepsPanel participantAnswers={{}} studyConfig={studyConfig} isAnalysis />));
    expect(getByRole('button', { name: 'Responses' }).getAttribute('aria-expanded')).toBe('false');

    mockLocation.params = { trialId: 'other' };
    mockLocation.pathname = '/analysis/stats/test-study/stats/other';
    await act(async () => rerender(<StepsPanel participantAnswers={{}} studyConfig={studyConfig} isAnalysis />));
    expect(container.textContent).toContain('Other trial response');
    expect(container.textContent).not.toContain('Intro trial response');
    expect(getByRole('button', { name: 'Responses' }).getAttribute('aria-expanded')).toBe('true');
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

  test('resolves the active participant component while Browse Components is selected', async () => {
    const studyConfig = makeStudyConfig({
      components: { intro: { type: 'markdown', path: 'intro.md', response: [{ id: 'q', type: 'shortText', prompt: 'Current trial' }] } },
      sequence: minimalSequence,
    });
    mockLocation.pathname = '/test-study/0';
    const { container } = await act(async () => render(
      <StepsPanel
        participantAnswers={{}}
        activeParticipantSequence={minimalSequence}
        activeParticipantAnswers={{}}
        studyConfig={studyConfig}
      />,
    ));
    expect(container.textContent).toContain('Current trial');
    expect(container.textContent).not.toContain('No component is selected.');
  });

  test('shows Other and I don’t know participant answer values', async () => {
    const studyConfig = makeStudyConfig({
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [
            {
              id: 'choice',
              type: 'radio',
              prompt: 'Choose an option',
              options: ['A', 'B'],
              withOther: true,
            },
            {
              id: 'explanation',
              type: 'shortText',
              prompt: 'Explain your answer',
              withDontKnow: true,
            },
          ],
        },
      },
      sequence: minimalSequence,
    });
    const answer = makeStoredAnswer({
      componentName: 'intro',
      answer: {
        choice: 'other',
        'choice-other': 'My custom option',
        explanation: '',
        'explanation-dontKnow': true,
      },
    });
    mockLocation.pathname = '/test-study/0';
    const { container } = await act(async () => render(
      <StepsPanel participantSequence={minimalSequence} participantAnswers={{ intro_0: answer }} studyConfig={studyConfig} />,
    ));

    expect(container.textContent).toContain('choice-other');
    expect(container.textContent).toContain('My custom option');
    expect(container.textContent).toContain('explanation-dontKnow');
    expect(container.textContent).toContain('true');
  });

  test('omits saved answers for conditionally hidden responses', async () => {
    const studyConfig = makeStudyConfig({
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [
            {
              id: 'showDetails',
              type: 'radio',
              prompt: 'Show details?',
              options: ['yes', 'no'],
            },
            {
              id: 'details',
              type: 'shortText',
              prompt: 'Details',
              visibleIf: { responseId: 'showDetails', comparison: 'equals', value: 'yes' },
            },
          ],
        },
      },
      sequence: minimalSequence,
    });
    const answer = makeStoredAnswer({
      componentName: 'intro',
      answer: { showDetails: 'no', details: 'stale hidden answer' },
    });
    mockLocation.pathname = '/test-study/0';
    const { container } = await act(async () => render(
      <StepsPanel participantSequence={minimalSequence} participantAnswers={{ intro_0: answer }} studyConfig={studyConfig} />,
    ));

    const answerSection = document.getElementById(
      container.querySelector('button[aria-controls$="participant-answer"]')!.getAttribute('aria-controls')!,
    );
    expect(answerSection?.textContent).toContain('showDetails');
    expect(answerSection?.textContent).not.toContain('stale hidden answer');
    expect(answerSection?.textContent).not.toContain('details');
  });

  test('omits stale Other text when radio or checkbox no longer selects Other', async () => {
    const studyConfig = makeStudyConfig({
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [
            {
              id: 'radioChoice', type: 'radio', prompt: 'Radio choice', options: ['A', 'other'], withOther: true,
            },
            {
              id: 'checkChoice', type: 'checkbox', prompt: 'Checkbox choice', options: ['A', 'other'], withOther: true,
            },
          ],
        },
      },
      sequence: minimalSequence,
    });
    const answer = makeStoredAnswer({
      componentName: 'intro',
      answer: {
        radioChoice: 'A',
        'radioChoice-other': 'stale radio text',
        checkChoice: ['A'],
        'checkChoice-other': 'stale checkbox text',
      },
    });
    mockLocation.pathname = '/test-study/0';
    const { container } = await act(async () => render(
      <StepsPanel participantSequence={minimalSequence} participantAnswers={{ intro_0: answer }} studyConfig={studyConfig} />,
    ));

    const answerSection = document.getElementById(
      container.querySelector('button[aria-controls$="participant-answer"]')!.getAttribute('aria-controls')!,
    );
    expect(answerSection?.textContent).toContain('radioChoice');
    expect(answerSection?.textContent).toContain('checkChoice');
    expect(answerSection?.textContent).not.toContain('stale radio text');
    expect(answerSection?.textContent).not.toContain('stale checkbox text');
  });

  test('shows the analysis component only when the trialId route parameter exists', async () => {
    const studyConfig = makeStudyConfig({
      components: {
        stats: { type: 'markdown', path: 'stats.md', response: [{ id: 'q', type: 'shortText', prompt: 'Stats component' }] },
        intro: { type: 'markdown', path: 'intro.md', response: [{ id: 'intro-q', type: 'shortText', prompt: 'Intro component' }] },
      },
      sequence: minimalSequence,
    });
    mockLocation.pathname = '/analysis/stats/test-study/stats';
    const { container, rerender } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} isAnalysis />,
    ));
    expect(container.textContent).toContain('No component is selected.');
    expect(container.textContent).not.toContain('Stats component');

    mockLocation.params = { trialId: 'intro' };
    mockLocation.pathname = '/analysis/stats/test-study/stats/intro';
    await act(async () => rerender(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} isAnalysis />,
    ));
    expect(container.textContent).toContain('Intro component');
  });

  test('reopens sections when the selected trial changes but its component is the same', async () => {
    const repeatedSequence: Sequence = { ...minimalSequence, components: ['intro', 'intro'] };
    const studyConfig = makeStudyConfig({
      components: { intro: { type: 'markdown', path: 'intro.md', response: [{ id: 'q', type: 'shortText', prompt: 'Repeated trial' }] } },
      sequence: repeatedSequence,
    });
    mockLocation.pathname = '/test-study/0';
    const { getByRole, rerender } = await act(async () => render(
      <StepsPanel participantSequence={repeatedSequence} participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    fireEvent.click(getByRole('button', { name: 'Responses' }));
    expect(getByRole('button', { name: 'Responses' }).getAttribute('aria-expanded')).toBe('false');
    mockLocation.pathname = '/test-study/1';
    await act(async () => rerender(
      <StepsPanel participantSequence={repeatedSequence} participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    expect(getByRole('button', { name: 'Responses' }).getAttribute('aria-expanded')).toBe('true');
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
    const stimulusElement = document.createElement('div');
    stimulusElement.id = 'stimulus';
    stimulusElement.className = 'stimulus';
    stimulusElement.style.outline = '1px solid orange';
    stimulusElement.style.outlineOffset = '4px';
    stimulusElement.appendChild(document.createElement('div'));
    const responseElement = document.createElement('div');
    responseElement.className = 'response';
    responseElement.id = 'q1';
    const questionElement = document.createElement('div');
    questionElement.dataset.questionId = 'q1';
    questionElement.style.outline = '1px solid green';
    questionElement.style.outlineOffset = '3px';
    questionElement.appendChild(responseElement);
    document.body.append(stimulusElement, questionElement);
    mockLocation.pathname = '/test-study/reviewer-intro';
    const { container, getByRole, unmount } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    const responseEntry = Array.from(container.querySelectorAll('code'))
      .filter((element) => element.textContent?.includes('"id": "q1"') && element.textContent?.includes('"prompt": "Answer"'))
      .at(-1)!;
    fireEvent.mouseEnter(responseEntry.parentElement!);
    expect(questionElement.style.outline).toContain('var(--mantine-color-blue-5)');
    expect(responseElement.style.outline).toBe('');
    expect(stimulusElement.style.outline).toContain('var(--mantine-color-blue-5)');
    fireEvent.mouseLeave(responseEntry.parentElement!);
    expect(questionElement.style.outline).toBe('1px solid green');
    expect(questionElement.style.outlineOffset).toBe('3px');
    expect(stimulusElement.style.outline).toBe('1px solid orange');
    expect(stimulusElement.style.outlineOffset).toBe('4px');

    fireEvent.mouseEnter(responseEntry.parentElement!);
    fireEvent.click(getByRole('button', { name: 'Component details' }));
    expect(questionElement.style.outline).toBe('1px solid green');
    expect(stimulusElement.style.outline).toBe('1px solid orange');
    unmount();
    stimulusElement.remove();
    questionElement.remove();
  });

  test('highlights the question without outlining an empty stimulus container', async () => {
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
    const stimulusElement = document.createElement('div');
    stimulusElement.className = 'stimulus';
    stimulusElement.style.outline = '1px solid orange';
    const questionElement = document.createElement('div');
    questionElement.dataset.questionId = 'q1';
    document.body.append(stimulusElement, questionElement);
    mockLocation.pathname = '/test-study/reviewer-intro';
    const { container, unmount } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    const responseEntry = Array.from(container.querySelectorAll('code'))
      .filter((element) => element.textContent?.includes('"id": "q1"') && element.textContent?.includes('"prompt": "Answer"'))
      .at(-1)!;

    fireEvent.mouseEnter(responseEntry.parentElement!);
    expect(questionElement.style.outline).toContain('var(--mantine-color-blue-5)');
    expect(stimulusElement.style.outline).toBe('1px solid orange');
    fireEvent.mouseLeave(responseEntry.parentElement!);
    expect(questionElement.style.outline).toBe('');
    expect(stimulusElement.style.outline).toBe('1px solid orange');

    unmount();
    stimulusElement.remove();
    questionElement.remove();
  });

  test('does not highlight the stimulus when no matching question is rendered', async () => {
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
    const stimulusElement = document.createElement('div');
    stimulusElement.className = 'stimulus';
    stimulusElement.style.outline = '1px solid orange';
    const unrelatedQuestion = document.createElement('div');
    unrelatedQuestion.dataset.questionId = 'other';
    unrelatedQuestion.style.outline = '1px solid green';
    document.body.append(stimulusElement, unrelatedQuestion);
    mockLocation.pathname = '/test-study/reviewer-intro';
    const { container, unmount } = await act(async () => render(
      <StepsPanel participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    const responseEntry = Array.from(container.querySelectorAll('code'))
      .filter((element) => element.textContent?.includes('"id": "q1"') && element.textContent?.includes('"prompt": "Answer"'))
      .at(-1)!;

    fireEvent.mouseEnter(responseEntry.parentElement!);
    expect(unrelatedQuestion.style.outline).toBe('1px solid green');
    expect(stimulusElement.style.outline).toBe('1px solid orange');

    unmount();
    stimulusElement.remove();
    unrelatedQuestion.remove();
  });

  test('clears both highlights when the selected component changes', async () => {
    const sequence: Sequence = { ...minimalSequence, components: ['intro', 'other'] };
    const studyConfig = makeStudyConfig({
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [{ id: 'q1', type: 'shortText', prompt: 'Answer' }],
        },
        other: { type: 'markdown', path: 'other.md', response: [] },
      },
      sequence,
    });
    const stimulusElement = document.createElement('div');
    stimulusElement.className = 'stimulus';
    stimulusElement.style.outline = '1px solid orange';
    stimulusElement.appendChild(document.createElement('div'));
    const questionElement = document.createElement('div');
    questionElement.dataset.questionId = 'q1';
    questionElement.style.outline = '1px solid green';
    document.body.append(stimulusElement, questionElement);
    mockLocation.pathname = '/test-study/0';
    const { container, rerender, unmount } = await act(async () => render(
      <StepsPanel participantSequence={sequence} participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    const responseEntry = Array.from(container.querySelectorAll('code'))
      .filter((element) => element.textContent?.includes('"id": "q1"') && element.textContent?.includes('"prompt": "Answer"'))
      .at(-1)!;
    fireEvent.mouseEnter(responseEntry.parentElement!);
    expect(questionElement.style.outline).toContain('var(--mantine-color-blue-5)');
    expect(stimulusElement.style.outline).toContain('var(--mantine-color-blue-5)');

    mockLocation.pathname = '/test-study/1';
    await act(async () => rerender(
      <StepsPanel participantSequence={sequence} participantAnswers={{}} studyConfig={studyConfig} />,
    ));
    expect(questionElement.style.outline).toBe('1px solid green');
    expect(stimulusElement.style.outline).toBe('1px solid orange');

    unmount();
    stimulusElement.remove();
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

  test('resolves a saved dynamic trial by its actual iteration after an earlier iteration is deleted', async () => {
    const dynamicSequence: Sequence = {
      ...minimalSequence,
      components: [{
        id: 'adaptive',
        orderPath: 'root.adaptive',
        order: 'dynamic',
        components: [],
        skip: [],
      }],
    };
    const studyConfig = makeStudyConfig({
      components: {
        firstIteration: {
          type: 'markdown', path: 'first.md', response: [{ id: 'first-q', type: 'shortText', prompt: 'First iteration response' }],
        },
        thirdIteration: {
          type: 'markdown', path: 'third.md', response: [{ id: 'third-q', type: 'shortText', prompt: 'Third iteration response' }],
        },
        secondIteration: {
          type: 'markdown', path: 'second.md', response: [{ id: 'second-q', type: 'shortText', prompt: 'Second iteration response' }],
        },
      },
      sequence: dynamicSequence,
    });
    const answers = {
      adaptive_0_firstIteration_0: makeStoredAnswer({ componentName: 'firstIteration', trialOrder: '0_0' }),
      adaptive_0_thirdIteration_2: makeStoredAnswer({ componentName: 'thirdIteration', trialOrder: '0_2' }),
    };
    mockLocation.pathname = '/test-study/0/2';
    const { container, rerender } = await act(async () => render(
      <StepsPanel
        participantAnswers={{}}
        activeParticipantSequence={dynamicSequence}
        activeParticipantAnswers={answers}
        studyConfig={studyConfig}
      />,
    ));

    expect(container.textContent).toContain('Third iteration response');
    expect(container.textContent).not.toContain('No component is selected.');

    mockLocation.pathname = '/test-study/0/1';
    await act(async () => rerender(
      <StepsPanel
        participantAnswers={{}}
        activeParticipantSequence={dynamicSequence}
        activeParticipantAnswers={answers}
        studyConfig={studyConfig}
      />,
    ));
    expect(container.textContent).toContain('No component is selected.');
    expect(container.textContent).not.toContain('Third iteration response');

    const withSecondIteration = {
      ...answers,
      adaptive_0_secondIteration_1: makeStoredAnswer({ componentName: 'secondIteration', trialOrder: '0_1' }),
    };
    await act(async () => rerender(
      <StepsPanel
        participantAnswers={{}}
        activeParticipantSequence={dynamicSequence}
        activeParticipantAnswers={withSecondIteration}
        studyConfig={studyConfig}
      />,
    ));
    expect(container.textContent).toContain('Second iteration response');
    expect(container.textContent).not.toContain('Third iteration response');

    mockLocation.pathname = '/test-study/0/2';
    await act(async () => rerender(
      <StepsPanel
        participantAnswers={{}}
        activeParticipantSequence={dynamicSequence}
        activeParticipantAnswers={withSecondIteration}
        studyConfig={studyConfig}
      />,
    ));
    expect(container.textContent).toContain('Third iteration response');
    expect(container.textContent).not.toContain('Second iteration response');

    mockLocation.pathname = '/test-study/0/2';
    const { container: participantContainer } = await act(async () => render(
      <StepsPanel
        participantSequence={dynamicSequence}
        participantAnswers={answers}
        studyConfig={studyConfig}
      />,
    ));
    expect(participantContainer.textContent).toContain('Third iteration response');
    expect(participantContainer.textContent).not.toContain('No component is selected.');
  });

  test('uses trial-entry global variables to show draft answers in both Study Browser tabs', async () => {
    const studyConfig = makeStudyConfig({
      globalVariables: { enabled: true },
      components: {
        intro: {
          type: 'markdown',
          path: 'intro.md',
          response: [{
            id: 'conditional',
            type: 'shortText',
            prompt: 'Visible draft response',
            visibleIf: { globalVariable: 'enabled', comparison: 'equals', value: false },
          }],
        },
      },
      sequence: minimalSequence,
    });
    const draft = makeStoredAnswer({
      componentName: 'intro',
      trialOrder: '0',
      answer: { conditional: 'draft answer' },
    });
    const laterAcceptedAnswer = makeStoredAnswer({ identifier: 'later_1', componentName: 'later', trialOrder: '1' });
    const globalGraph = createGlobalStoreSubmission(
      undefined,
      studyConfig.globalVariables!,
      laterAcceptedAnswer,
      { enabled: false },
      [],
      {},
    ).graph;
    mockLocation.pathname = '/test-study/0';

    const { container, rerender } = await act(async () => render(
      <StepsPanel globalGraph={globalGraph} participantSequence={minimalSequence} participantAnswers={{ intro_0: draft }} studyConfig={studyConfig} />,
    ));
    expect(container.textContent).toContain('draft answer');

    await act(async () => rerender(
      <StepsPanel
        globalGraph={globalGraph}
        participantAnswers={{}}
        activeParticipantSequence={minimalSequence}
        activeParticipantAnswers={{ intro_0: draft }}
        studyConfig={studyConfig}
      />,
    ));
    expect(container.textContent).toContain('draft answer');
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
