import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  rectIntersection,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import cx from 'clsx';
import {
  Box, Button, Flex, Group, Paper, Stack, Text,
} from '@mantine/core';
import { useMemo, useState, useEffect } from 'react';
import { InputLabel } from './InputLabel';
import classes from './css/RankingDnd.module.css';
import { RankingResponse, StringOption } from '../../parser/types';
import { useStoreActions, useStoreDispatch } from '../../store/store';

type Item = { id: string; label: string; symbol: string };

function SortableItem({ item, index }: { item: Item; index?: number }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: item.symbol,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={{
        ...style, margin: '0 auto', minWidth: '200px',
      }}
      className={cx(classes.item, { [classes.itemDragging]: isDragging })}
      {...attributes}
      {...listeners}
      withBorder
      p="sm"
    >
      {index !== undefined && <Text c="dimmed" mr="sm">{index}</Text>}
      <Text>{item.label}</Text>
    </Paper>
  );
}

function DroppableZone({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Paper
      ref={setNodeRef}
      style={{
        backgroundColor: isOver ? '#f0f8ff' : undefined,
        borderColor: isOver ? '#4dabf7' : undefined,
        maxWidth: '600px',
      }}
      withBorder
      p="sm"
    >
      <Text fw={500} ta="center" mb="sm">{title}</Text>
      {children}
    </Paper>
  );
}

const createItems = (options: (StringOption | string)[]): Item[] => options.map((option) => ({
  id: typeof option === 'string' ? option : option.value,
  label: typeof option === 'string' ? option : option.label,
  symbol: typeof option === 'string' ? option : option.value,
}));

const useRankingLogic = (responseId: string, onChange?: (value: Record<string, string>) => void) => {
  const { setRankingAnswers } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const updateAnswer = (answerValue: Record<string, string>) => {
    onChange?.(answerValue);
    storeDispatch(setRankingAnswers({ responseId, values: answerValue }));
  };

  return { sensors, updateAnswer };
};

function RankingSublistComponent({
  options, responseId, answer, disabled, numItems, setError,
}: {
  options: (StringOption | string)[];
  responseId: string;
  answer: { value: Record<string, string> };
  disabled: boolean;
  numItems?: number;
  setError?: (error: string | null) => void;
}) {
  const { onChange } = answer as { onChange?: (value: Record<string, string>) => void };
  const { sensors, updateAnswer } = useRankingLogic(responseId, onChange);
  const items = useMemo(() => createItems(options), [options]);

  const [activeId, setActiveId] = useState<string | null>(null);

  const initialState = useMemo(() => {
    let selected: Item[] = [];
    if (answer?.value && Object.keys(answer.value).length > 0) {
      const sortedEntries = Object.entries(answer.value).sort((a, b) => parseInt(a[1], 10) - parseInt(b[1], 10));
      selected = sortedEntries.map(([id]) => items.find((i) => i.id === id)).filter(Boolean) as Item[];
      if (numItems && numItems > 0) selected = selected.slice(0, numItems);
    }
    return {
      selected,
      unassigned: items.filter((i) => !selected.find((s) => s.id === i.id)),
    };
  }, [items, answer, numItems]);

  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (disabled || !event.over) return;

    const id = event.active.id as string;
    const overId = event.over.id as string;

    const fromSelected = state.selected.find((i) => i.symbol === id);
    const fromUnassigned = state.unassigned.find((i) => i.symbol === id);
    const toSelected = overId === 'selected' || state.selected.find((i) => i.symbol === overId);
    const toUnassigned = overId === 'unassigned';

    const newState = { ...state };

    if (fromSelected && toSelected) {
      const oldIndex = state.selected.findIndex((i) => i.symbol === id);
      const newIndex = overId === 'selected' ? state.selected.length - 1 : state.selected.findIndex((i) => i.symbol === overId);
      newState.selected = arrayMove(state.selected, oldIndex, newIndex);
    } else if (fromUnassigned && toSelected) {
      if (numItems && state.selected.length >= numItems) {
        setError?.(`You can only add up to ${numItems} items.`);
        return;
      }
      newState.unassigned = state.unassigned.filter((i) => i.symbol !== id);
      newState.selected = [...state.selected, fromUnassigned];
    } else if (fromSelected && toUnassigned) {
      newState.selected = state.selected.filter((i) => i.symbol !== id);
      newState.unassigned = [...state.unassigned, fromSelected];
    } else {
      return;
    }

    setError?.(null);
    setState(newState);
    const answerValue: Record<string, string> = {};
    newState.selected.forEach((item, idx) => { answerValue[item.id] = idx.toString(); });
    updateAnswer(answerValue);
  };

  const activeItem = activeId ? items.find((i) => i.symbol === activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Stack gap="md" w="600px" mx="auto">
        <DroppableZone id="selected" title="">
          <Text size="md" fw={500} ta="center" mb="sm">HIGH</Text>
          <SortableContext items={state.selected.map((i) => i.symbol)} strategy={verticalListSortingStrategy}>
            <Stack>
              {state.selected.map((item, index) => (
                <SortableItem key={item.symbol} item={item} index={index + 1} />
              ))}
            </Stack>
          </SortableContext>
          <Text size="md" fw={500} ta="center" mt="sm">LOW</Text>
        </DroppableZone>

        <DroppableZone id="unassigned" title="Available Items">
          <SortableContext items={state.unassigned.map((i) => i.symbol)} strategy={verticalListSortingStrategy}>
            <Stack>
              {state.unassigned.map((item) => (
                <SortableItem key={item.symbol} item={item} />
              ))}
            </Stack>
          </SortableContext>
        </DroppableZone>
      </Stack>

      <DragOverlay>
        {activeItem ? <SortableItem item={activeItem} /> : undefined}
      </DragOverlay>
    </DndContext>
  );
}

