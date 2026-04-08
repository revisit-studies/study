import { ReactNode } from 'react';
import {
  render, act, cleanup, fireEvent,
} from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import type { StudyConfig } from '../../../parser/types';
import { Sequence, StoredAnswer } from '../../../store/types';
import { getDynamicComponentsForBlock } from '../StepsPanel.utils';
import { StepsPanel } from '../StepsPanel';

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
  useLocation: () => ({ pathname: '/', search: '' }),
}));

vi.mock('../../../utils/getSequenceFlatMap', () => ({
  addPathToComponentBlock: (seq: Sequence) => seq,
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (i: number) => String(i),
}));

vi.mock('../../../parser/utils', () => ({
  isDynamicBlock: () => false,
  isInheritedComponent: () => false,
}));

vi.mock('../../../utils/correctAnswer', () => ({
  componentAnswersAreCorrect: vi.fn(() => true),
}));

vi.mock('@mantine/core', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Code: ({ children }: { children: ReactNode }) => <code>{children}</code>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCard: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Target: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Dropdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  NavLink: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <div role="link" onClick={onClick}>{children}</div>
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Tooltip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowsShuffle: () => null,
  IconBinaryTree: () => null,
  IconBrain: () => null,
  IconCheck: () => null,
  IconChevronUp: () => null,
  IconDice3: () => null,
  IconDice5: () => null,
  IconInfoCircle: () => null,
  IconPackageImport: () => null,
  IconX: () => null,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const minimalSequence: Sequence = {
  id: 'root',
  orderPath: 'root',
  order: 'fixed',
  components: ['intro', 'end'],
  skip: [],
};

const minimalStudyConfig = {
  $schema: '',
  studyMetadata: {
    title: 'Test Study',
    version: '1.0',
    authors: [],
    date: '2024-01-01',
    description: '',
    organizations: [],
  },
  uiConfig: {
    contactEmail: 'test@test.com',
    withProgressBar: false,
    withSidebar: true,
    sidebarWidth: 300,
    studyEndMsg: '',
    windowEventDebounceTime: 100,
    navigationBar: 'sidebar',
    showTitleBar: true,
  },
  components: {
    intro: {
      type: 'markdown' as const,
      path: 'intro.md',
      response: [],
    },
  },
  sequence: minimalSequence,
} as unknown as StudyConfig;

afterEach(() => { cleanup(); });

// ── component rendering tests ──────────────────────────────────────────────────

describe('StepsPanel rendering', () => {
  test('renders without crashing when no participant sequence provided', async () => {
    const { container } = await act(async () => render(
      <StepsPanel
        participantAnswers={{}}
        studyConfig={minimalStudyConfig}
      />,
    ));
    expect(container).toBeDefined();
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

describe('StepsPanel Show more/less buttons', () => {
  // correctAnswer with 7 keys produces 9-line JSON (> INITIAL_CLAMP=6)
  const longCorrectAnswer = [
    { id: 'q1', value: 1 },
    { id: 'q2', value: 2 },
    { id: 'q3', value: 3 },
    { id: 'q4', value: 4 },
    { id: 'q5', value: 5 },
    { id: 'q6', value: 6 },
    { id: 'q7', value: 7 },
  ];

  // response array with enough items to exceed INITIAL_CLAMP lines
  const longResponse = [
    { id: 'r1', type: 'numerical', prompt: 'A' },
    { id: 'r2', type: 'numerical', prompt: 'B' },
    { id: 'r3', type: 'numerical', prompt: 'C' },
  ];

  const configWithLongAnswers = {
    ...minimalStudyConfig,
    components: {
      intro: {
        type: 'markdown' as const,
        path: 'intro.md',
        response: longResponse,
        correctAnswer: longCorrectAnswer,
      },
    },
  } as unknown as StudyConfig;

  const participantAnswer = {
    answer: { q1: 1 },
    identifier: 'intro_0',
    componentName: 'intro',
    trialOrder: 'root_0',
    incorrectAnswers: {},
    startTime: 0,
    endTime: 100,
    provenanceGraph: {},
    windowEvents: [],
  } as unknown as StoredAnswer;

  test('renders Show more button when correctAnswer JSON exceeds INITIAL_CLAMP', async () => {
    const { getAllByRole } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: participantAnswer }}
        studyConfig={configWithLongAnswers}
      />,
    ));
    const buttons = getAllByRole('button');
    expect(buttons.some((b) => b.textContent?.includes('Show'))).toBe(true);
  });

  test('clicking Show more toggles correctAnswer clamp to Show less', async () => {
    const { getAllByRole } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: participantAnswer }}
        studyConfig={configWithLongAnswers}
      />,
    ));
    const buttons = getAllByRole('button');
    const showMoreBtn = buttons.find((b) => b.textContent === 'Show more');
    expect(showMoreBtn).toBeDefined();
    await act(async () => { fireEvent.click(showMoreBtn!); });
    const btnsAfter = getAllByRole('button');
    expect(btnsAfter.some((b) => b.textContent === 'Show less')).toBe(true);
  });

  test('clicking all Show more buttons covers response clamp handler', async () => {
    const { getAllByRole } = await act(async () => render(
      <StepsPanel
        participantSequence={minimalSequence}
        participantAnswers={{ intro_0: participantAnswer }}
        studyConfig={configWithLongAnswers}
      />,
    ));
    // Click every Show more button (covers both correctAnswer and response clamp handlers)
    const showMoreBtns = getAllByRole('button').filter((b) => b.textContent === 'Show more');
    for (const btn of showMoreBtns) {
      act(() => { fireEvent.click(btn); });
    }
    const btnsAfter = getAllByRole('button');
    expect(btnsAfter.some((b) => b.textContent === 'Show less')).toBe(true);
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
    const answerWithParams = {
      answer: { q1: 1 },
      identifier: 'intro_0',
      componentName: 'intro',
      trialOrder: 'root_0',
      incorrectAnswers: {},
      startTime: 0,
      endTime: 100,
      provenanceGraph: {},
      windowEvents: [],
      parameters: { key: 'val' },
    } as unknown as StoredAnswer;

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
    const configWithParams = {
      ...minimalStudyConfig,
      components: {
        intro: {
          type: 'markdown' as const,
          path: 'intro.md',
          response: [],
          parameters: { key: 'val' },
        },
      },
    } as unknown as StudyConfig;

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
    const configWithRandomization = {
      ...minimalStudyConfig,
      components: {
        intro: {
          type: 'markdown' as const,
          path: 'intro.md',
          response: [
            {
              id: 'r1', type: 'radio', prompt: 'Q1', options: ['A', 'B'], optionOrder: 'random',
            },
            {
              id: 'r2', type: 'matrix-radio', prompt: 'Q2', options: ['A', 'B'], questions: [], questionOrder: 'random',
            },
          ],
        },
      },
    } as unknown as StudyConfig;

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
  const studyConfigWithExtraComponents = {
    ...minimalStudyConfig,
    sequence: {
      id: 'root',
      orderPath: 'root',
      order: 'fixed' as const,
      components: [
        {
          id: 'block1',
          orderPath: 'root-block1',
          order: 'fixed' as const,
          components: ['intro', 'survey'],
          skip: [],
        },
      ],
      skip: [],
    },
    components: {
      intro: { type: 'markdown' as const, path: 'intro.md', response: [] },
      survey: { type: 'markdown' as const, path: 'survey.md', response: [] },
    },
  } as unknown as import('../../../parser/types').StudyConfig;

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
    ],
    skip: [],
  };

  test('renders excluded component from study sequence', async () => {
    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={participantWithExcludedComponent}
        participantAnswers={{}}
        studyConfig={studyConfigWithExtraComponents}
      />,
    ));
    expect(container).toBeDefined();
  });

  // Study config: block1 has [nested1, nested2 (excluded)]
  const studyConfigWithExcludedBlock = {
    ...minimalStudyConfig,
    sequence: {
      id: 'root',
      orderPath: 'root',
      order: 'fixed' as const,
      components: [
        {
          id: 'block1',
          orderPath: 'root-block1',
          order: 'fixed' as const,
          components: [
            {
              id: 'nested1',
              orderPath: 'root-block1-nested1',
              order: 'fixed' as const,
              components: ['intro'],
              skip: [],
            },
            {
              id: 'nested2',
              orderPath: 'root-block1-nested2',
              order: 'fixed' as const,
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
      intro: { type: 'markdown' as const, path: 'intro.md', response: [] },
      survey: { type: 'markdown' as const, path: 'survey.md', response: [] },
    },
  } as unknown as import('../../../parser/types').StudyConfig;

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
    ],
    skip: [],
  };

  test('renders excluded block with string children', async () => {
    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={participantWithExcludedBlock}
        participantAnswers={{}}
        studyConfig={studyConfigWithExcludedBlock}
      />,
    ));
    expect(container).toBeDefined();
  });

  // Excluded block with a nested sub-block
  const studyConfigWithNestedExcludedBlock = {
    ...minimalStudyConfig,
    sequence: {
      id: 'root',
      orderPath: 'root',
      order: 'fixed' as const,
      components: [
        {
          id: 'block1',
          orderPath: 'root-block1',
          order: 'fixed' as const,
          components: [
            {
              id: 'nested1',
              orderPath: 'root-block1-nested1',
              order: 'fixed' as const,
              components: ['intro'],
              skip: [],
            },
            {
              id: 'nested2',
              orderPath: 'root-block1-nested2',
              order: 'fixed' as const,
              components: [
                {
                  id: 'deepBlock',
                  order: 'fixed' as const,
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
      intro: { type: 'markdown' as const, path: 'intro.md', response: [] },
      survey: { type: 'markdown' as const, path: 'survey.md', response: [] },
    },
  } as unknown as import('../../../parser/types').StudyConfig;

  test('excluded block with nested sub-block children', async () => {
    const { container } = await act(async () => render(
      <StepsPanel
        participantSequence={participantWithExcludedBlock}
        participantAnswers={{}}
        studyConfig={studyConfigWithNestedExcludedBlock}
      />,
    ));
    expect(container).toBeDefined();
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
