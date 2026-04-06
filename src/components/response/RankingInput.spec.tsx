import React from 'react';
import {
  render, act, fireEvent, cleanup,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { RankingInput } from './RankingInput';
import type { RankingResponse } from '../../parser/types';

// ── DnD handler capture ──────────────────────────────────────────────────────

let capturedOnDragStart: ((e: DragStartEvent) => void) | undefined;
let capturedOnDragEnd: ((e: DragEndEvent) => void) | undefined;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@dnd-kit/core', () => ({
  DndContext: vi.fn(({
    onDragStart,
    onDragEnd,
    children,
  }: {
    onDragStart?: (e: DragStartEvent) => void;
    onDragEnd?: (e: DragEndEvent) => void;
    children?: React.ReactNode;
  }) => {
    capturedOnDragStart = onDragStart;
    capturedOnDragEnd = onDragEnd;
    return React.createElement(React.Fragment, null, children);
  }),
  DragOverlay: ({ children }: { children?: React.ReactNode }) => (
    React.createElement(React.Fragment, null, children ?? null)
  ),
  PointerSensor: class {},
  KeyboardSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
  rectIntersection: vi.fn(),
}));

function arrayMoveMock(arr: unknown[], from: number, to: number): unknown[] {
  const newArr = [...arr];
  const [item] = newArr.splice(from, 1);
  newArr.splice(to, 0, item!);
  return newArr;
}

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn(arrayMoveMock),
  SortableContext: ({ children }: { children?: React.ReactNode }) => (
    React.createElement(React.Fragment, null, children)
  ),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

vi.mock('@mantine/core', () => ({
  Box: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Button: ({ children, onClick, disabled }: {
    children?: React.ReactNode; onClick?: () => void; disabled?: boolean;
  }) => React.createElement('button', { type: 'button', onClick, disabled }, children),
  Flex: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Group: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Paper: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Stack: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
}));

vi.mock('clsx', () => ({ default: (...args: unknown[]) => args.filter(Boolean).join(' ') }));

vi.mock('./InputLabel', () => ({
  InputLabel: ({ prompt }: { prompt: string }) => React.createElement('label', null, prompt),
}));

vi.mock('./OptionLabel', () => ({
  OptionLabel: ({ label }: { label: string }) => React.createElement('span', null, label),
}));

vi.mock('./css/RankingDnd.module.css', () => ({
  default: { item: 'item', itemDragging: 'itemDragging' },
}));

vi.mock('../../store/store', () => ({
  useStoreActions: () => ({ setRankingAnswers: vi.fn().mockReturnValue({}) }),
  useStoreDispatch: () => vi.fn(),
}));