function RankingCategoricalComponent({
  options, disabled, answer, responseId, numItems, setError,
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  answer: { value: Record<string, string> };
  responseId: string;
  numItems?: number;
  setError?: (error: string | null) => void;
}) {
  const { onChange } = answer as { onChange?: (value: Record<string, string>) => void };
  const { sensors, updateAnswer } = useRankingLogic(responseId, onChange);
  const items = useMemo(() => createItems(options), [options]);

  const [activeId, setActiveId] = useState<string | null>(null);

  const initialState = useMemo(() => {
    const state = {
      unassigned: [...items], HIGH: [] as Item[], MEDIUM: [] as Item[], LOW: [] as Item[],
    };
    if (answer?.value) {
      Object.entries(answer.value).forEach(([itemId, category]) => {
        const item = items.find((i) => i.id === itemId);
        if (item && ['HIGH', 'MEDIUM', 'LOW'].includes(category)) {
          state[category as 'HIGH' | 'MEDIUM' | 'LOW'].push(item);
          state.unassigned = state.unassigned.filter((i) => i.id !== itemId);
        }
      });
    }
    return state;
  }, [items, answer]);

  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (disabled || !event.over) return;

    const itemId = event.active.id as string;
    const targetCategory = event.over.id as string;
    const sourceCategory = Object.keys(state).find((cat) => state[cat as keyof typeof state].find((item: Item) => item.id === itemId));

    if (!sourceCategory || sourceCategory === targetCategory) return;
    if (!['unassigned', 'HIGH', 'MEDIUM', 'LOW'].includes(targetCategory)) return;

    setState((prev) => {
      const item = prev[sourceCategory as keyof typeof prev].find((i: Item) => i.id === itemId);
      if (!item) return prev;

      if (targetCategory !== 'unassigned' && numItems
          && (prev[targetCategory as keyof typeof prev] as Item[]).length >= numItems) {
        setError?.(`You can only add up to ${numItems} items.`);
        return prev;
      }

      setError?.(null);
      const newState = { ...prev };
      newState[sourceCategory as keyof typeof newState] = newState[sourceCategory as keyof typeof newState].filter((i: Item) => i.id !== itemId);
      newState[targetCategory as keyof typeof newState] = [...newState[targetCategory as keyof typeof newState] as Item[], item];

      const answerValue: Record<string, string> = {};
      ['HIGH', 'MEDIUM', 'LOW'].forEach((category) => {
        (newState[category as keyof typeof newState] as Item[]).forEach((rankingItem) => {
          answerValue[rankingItem.id] = category;
        });
      });
      updateAnswer(answerValue);
      return newState;
    });
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Stack gap="md" w="600px" mx="auto">
        {(['HIGH', 'MEDIUM', 'LOW', 'unassigned'] as const).map((category) => (
          <DroppableZone key={category} id={category} title={category === 'unassigned' ? 'Available Items' : category}>
            <SortableContext items={state[category].map((i) => i.symbol)} strategy={verticalListSortingStrategy}>
              <Stack>
                {state[category].map((item) => (
                  <SortableItem key={item.symbol} item={item} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>
        ))}
      </Stack>

      <DragOverlay>
        {activeItem ? <SortableItem item={activeItem} /> : undefined}
      </DragOverlay>
    </DndContext>
  );
}

function checkForDuplicatePair(answer: Record<string, string>, targetPairId: string): boolean {
  const pairMap: Record<string, Set<string>> = {};

  Object.entries(answer).forEach(([itemId, location]) => {
    const match = location.match(/^pair-(\d+)-(high|low)$/);
    if (match) {
      const pairId = match[1];
      const baseItemId = itemId.split('_')[0];
      if (!pairMap[pairId]) pairMap[pairId] = new Set();
      pairMap[pairId].add(baseItemId);
    }
  });

  const targetPairSignature = [...(pairMap[targetPairId] || [])].sort().join('|');
  if (!targetPairSignature) return false;

  return Object.entries(pairMap).some(([pairId, itemSet]) => pairId !== targetPairId && [...itemSet].sort().join('|') === targetPairSignature);
}

function RankingPairwiseComponent({
  options, disabled, answer, responseId, setError,
}: {
  options: (StringOption | string)[];
  disabled?: boolean;
  answer: { value: Record<string, string> };
  responseId: string;
  setError?: (error: string | null) => void;
}) {
  const { onChange } = answer as { onChange?: (value: Record<string, string>) => void };
  const { sensors, updateAnswer } = useRankingLogic(responseId, onChange);
  const items = useMemo(() => createItems(options), [options]);
  const [pairIds, setPairIds] = useState<string[]>(['0']);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [instanceCounter, setInstanceCounter] = useState(0);
  const [nextPairId, setNextPairId] = useState(1);

  const { pairs, unassigned } = useMemo(() => {
    const pairMap: Record<string, { high: string[], low: string[] }> = {};

    Object.entries(answer?.value || {}).forEach(([itemId, location]) => {
      const match = location.match(/^pair-(\d+)-(high|low)$/);
      if (match) {
        const [, pairId, position] = match;
        if (!pairMap[pairId]) pairMap[pairId] = { high: [], low: [] };
        pairMap[pairId][position as 'high' | 'low'].push(itemId);
      }
    });

    pairIds.forEach((pairId) => {
      if (!pairMap[pairId]) pairMap[pairId] = { high: [], low: [] };
    });

    return { pairs: pairMap, unassigned: items };
  }, [items, answer, pairIds]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (disabled || !event.over) return;

    const draggedId = event.active.id as string;
    const targetId = event.over.id as string;
    const newAnswer = { ...answer.value };

    if (targetId === 'unassigned') {
      delete newAnswer[draggedId];
      setError?.(null);
      updateAnswer(newAnswer);
      return;
    }

    const isFromUnassigned = !draggedId.includes('_');
    const baseItemId = isFromUnassigned ? draggedId : draggedId.split('_')[0];
    const targetMatch = targetId.match(/^pair-(\d+)-(high|low)$/);

    if (targetMatch) {
      const [, targetPairId, targetPosition] = targetMatch;

      const currentItemsInPosition = Object.entries(newAnswer).filter(
        ([instId, loc]) => loc === targetId && instId !== draggedId,
      ).length;

      if (currentItemsInPosition >= 1) {
        setError?.('You can only place one item in each box.');
        return;
      }

      const oppositePosition = targetPosition === 'high' ? 'low' : 'high';
      const oppositeLocationId = `pair-${targetPairId}-${oppositePosition}`;

      const existingInOpposite = Object.entries(newAnswer).some(([instId, loc]) => {
        const existingBaseId = instId.split('_')[0];
        return loc === oppositeLocationId && existingBaseId === baseItemId;
      });

      if (existingInOpposite) {
        const itemLabel = items.find((i) => i.id === baseItemId)?.label;
        setError?.(`Item "${itemLabel}" cannot be in both HIGH and LOW.`);
        return;
      }

      if (isFromUnassigned) {
        const tempAnswer = { ...newAnswer, [`${draggedId}_temp`]: targetId };
        if (checkForDuplicatePair(tempAnswer, targetPairId)) {
          setError?.('This would create a duplicate pair.');
          return;
        }
      }
    }

    if (isFromUnassigned) {
      newAnswer[`${draggedId}_${instanceCounter}`] = targetId;
      setInstanceCounter((c) => c + 1);
    } else {
      delete newAnswer[draggedId];
      newAnswer[draggedId] = targetId;
    }

    setError?.(null);
    updateAnswer(newAnswer);
  };

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    const baseItemId = activeId.includes('_') ? activeId.split('_')[0] : activeId;
    return items.find((i) => i.id === baseItemId) || null;
  }, [activeId, items]);

  const handleRemovePair = (pairId: string) => {
    if (disabled) return;

    const newAnswer = { ...answer.value };
    Object.keys(newAnswer).forEach((key) => {
      if (newAnswer[key].startsWith(`pair-${pairId}-`)) {
        delete newAnswer[key];
      }
    });

    setPairIds((prev) => prev.filter((id) => id !== pairId));
    setError?.(null);
    updateAnswer(newAnswer);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={rectIntersection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Flex justify="flex-end" mb="md">
        <Button
          variant="outline"
          onClick={() => {
            if (!disabled) {
              setPairIds((prev) => [...prev, nextPairId.toString()]);
              setNextPairId((prev) => prev + 1);
            }
          }}
        >
          Add New Pair
        </Button>
      </Flex>

      <Stack gap="md" w="650px" mx="auto">
        {Object.entries(pairs).map(([pairId, pair]) => (
          <Group key={pairId} justify="center" wrap="nowrap" align="flex">
            {(['high', 'low'] as const).map((position) => (
              <Box key={position} style={{ width: '300px' }}>
                <DroppableZone id={`pair-${pairId}-${position}`} title={position.toUpperCase()}>
                  <SortableContext
                    items={pair[position]}
                    strategy={verticalListSortingStrategy}
                  >
                    <Stack>
                      {pair[position].map((instanceId) => {
                        const baseItemId = instanceId.split('_')[0];
                        const item = items.find((i) => i.id === baseItemId);
                        return item ? (
                          <SortableItem
                            key={instanceId}
                            item={{ ...item, id: baseItemId, symbol: instanceId }}
                          />
                        ) : null;
                      })}
                    </Stack>
                  </SortableContext>
                </DroppableZone>
              </Box>
            ))}
            <Button
              variant="white"
              color="red"
              size="xs"
              onClick={() => handleRemovePair(pairId)}
              disabled={disabled}
            >
              X
            </Button>
          </Group>
        ))}

        <DroppableZone id="unassigned" title="Available Items">
          <SortableContext items={unassigned.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <Stack>
              {unassigned.map((item) => (
                <SortableItem key={item.id} item={item} />
              ))}
            </Stack>
          </SortableContext>
        </DroppableZone>
      </Stack>

      <DragOverlay>
        {activeItem ? <SortableItem item={activeItem} /> : undefined}
      </DragOverlay>
    </DndContext>
  );
}

export function RankingInput({
  response,
  answer,
  index: idx,
  disabled,
  enumerateQuestions,
}: {
  response: RankingResponse;
  answer: { value: Record<string, string> };
  index: number;
  disabled: boolean;
  enumerateQuestions: boolean;
}) {
  const {
    prompt,
    required,
    options,
    secondaryText,
    infoText,
    numItems,
  } = response;

  const [error, setError] = useState<string | null>(null);

  const componentProps = {
    disabled, options, answer, responseId: response.id, numItems,
  };

  return (
    <Box>
      {prompt.length > 0 && (
        <InputLabel prompt={prompt} required={required} index={idx} enumerateQuestions={enumerateQuestions} infoText={infoText} />
      )}
      {secondaryText && <Text c="dimmed" size="sm" mt={0}>{secondaryText}</Text>}
      {error && (
        <Text c={required ? 'red' : 'orange'} size="sm" mt="xs">
          {error}
        </Text>
      )}
      <Box mt="md">
        {response.type === 'ranking-sublist' && <RankingSublistComponent {...componentProps} setError={setError} />}
        {response.type === 'ranking-categorical' && <RankingCategoricalComponent {...componentProps} setError={setError} />}
        {response.type === 'ranking-pairwise' && <RankingPairwiseComponent {...componentProps} setError={setError} />}
      </Box>
    </Box>
  );
}
