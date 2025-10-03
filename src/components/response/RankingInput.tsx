import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
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
      style={style}
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
  options, responseId, answer, disabled, numItems,
}: {
  options: (StringOption | string)[];
  responseId: string;
  answer: { value: Record<string, string> };
  disabled: boolean;
  numItems?: number;
}) {
  const { onChange } = answer as { onChange?: (value: Record<string, string>) => void };
  const { sensors, updateAnswer } = useRankingLogic(responseId, onChange);
  const items = useMemo(() => createItems(options), [options]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const fromSelected = state.selected.find((i) => i.symbol === activeId);
    const fromUnassigned = state.unassigned.find((i) => i.symbol === activeId);
    const toSelected = overId === 'selected' || state.selected.find((i) => i.symbol === overId);
    const toUnassigned = overId === 'unassigned';

    const newState = { ...state };

    if (fromSelected && toSelected) {
      const oldIndex = state.selected.findIndex((i) => i.symbol === activeId);
      const newIndex = overId === 'selected' ? state.selected.length - 1 : state.selected.findIndex((i) => i.symbol === overId);
      newState.selected = arrayMove(state.selected, oldIndex, newIndex);
    } else if (fromUnassigned && toSelected) {
      if (numItems && state.selected.length >= numItems) return;
      newState.unassigned = state.unassigned.filter((i) => i.symbol !== activeId);
      newState.selected = [...state.selected, fromUnassigned];
    } else if (fromSelected && toUnassigned) {
      newState.selected = state.selected.filter((i) => i.symbol !== activeId);
      newState.unassigned = [...state.unassigned, fromSelected];
    } else return;

    setState(newState);
    const answerValue: Record<string, string> = {};
    newState.selected.forEach((item, idx) => { answerValue[item.id] = idx.toString(); });
    updateAnswer(answerValue);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Stack gap="md" maw="600px" mx="auto">
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
    </DndContext>
  );
}

function RankingCategoricalComponent({
  options, disabled, answer, responseId, numItems,
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  answer: { value: Record<string, string> };
  responseId: string;
  numItems?: number;
}) {
  const { onChange } = answer as { onChange?: (value: Record<string, string>) => void };
  const { sensors, updateAnswer } = useRankingLogic(responseId, onChange);
  const items = useMemo(() => createItems(options), [options]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const targetCategory = over.id as string;
    const sourceCategory = Object.keys(state).find((cat) => state[cat as keyof typeof state].find((item: Item) => item.id === itemId));

    if (!sourceCategory || sourceCategory === targetCategory) return;
    if (!['unassigned', 'HIGH', 'MEDIUM', 'LOW'].includes(targetCategory)) return;

    setState((prev) => {
      const item = prev[sourceCategory as keyof typeof prev].find((i: Item) => i.id === itemId);
      if (!item) return prev;

      if (targetCategory !== 'unassigned' && numItems
          && (prev[targetCategory as keyof typeof prev] as Item[]).length >= numItems) return prev;

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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Stack gap="md" maw="600px" mx="auto">
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
    </DndContext>
  );
}

function RankingPairwiseComponent({
  options, disabled, answer, responseId,
}: {
  options: (StringOption | string)[];
  disabled?: boolean;
  answer: { value: Record<string, string> };
  responseId: string;
}) {
  const { onChange } = answer as { onChange?: (value: Record<string, string>) => void };
  const { sensors, updateAnswer } = useRankingLogic(responseId, onChange);
  const items = useMemo(() => createItems(options), [options]);
  const [pairCount, setPairCount] = useState(1);

  const { pairs, unassigned } = useMemo(() => {
    const pairMap: Record<string, { high: string[], low: string[] }> = {};
    const assigned = new Set<string>();

    Object.entries(answer?.value || {}).forEach(([itemId, location]) => {
      const match = location.match(/^pair-(\d+)-(high|low)$/);
      if (match) {
        const [, pairId, position] = match;
        if (!pairMap[pairId]) pairMap[pairId] = { high: [], low: [] };
        pairMap[pairId][position as 'high' | 'low'].push(itemId);
        assigned.add(itemId);
      }
    });

    for (let i = 0; i < pairCount; i += 1) {
      if (!pairMap[i.toString()]) pairMap[i.toString()] = { high: [], low: [] };
    }

    return { pairs: pairMap, unassigned: items.filter((item) => !assigned.has(item.id)) };
  }, [items, answer, pairCount]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const targetId = over.id as string;
    const newAnswer = { ...answer.value };

    if (targetId === 'unassigned') {
      delete newAnswer[itemId];
    } else {
      newAnswer[itemId] = targetId;
    }

    updateAnswer(newAnswer);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Flex justify="flex-end" mb="md">
        <Button variant="outline" onClick={() => !disabled && setPairCount((p) => p + 1)}>
          Add New Pair
        </Button>
      </Flex>

      <Stack gap="md" maw="600px" mx="auto">
        {Object.entries(pairs).map(([pairId, pair]) => (
          <Group key={pairId} justify="center" gap="md" wrap="wrap">
            {(['high', 'low'] as const).map((position) => (
              <DroppableZone key={position} id={`pair-${pairId}-${position}`} title={position.toUpperCase()}>
                <SortableContext items={pair[position]} strategy={verticalListSortingStrategy}>
                  <Stack gap="md">
                    {pair[position].map((itemId) => {
                      const item = items.find((i) => i.id === itemId);
                      return item ? <SortableItem key={itemId} item={item} /> : null;
                    })}
                  </Stack>
                </SortableContext>
              </DroppableZone>
            ))}
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
    prompt, required, options, secondaryText, numItems,
  } = response;
  const componentProps = {
    disabled, options, answer, responseId: response.id, numItems,
  };

  return (
    <Box>
      {prompt.length > 0 && (
        <InputLabel prompt={prompt} required={required} index={idx} enumerateQuestions={enumerateQuestions} />
      )}
      {secondaryText && <Text c="dimmed" size="sm" mt={0}>{secondaryText}</Text>}
      <Box mt="md">
        {response.type === 'ranking-sublist' && <RankingSublistComponent {...componentProps} />}
        {response.type === 'ranking-categorical' && <RankingCategoricalComponent {...componentProps} />}
        {response.type === 'ranking-pairwise' && <RankingPairwiseComponent {...componentProps} />}
      </Box>
    </Box>
  );
}