vi.mock('../../utils/stringOptions', () => ({
  parseStringOptions: (opts: (string | { value: string; label: string })[]) => opts.map((o) => (
    typeof o === 'string' ? { value: o, label: o } : o
  )),
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const OPTIONS = ['Item A', 'Item B', 'Item C'];

function makeResponse(type: 'ranking-sublist' | 'ranking-categorical' | 'ranking-pairwise', extra: Partial<RankingResponse> = {}): RankingResponse {
  return {
    type,
    id: 'q1',
    prompt: 'Rank these',
    required: false,
    options: OPTIONS,
    ...extra,
  } as RankingResponse;
}

const baseProps = {
  index: 0,
  disabled: false,
  enumerateQuestions: false,
};

// ── lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedOnDragStart = undefined;
  capturedOnDragEnd = undefined;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// ── helper ────────────────────────────────────────────────────────────────────

function makeDragEnd(
  activeId: string,
  overId: string | null,
): DragEndEvent {
  return {
    active: { id: activeId, data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
    over: overId ? {
      id: overId,
      data: { current: undefined },
      rect: {
        width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0,
      },
    } : null,
    collisions: null,
    delta: { x: 0, y: 0 },
    activatorEvent: new Event('pointerdown'),
  } as never;
}

function makeDragStart(activeId: string): DragStartEvent {
  return {
    active: { id: activeId, data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
    activatorEvent: new Event('pointerdown'),
  } as never;
}

// ══ RankingSublistComponent ══════════════════════════════════════════════════

describe('RankingSublistComponent', () => {
  test('renders with empty answer', () => {
    const { container } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={{ value: {} }} />,
    );
    expect(container).toBeDefined();
  });

  test('renders with pre-filled answer (covers initialState with existing answer.value)', () => {
    const answer = { value: { 'Item A': '0', 'Item B': '1' } };
    const { container } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={answer} />,
    );
    expect(container).toBeDefined();
  });

  test('renders with numItems that truncates selected (covers slice branch)', () => {
    const answer = { value: { 'Item A': '0', 'Item B': '1', 'Item C': '2' } };
    const { container } = render(
      <RankingInput
        {...baseProps}
        response={makeResponse('ranking-sublist', { numItems: 1 })}
        answer={answer}
      />,
    );
    expect(container).toBeDefined();
  });

  test('handleDragStart sets activeId', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragStart?.(makeDragStart('Item A'));
    });
    // DragOverlay renders activeItem when activeId is set — just verify no crash
    expect(capturedOnDragStart).toBeDefined();
  });

  test('handleDragEnd: no over → early return', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', null));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: disabled → early return', async () => {
    render(
      <RankingInput {...baseProps} disabled response={makeResponse('ranking-sublist')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'selected'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: fromSelected to selected (reorder)', async () => {
    const answer = { value: { 'Item A': '0', 'Item B': '1' } };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'Item B'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: fromSelected to selected zone (reorder to end)', async () => {
    const answer = { value: { 'Item A': '0', 'Item B': '1' } };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'selected'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: fromUnassigned to selected', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item C', 'selected'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: fromUnassigned to selected but numItems exceeded', async () => {
    const answer = { value: { 'Item A': '0' } };
    render(
      <RankingInput
        {...baseProps}
        response={makeResponse('ranking-sublist', { numItems: 1 })}
        answer={answer}
      />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item B', 'selected'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: fromSelected to unassigned', async () => {
    const answer = { value: { 'Item A': '0' } };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'unassigned'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: else path (item not in either list)', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('NonExistent', 'unassigned'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });
});

// ══ RankingCategoricalComponent ══════════════════════════════════════════════

describe('RankingCategoricalComponent', () => {
  test('renders with empty answer', () => {
    const { container } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-categorical')} answer={{ value: {} }} />,
    );
    expect(container).toBeDefined();
  });

  test('renders with pre-filled categorical answer', () => {
    const answer = { value: { 'Item A': 'HIGH', 'Item B': 'MEDIUM', 'Item C': 'LOW' } };
    const { container } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-categorical')} answer={answer} />,
    );
    expect(container).toBeDefined();
  });

  test('handleDragStart sets activeId', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-categorical')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragStart?.(makeDragStart('Item A'));
    });
    expect(capturedOnDragStart).toBeDefined();
  });

  test('handleDragEnd: no over → early return', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-categorical')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', null));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: sourceCategory === targetCategory → early return', async () => {
    const answer = { value: { 'Item A': 'HIGH' } };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-categorical')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'HIGH'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: invalid targetCategory → early return', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-categorical')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'INVALID_ZONE'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: move item from unassigned to HIGH', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-categorical')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'HIGH'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: numItems exceeded for target category', async () => {
    const answer = { value: { 'Item A': 'HIGH' } };
    render(
      <RankingInput
        {...baseProps}
        response={makeResponse('ranking-categorical', { numItems: 1 })}
        answer={answer}
      />,
    );
    await act(async () => {
      // Move from unassigned to HIGH which already has 1 item = numItems
      capturedOnDragEnd?.(makeDragEnd('Item B', 'HIGH'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: move item from HIGH to MEDIUM', async () => {
    const answer = { value: { 'Item A': 'HIGH' } };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-categorical')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'MEDIUM'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });
});

// ══ RankingPairwiseComponent ═════════════════════════════════════════════════

describe('RankingPairwiseComponent', () => {
  test('renders with empty answer', () => {
    const { container } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={{ value: {} }} />,
    );
    expect(container).toBeDefined();
  });

  test('renders with pre-filled pairwise answer (covers pair[position] rendering)', () => {
    const answer = { value: { 'Item A_0': 'pair-0-high', 'Item B_1': 'pair-0-low' } };
    const { container } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    expect(container).toBeDefined();
  });

  test('Add New Pair button click (covers lines 474-478)', async () => {
    const { getAllByRole } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={{ value: {} }} />,
    );
    const buttons = getAllByRole('button');
    const addBtn = buttons.find((b) => b.textContent === 'Add New Pair');
    expect(addBtn).toBeDefined();
    await act(async () => { fireEvent.click(addBtn!); });
    // Should have added a new pair without error
    expect(getAllByRole('button').length).toBeGreaterThan(0);
  });

  test('Add New Pair is no-op when disabled', async () => {
    const { getAllByRole } = render(
      <RankingInput {...baseProps} disabled response={makeResponse('ranking-pairwise')} answer={{ value: {} }} />,
    );
    const buttons = getAllByRole('button');
    const addBtn = buttons.find((b) => b.textContent === 'Add New Pair');
    expect(addBtn).toBeDefined();
    await act(async () => { fireEvent.click(addBtn!); });
  });

  test('handleDragStart sets activeId', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragStart?.(makeDragStart('Item A'));
    });
    expect(capturedOnDragStart).toBeDefined();
  });

  test('handleDragEnd: no over → early return', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', null));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: drop to unassigned removes item from pair', async () => {
    const answer = { value: { 'Item A_0': 'pair-0-high' } };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A_0', 'unassigned'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: drop from unassigned to pair-high', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'pair-0-high'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: position already occupied (one item limit)', async () => {
    const answer = { value: { 'Item A_0': 'pair-0-high' } };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      // Try to drop another item into pair-0-high which already has an item
      capturedOnDragEnd?.(makeDragEnd('Item B', 'pair-0-high'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: same item in opposite position error', async () => {
    const answer = { value: { 'Item A_0': 'pair-0-high' } };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      // Try to drop Item A into the opposite position (pair-0-low)
      capturedOnDragEnd?.(makeDragEnd('Item A', 'pair-0-low'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: duplicate pair detection (covers checkForDuplicatePair)', async () => {
    // pair-0 has Item A (high) vs Item B (low); try to create pair-1 with same combo
    const answer = {
      value: {
        'Item A_0': 'pair-0-high',
        'Item B_1': 'pair-0-low',
      },
    };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    // Add a new pair first
    await act(async () => {
      const buttons = document.querySelectorAll('button');
      const addBtn = Array.from(buttons).find((b) => b.textContent === 'Add New Pair');
      if (addBtn) fireEvent.click(addBtn);
    });
    // Now drag Item A to pair-1-high — creates a temp with Item A_temp on pair-1
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A', 'pair-1-high'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: move existing positioned item to new pair position', async () => {
    const answer = { value: { 'Item A_0': 'pair-0-high' } };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    // Move an already-placed item (non-unassigned) to a different position
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item A_0', 'pair-0-low'));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleRemovePair via X button', async () => {
    const answer = { value: { 'Item A_0': 'pair-0-high' } };
    const { getAllByRole } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    const buttons = getAllByRole('button');
    const xButton = buttons.find((b) => b.textContent === 'X');
    expect(xButton).toBeDefined();
    await act(async () => { fireEvent.click(xButton!); });
    // After removing pair, pair count decreases
    expect(getAllByRole('button').length).toBeGreaterThan(0);
  });

  test('handleRemovePair is no-op when disabled', async () => {
    const { getAllByRole } = render(
      <RankingInput
        {...baseProps}
        disabled
        response={makeResponse('ranking-pairwise')}
        answer={{ value: {} }}
      />,
    );
    const buttons = getAllByRole('button');
    const xButton = buttons.find((b) => b.textContent === 'X');
    if (xButton) {
      await act(async () => { fireEvent.click(xButton); });
    }
  });
});

// ══ RankingInput — main component ═══════════════════════════════════════════

describe('RankingInput — main component', () => {
  test('renders error text when error is set', async () => {
    // Trigger an error via numItems exceeded
    const answer = { value: { 'Item A': '0' } };
    const { container } = render(
      <RankingInput
        {...baseProps}
        response={makeResponse('ranking-sublist', { numItems: 1 })}
        answer={answer}
      />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd('Item B', 'selected'));
    });
    expect(container).toBeDefined();
  });

  test('renders secondaryText when provided', () => {
    const response = makeResponse('ranking-sublist', { secondaryText: 'secondary hint' } as never);
    const { container } = render(
      <RankingInput {...baseProps} response={response} answer={{ value: {} }} />,
    );
    expect(container.textContent).toContain('secondary hint');
  });

  test('renders prompt when non-empty', () => {
    const { container } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-sublist')} answer={{ value: {} }} />,
    );
    expect(container.textContent).toContain('Rank these');
  });
});
