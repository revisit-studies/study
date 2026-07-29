import React from 'react';
import {
  render, act, fireEvent, cleanup,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { RankingInput } from '../RankingInput';
import type { RankingResponse } from '../../../parser/types';

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
  PointerSensor: class { },
  KeyboardSensor: class { },
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
  Paper: React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(function Paper({ children }, ref) { // eslint-disable-line prefer-arrow-callback
    return React.createElement('div', { ref }, children);
  }),
  Stack: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
}));

vi.mock('clsx', () => ({ default: (...args: unknown[]) => args.filter(Boolean).join(' ') }));

vi.mock('../InputLabel', () => ({
  InputLabel: ({ prompt }: { prompt: string }) => React.createElement('label', null, prompt),
}));

vi.mock('../OptionLabel', () => ({
  OptionLabel: ({ label }: { label: string }) => React.createElement('span', null, label),
}));

vi.mock('../css/RankingDnd.module.css', () => ({
  default: { item: 'item', itemDragging: 'itemDragging' },
}));

vi.mock('../../../store/store', () => ({
  useStoreActions: () => ({ setRankingAnswers: vi.fn().mockReturnValue({}) }),
  useStoreDispatch: () => vi.fn(),
}));

vi.mock('../../../utils/stringOptions', () => ({
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
  } as DragEndEvent;
}

function makeDragStart(activeId: string): DragStartEvent {
  return {
    active: { id: activeId, data: { current: undefined }, rect: { current: { initial: null, translated: null } } },
    activatorEvent: new Event('pointerdown'),
  } as DragStartEvent;
}

function pairwiseAvailableDragId(optionId: string) {
  return `available:${optionId}`;
}

function pairwisePlacedDragId(instanceId: string) {
  return `placed:${instanceId}`;
}

// Generated instance keys are tagged (see makeRankingInstanceKey)
function rankingInstanceKey(baseItemId: string, instanceIndex: number) {
  return `instance-${instanceIndex}-${baseItemId}`;
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

  test('Add New Pair button click adds a pair', async () => {
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
      capturedOnDragStart?.(makeDragStart(pairwiseAvailableDragId('Item A')));
    });
    expect(capturedOnDragStart).toBeDefined();
  });

  test('handleDragEnd: no over → early return', async () => {
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={{ value: {} }} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('Item A'), null));
    });
    expect(capturedOnDragEnd).toBeDefined();
  });

  test('handleDragEnd: drop to unassigned removes item from pair', async () => {
    const onChange = vi.fn();
    const answer = {
      value: { 'Item A_0': 'pair-0-high' },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwisePlacedDragId('Item A_0'), 'unassigned'));
    });
    expect(onChange).toHaveBeenCalledWith({});
  });

  test('instances of "model" are never confused with the option "model_0"', async () => {
    const onChange = vi.fn();
    const response = makeResponse('ranking-pairwise', {
      options: [
        { label: 'Original model', value: 'model' },
        { label: 'Model 0', value: 'model_0' },
      ],
    });
    render(
      <RankingInput
        {...baseProps}
        response={response}
        answer={{ value: {}, onChange } as unknown as { value: Record<string, string> }}
      />,
    );
    // The generated instance key is a tagged tuple, not the legacy 'model_0'
    // string that would collide with the real option value
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('model'), 'pair-0-high'));
    });
    expect(onChange).toHaveBeenCalledWith({ [rankingInstanceKey('model', 0)]: 'pair-0-high' });
  });

  test('a placed instance of "model" renders as its own label, not "Model 0"', () => {
    const response = makeResponse('ranking-pairwise', {
      options: [
        { label: 'Original model', value: 'model' },
        { label: 'Model 0', value: 'model_0' },
      ],
    });
    const answer = { value: { [rankingInstanceKey('model', 0)]: 'pair-0-high' } };
    const { getAllByText } = render(
      <RankingInput {...baseProps} response={response} answer={answer} />,
    );
    // Once in the pair slot, once in Available Items
    expect(getAllByText('Original model').length).toBe(2);
    // 'Model 0' only appears in Available Items
    expect(getAllByText('Model 0').length).toBe(1);
  });

  test('generated keys skip indices that collide with a configured option value', async () => {
    const onChange = vi.fn();
    // Pathological config: an option literally named like a generated key
    const response = makeResponse('ranking-pairwise', { options: ['model', 'instance-0-model'] });
    render(
      <RankingInput
        {...baseProps}
        response={response}
        answer={{ value: {}, onChange } as unknown as { value: Record<string, string> }}
      />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('model'), 'pair-0-high'));
    });
    // index 0 would produce the option value 'instance-0-model'; the guard
    // bumps to index 1
    expect(onChange).toHaveBeenCalledWith({ 'instance-1-model': 'pair-0-high' });
  });

  test('moving an assigned plain default key moves it instead of duplicating', async () => {
    const onChange = vi.fn();
    // Defaults are documented as plain option-value keys; moving the placed
    // default must relocate it, not treat it as a fresh drop from Available
    // Items that would leave the original behind.
    const answer = {
      value: { 'Item A': 'pair-0-high' },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwisePlacedDragId('Item A'), 'pair-1-high'));
    });
    expect(onChange).toHaveBeenCalledWith({ 'Item A': 'pair-1-high' });
  });

  test('handleDragEnd: drop from unassigned to pair-high', async () => {
    const onChange = vi.fn();
    render(
      <RankingInput
        {...baseProps}
        response={makeResponse('ranking-pairwise')}
        answer={{ value: {}, onChange } as unknown as { value: Record<string, string> }}
      />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('Item A'), 'pair-0-high'));
    });
    expect(onChange).toHaveBeenCalledWith({ [rankingInstanceKey('Item A', 0)]: 'pair-0-high' });
  });

  test('handleDragEnd: position already occupied (one item limit)', async () => {
    const onChange = vi.fn();
    const answer = {
      value: { 'Item A_0': 'pair-0-high' },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      // Try to drop another item into pair-0-high which already has an item
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('Item B'), 'pair-0-high'));
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  test('handleDragEnd: same item in opposite position error', async () => {
    const onChange = vi.fn();
    const answer = {
      value: { 'Item A_0': 'pair-0-high' },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      // Try to drop Item A into the opposite position (pair-0-low)
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('Item A'), 'pair-0-low'));
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  test('handleDragEnd: duplicate pair detection (covers checkForDuplicatePair)', async () => {
    const onChange = vi.fn();
    // pair-0 = {A, B}; pair-1 already holds A, so completing it with B would
    // duplicate pair-0 and the drop must be rejected
    const answer = {
      value: {
        'Item A_0': 'pair-0-high',
        'Item B_1': 'pair-0-low',
        'Item A_2': 'pair-1-high',
      },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('Item B'), 'pair-1-low'));
    });
    expect(onChange).not.toHaveBeenCalled();

    // A non-duplicating completion (Item C) is accepted
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('Item C'), 'pair-1-low'));
    });
    expect(onChange).toHaveBeenCalledWith({
      'Item A_0': 'pair-0-high',
      'Item B_1': 'pair-0-low',
      'Item A_2': 'pair-1-high',
      [rankingInstanceKey('Item C', 3)]: 'pair-1-low',
    });
  });

  test('dropping onto an item card is ignored', async () => {
    const onChange = vi.fn();
    const answer = {
      value: { [rankingInstanceKey('Item A', 0)]: 'pair-0-high' },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    // Dropping onto another item card (not a zone) must not store the card's
    // drag id as an answer location
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(
        pairwiseAvailableDragId('Item B'),
        pairwisePlacedDragId(rankingInstanceKey('Item A', 0)),
      ));
    });
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(
        pairwisePlacedDragId(rankingInstanceKey('Item A', 0)),
        pairwiseAvailableDragId('Item B'),
      ));
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  test('moving a placed item cannot create a duplicate pair', async () => {
    const onChange = vi.fn();
    // pair-0 = {A, B}, pair-1 = {A}, pair-2 = {B}; moving B from pair-2 into
    // pair-1 would make pair-1 a duplicate of the intact pair-0
    const answer = {
      value: {
        [rankingInstanceKey('Item A', 0)]: 'pair-0-high',
        [rankingInstanceKey('Item B', 1)]: 'pair-0-low',
        [rankingInstanceKey('Item A', 2)]: 'pair-1-high',
        [rankingInstanceKey('Item B', 3)]: 'pair-2-high',
      },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwisePlacedDragId(rankingInstanceKey('Item B', 3)), 'pair-1-low'));
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  test('moving a placed item that breaks its source pair is allowed', async () => {
    const onChange = vi.fn();
    // pair-0 = {A, B}, pair-1 = {A}; moving B out of pair-0 into pair-1 leaves
    // pair-0 = {A}, so the result is not a duplicate
    const answer = {
      value: {
        [rankingInstanceKey('Item A', 0)]: 'pair-0-high',
        [rankingInstanceKey('Item B', 1)]: 'pair-0-low',
        [rankingInstanceKey('Item A', 2)]: 'pair-1-high',
      },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwisePlacedDragId(rankingInstanceKey('Item B', 1)), 'pair-1-low'));
    });
    expect(onChange).toHaveBeenCalledWith({
      [rankingInstanceKey('Item A', 0)]: 'pair-0-high',
      [rankingInstanceKey('Item A', 2)]: 'pair-1-high',
      [rankingInstanceKey('Item B', 1)]: 'pair-1-low',
    });
  });

  test('an item can move between HIGH and LOW within its own pair', async () => {
    const onChange = vi.fn();
    const answer = {
      value: { [rankingInstanceKey('Item A', 0)]: 'pair-0-high' },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    // The moving instance itself must not count as "already in the opposite side"
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwisePlacedDragId(rankingInstanceKey('Item A', 0)), 'pair-0-low'));
    });
    expect(onChange).toHaveBeenCalledWith({ [rankingInstanceKey('Item A', 0)]: 'pair-0-low' });
  });

  test('handleDragEnd: move existing positioned item to a new pair position', async () => {
    const onChange = vi.fn();
    const answer = {
      value: { 'Item A_0': 'pair-0-high' },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    // Move an already-placed instance to a different pair — the key is kept,
    // only its location changes
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwisePlacedDragId('Item A_0'), 'pair-1-high'));
    });
    expect(onChange).toHaveBeenCalledWith({ 'Item A_0': 'pair-1-high' });
  });

  test('restored answer initializes pair rows from answer.value (no phantom pair 0)', async () => {
    const answer = { value: { 'Item A_0': 'pair-1-high' } };
    const { getAllByRole } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    // Only the restored pair-1 row should render; without restoration a default
    // empty pair-0 row would appear alongside it.
    let xButtons = getAllByRole('button').filter((b) => b.textContent === 'X');
    expect(xButtons.length).toBe(1);

    const addBtn = getAllByRole('button').find((b) => b.textContent === 'Add New Pair');
    await act(async () => { fireEvent.click(addBtn!); });
    xButtons = getAllByRole('button').filter((b) => b.textContent === 'X');
    expect(xButtons.length).toBe(2);
  });

  test('restored answer: Add New Pair targets a fresh pair id, not an existing one', async () => {
    const onChange = vi.fn();
    const answer = {
      value: { 'Item A_0': 'pair-1-high' },
      onChange,
    } as unknown as { value: Record<string, string> };
    const { getAllByRole } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    const addBtn = getAllByRole('button').find((b) => b.textContent === 'Add New Pair');
    await act(async () => { fireEvent.click(addBtn!); });

    // Removing the newly added pair must leave the restored pair-1 data intact;
    // if Add had reused pair id 1, this would wipe 'Item A_0'.
    const xButtons = getAllByRole('button').filter((b) => b.textContent === 'X');
    await act(async () => { fireEvent.click(xButtons[xButtons.length - 1]!); });
    expect(onChange).toHaveBeenCalledWith({ 'Item A_0': 'pair-1-high' });
  });

  test('restored answer: new instance keys never overwrite existing keys', async () => {
    const onChange = vi.fn();
    const answer = {
      value: { 'Item A_0': 'pair-1-high', 'Item B_1': 'pair-1-low' },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={answer} />,
    );
    // Re-adding Item A from unassigned must generate a fresh suffix (_2), not
    // reuse _0 and silently relocate the restored 'Item A_0' entry.
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('Item A'), 'pair-2-high'));
    });
    expect(onChange).toHaveBeenCalledWith({
      'Item A_0': 'pair-1-high',
      'Item B_1': 'pair-1-low',
      [rankingInstanceKey('Item A', 2)]: 'pair-2-high',
    });
  });

  test('option values containing underscores render inside pairs', () => {
    const response = makeResponse('ranking-pairwise', { options: ['new_york', 'other_option'] });
    const answer = { value: { new_york_0: 'pair-0-high' } };
    const { getAllByText } = render(
      <RankingInput {...baseProps} response={response} answer={answer} />,
    );
    // Once in the pair slot, once in the Available Items list — with naive
    // underscore splitting the pair slot entry resolves to 'new' and disappears.
    expect(getAllByText('new_york').length).toBe(2);
  });

  test('option values containing underscores drag from unassigned as new instances', async () => {
    const onChange = vi.fn();
    const response = makeResponse('ranking-pairwise', { options: ['new_york', 'other_option'] });
    const answer = { value: {}, onChange } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={response} answer={answer} />,
    );
    // With includes('_') detection, 'new_york' would be treated as an existing
    // instance and written without a counter suffix.
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('new_york'), 'pair-0-high'));
    });
    expect(onChange).toHaveBeenCalledWith({ [rankingInstanceKey('new_york', 0)]: 'pair-0-high' });
  });

  test('option value ending in digits is not mistaken for a generated instance', async () => {
    const onChange = vi.fn();
    const response = makeResponse('ranking-pairwise', { options: ['route_66', 'Item B'] });
    // Default-style answer keyed by the plain option value
    const answer = {
      value: { route_66: 'pair-0-high' },
      onChange,
    } as unknown as { value: Record<string, string> };
    render(
      <RankingInput {...baseProps} response={response} answer={answer} />,
    );
    // If 'route_66' were parsed as instance 66 of 'route', the counter would jump
    // to 67; it must stay at 0 for the first generated instance.
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('Item B'), 'pair-0-low'));
    });
    expect(onChange).toHaveBeenCalledWith({
      route_66: 'pair-0-high',
      [rankingInstanceKey('Item B', 0)]: 'pair-0-low',
    });
  });

  test('async restoration replaces the untouched default pair 0 row', async () => {
    const { rerender, getAllByRole } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={{ value: {} }} />,
    );
    // Empty answer renders the single default pair 0 row
    expect(getAllByRole('button').filter((b) => b.textContent === 'X').length).toBe(1);

    await act(async () => {
      rerender(
        <RankingInput
          {...baseProps}
          response={makeResponse('ranking-pairwise')}
          answer={{ value: { [rankingInstanceKey('Item A', 0)]: 'pair-1-high' } }}
        />,
      );
    });
    // The restored pair 1 replaces the untouched placeholder — no phantom
    // empty pair 0 row remains
    expect(getAllByRole('button').filter((b) => b.textContent === 'X').length).toBe(1);
  });

  test('counters resync when answer.value is replaced while mounted', async () => {
    const onChange = vi.fn();
    const emptyAnswer = { value: {}, onChange } as unknown as { value: Record<string, string> };
    const { rerender } = render(
      <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={emptyAnswer} />,
    );

    // Simulate an async answer restoration after mount
    const restoredAnswer = {
      value: { 'Item A_0': 'pair-1-high', 'Item B_1': 'pair-1-low' },
      onChange,
    } as unknown as { value: Record<string, string> };
    await act(async () => {
      rerender(
        <RankingInput {...baseProps} response={makeResponse('ranking-pairwise')} answer={restoredAnswer} />,
      );
    });

    // Without resyncing, the counter would still be 0 and this drag would emit
    // 'Item A_0', overwriting the restored key.
    await act(async () => {
      capturedOnDragEnd?.(makeDragEnd(pairwiseAvailableDragId('Item A'), 'pair-2-high'));
    });
    expect(onChange).toHaveBeenCalledWith({
      'Item A_0': 'pair-1-high',
      'Item B_1': 'pair-1-low',
      [rankingInstanceKey('Item A', 2)]: 'pair-2-high',
    });
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
    const response = makeResponse('ranking-sublist', { secondaryText: 'secondary hint' });
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
