import {
  closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import cx from 'clsx';
import {
  Box, Button, Flex, Group, Paper, Stack, Text,
} from '@mantine/core';
import {
  useMemo, useState, useEffect, useRef,
} from 'react';
import { InputLabel } from './InputLabel';
import classes from './css/RankingDnd.module.css';
import { RankingResponse, StringOption } from '../../parser/types';
import { useStoreActions, useStoreDispatch } from '../../store/store';

interface ItemProps {
  item: string;
  index?: number;
}

function SortableItem({ item, index }: ItemProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({
    id: item,
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
      {index !== undefined && (
        <Text c="dimmed" mr="sm">{index}</Text>
      )}
      <Text>{item}</Text>
    </Paper>
  );
}

function DroppableZone({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <Paper
      ref={setNodeRef}
      style={{
        // If item is over the droppable zone, change the background and border color to blue
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

function RankingSublistComponent({
  options,
  responseId,
  numItems,
  answer,
  disabled,
}: {
  options: (StringOption | string)[];
  responseId: string;
  numItems?: number;
  answer: { value: Record<string, string> };
  disabled: boolean;
}) {
  const { onChange } = (answer as { onChange?: (value: Record<string, string>) => void });
  const { setRankingAnswers } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const _choices: { id: string; label: string; symbol: string }[] = useMemo(
    () => options.map((option) => ({
      id: typeof option === 'string' ? option : option.value,
      label: typeof option === 'string' ? option : option.label,
      symbol: typeof option === 'string' ? option : option.value,
    })),
    [options],
  );

  const initialState = useMemo(() => {
    let selected: { id: string; label: string; symbol: string }[] = [];
    if (answer?.value && Object.keys(answer.value).length > 0) {
      const answerEntries = (Object.entries(answer.value) as [string, string][])
        .sort((a, b) => parseInt(a[1], 10) - parseInt(b[1], 10));
      for (const [itemId] of answerEntries) {
        const found = _choices.find((i) => i.id === itemId);
        if (found) selected.push(found);
      }
    }
    if (typeof numItems === 'number' && numItems > 0 && selected.length > numItems) {
      selected = selected.slice(0, numItems);
    }
    const unassigned = _choices.filter((i) => !selected.find((s) => s.id === i.id));
    return { selected, unassigned };
  }, [_choices, answer, numItems]);

  const [state, setState] = useState(initialState);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      setState(initialState);
      initializedRef.current = true;
    }
  }, [initialState]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const inSelected = state.selected.findIndex((i) => i.symbol === active.id) !== -1;
    const inUnassigned = state.unassigned.findIndex((i) => i.symbol === active.id) !== -1;
    const overId = over.id as string;
    const overInSelected = overId === 'sublist-selected' || state.selected.findIndex((i) => i.symbol === overId) !== -1;
    const overInUnassigned = overId === 'sublist-unassigned' || state.unassigned.findIndex((i) => i.symbol === overId) !== -1;

    if (inSelected && overInSelected) {
      const oldIndex = state.selected.findIndex((i) => i.symbol === active.id);
      let newIndex = state.selected.findIndex((i) => i.symbol === (over.id as string));
      if (over.id === 'sublist-selected' || newIndex === -1) {
        newIndex = state.selected.length - 1;
      }
      const newSelected = arrayMove(state.selected, oldIndex, newIndex);
      setState({ ...state, selected: newSelected });
      const answerValue: Record<string, string> = {};
      newSelected.forEach((item, idx) => { answerValue[item.id] = idx.toString(); });
      onChange?.(answerValue);
      storeDispatch(setRankingAnswers({ responseId, values: answerValue }));
      return;
    }

    if (inUnassigned && (overInSelected || !overInUnassigned)) {
      if (typeof numItems === 'number' && numItems > 0 && state.selected.length >= numItems) {
        return;
      }
      const moved = state.unassigned.find((i) => i.symbol === active.id)!;
      const newUnassigned = state.unassigned.filter((i) => i.symbol !== active.id);
      const newSelected = [...state.selected, moved];
      setState({ selected: newSelected, unassigned: newUnassigned });
      const answerValue: Record<string, string> = {};
      newSelected.forEach((item, idx) => { answerValue[item.id] = idx.toString(); });
      onChange?.(answerValue);
      storeDispatch(setRankingAnswers({ responseId, values: answerValue }));
      return;
    }

    if (inSelected && (overInUnassigned || !overInSelected)) {
      const moved = state.selected.find((i) => i.symbol === active.id)!;
      const newSelected = state.selected.filter((i) => i.symbol !== active.id);
      const exists = state.unassigned.find((i) => i.symbol === moved.symbol);
      const newUnassigned = exists ? state.unassigned : [...state.unassigned, moved];
      setState({ selected: newSelected, unassigned: newUnassigned });
      const answerValue: Record<string, string> = {};
      newSelected.forEach((item, idx) => { answerValue[item.id] = idx.toString(); });
      onChange?.(answerValue);
      storeDispatch(setRankingAnswers({ responseId, values: answerValue }));
    }
  };

  return (
    <Box p="sm" maw="600px" mx="auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <DroppableZone id="sublist" title="">
          <Text size="md" fw={500} m="md" ta="center">HIGH</Text>
          <SortableContext items={state.selected.map((i) => i.symbol)} strategy={verticalListSortingStrategy}>
            <Stack w="100%" maw="400px" mx="auto">
              {state.selected.map((item, index) => (
                <SortableItem key={item.symbol} item={item.symbol} index={index + 1} />
              ))}
            </Stack>
          </SortableContext>
          <Text size="md" fw={500} m="md" ta="center">LOW</Text>
        </DroppableZone>

        <DroppableZone id="sublist-unassigned" title="Available Items">
          <SortableContext items={state.unassigned.map((i) => i.symbol)} strategy={verticalListSortingStrategy}>
            <Flex gap="xs" wrap="wrap" justify="center" w="100%" maw="400px" mx="auto">
              {state.unassigned.map((item) => (
                <SortableItem key={item.symbol} item={item.symbol} />
              ))}
            </Flex>
          </SortableContext>
        </DroppableZone>
      </DndContext>
    </Box>
  );
}

function RankingCategoricalComponent({
  options,
  disabled,
  answer,
  responseId,
  numItems,
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  answer: { value: Record<string, string> };
  responseId: string;
  numItems?: number;
}) {
  const { onChange } = (answer as { onChange?: (value: Record<string, string>) => void });
  const { setRankingAnswers } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const items: {
    id: string;
    label: string;
    symbol: string;
  }[] = useMemo(() => options.map((option) => ({
    id: typeof option === 'string' ? option : option.value,
    label: typeof option === 'string' ? option : option.label,
    symbol: typeof option === 'string' ? option : option.value,
  })), [options]);

  const initialState = useMemo(() => {
    const state = {
      unassigned: [...items],
      HIGH: [] as {
        id: string;
        label: string;
        symbol: string;
      }[],
      MEDIUM: [] as {
        id: string;
        label: string;
        symbol: string;
      }[],
      LOW: [] as {
        id: string;
        label: string;
        symbol: string;
      }[],
    };

    if (answer?.value && Object.keys(answer.value).length > 0) {
      (Object.entries(answer.value) as [string, string][]).forEach(([itemId, category]) => {
        const item = items.find((i) => i.id === itemId);
        if (item && (category === 'HIGH' || category === 'MEDIUM' || category === 'LOW')) {
          state[category].push(item);
          state.unassigned = state.unassigned.filter((i) => i.id !== itemId);
        }
      });
    }

    return state;
  }, [items, answer]);

  const [state, setState] = useState(initialState);
  const [_activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    if (disabled) return;

    const { active, over } = event;
    if (!over) return;

    const draggedItemId = active.id as string;
    const targetCategory = over.id as string;

    let sourceCategory = '';
    if (state.unassigned.find((item) => item.id === draggedItemId)) sourceCategory = 'unassigned';
    if (state.HIGH.find((item) => item.id === draggedItemId)) sourceCategory = 'HIGH';
    if (state.MEDIUM.find((item) => item.id === draggedItemId)) sourceCategory = 'MEDIUM';
    if (state.LOW.find((item) => item.id === draggedItemId)) sourceCategory = 'LOW';

    if (sourceCategory && targetCategory && sourceCategory !== targetCategory) {
      if (['unassigned', 'HIGH', 'MEDIUM', 'LOW'].includes(targetCategory)) {
        setState((prev) => {
          const newState = { ...prev };
          const activeItem = newState[sourceCategory as keyof typeof newState].find((item) => item.id === draggedItemId);

          if (activeItem) {
            if (targetCategory !== 'unassigned' && typeof numItems === 'number' && numItems > 0 && (newState[targetCategory as keyof typeof newState] as typeof newState.HIGH).length >= numItems) {
              return prev;
            }
            newState[sourceCategory as keyof typeof newState] = newState[sourceCategory as keyof typeof newState].filter((item) => item.id !== draggedItemId);
            newState[targetCategory as keyof typeof newState] = [...(newState[targetCategory as keyof typeof newState] as typeof newState.HIGH), activeItem];
          }

          const answerValue: Record<string, string> = {};
          ['HIGH', 'MEDIUM', 'LOW'].forEach((category) => {
            (newState[category as keyof typeof newState] as typeof newState.HIGH).forEach((item) => {
              answerValue[item.id] = category;
            });
          });

          onChange?.(answerValue);
          storeDispatch(setRankingAnswers({ responseId, values: answerValue }));

          return newState;
        });
      }
    }
  };

  return (
    <Box>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Stack gap="sm" w="100%" maw="600px" mx="auto">
          <DroppableZone id="HIGH" title="HIGH">
            <SortableContext items={state.HIGH.map((i) => i.symbol)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs" w="100%" maw="400px" mx="auto">
                {state.HIGH.map((item) => (
                  <SortableItem key={item.symbol} item={item.symbol} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="MEDIUM" title="MEDIUM">
            <SortableContext items={state.MEDIUM.map((i) => i.symbol)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs" w="100%" maw="400px" mx="auto">
                {state.MEDIUM.map((item) => (
                  <SortableItem key={item.symbol} item={item.symbol} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="LOW" title="LOW">
            <SortableContext items={state.LOW.map((i) => i.symbol)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs" w="100%" maw="400px" mx="auto">
                {state.LOW.map((item) => (
                  <SortableItem key={item.symbol} item={item.symbol} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="unassigned" title="Available Items">
            <SortableContext items={state.unassigned.map((i) => i.symbol)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs" w="100%" maw="400px" mx="auto">
                {state.unassigned.map((item) => (
                  <SortableItem key={item.symbol} item={item.symbol} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>
        </Stack>
      </DndContext>
    </Box>
  );
}

function RankingPairwiseComponent({
  options,
  disabled,
  answer,
  responseId,
}: {
  options: (StringOption | string)[];
  disabled?: boolean;
  answer: { value: Record<string, string> };
  responseId: string;
}) {
  const { onChange } = (answer as { onChange?: (value: Record<string, string>) => void });
  const { setRankingAnswers } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const items = useMemo(() => options.map((option) => ({
    id: typeof option === 'string' ? option : option.value,
    label: typeof option === 'string' ? option : option.label,
  })), [options]);

  const [pairCount, setPairCount] = useState(1);

  const pairs = useMemo(() => {
    const pairMap: Record<string, { high: string[], low: string[] }> = {};
    const assigned = new Set<string>();

    Object.entries(answer?.value || {}).forEach(([itemId, location]) => {
      const match = location.match(/^pair-(\d+)-(high|low)$/);
      if (match) {
        const pairId = match[1];
        const position = match[2] as 'high' | 'low';
        if (!pairMap[pairId]) pairMap[pairId] = { high: [], low: [] };
        pairMap[pairId][position].push(itemId);
        assigned.add(itemId);
      }
    });

    // Ensure we show the number of pairs requested
    for (let i = 0; i < pairCount; i += 1) {
      if (!pairMap[i.toString()]) {
        pairMap[i.toString()] = { high: [], low: [] };
      }
    }

    const unassigned = items.filter((item) => !assigned.has(item.id));
    return { pairMap, unassigned };
  }, [items, answer, pairCount]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

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

    onChange?.(newAnswer);
    storeDispatch(setRankingAnswers({ responseId, values: newAnswer }));
  };

  const addNewPair = () => {
    if (disabled) return;
    setPairCount((prev) => prev + 1);
  };

  return (
    <Box>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Flex justify="flex-end" m="sm">
          <Button variant="outline" onClick={addNewPair}>
            Add New Pair
          </Button>
        </Flex>

        <Stack gap="md" mx="auto">
          {Object.entries(pairs.pairMap).map(([pairId, pair]) => (
            <Stack key={`pair-${pairId}`} gap="sm">
              <Group justify="center" gap="md" wrap="wrap">
                <DroppableZone id={`pair-${pairId}-high`} title="HIGH">
                  <SortableContext items={pair.high} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs" maw="500px" mx="auto">
                      {pair.high.map((itemId) => {
                        const item = items.find((i) => i.id === itemId);
                        return item ? <SortableItem key={itemId} item={item.label} /> : null;
                      })}
                    </Stack>
                  </SortableContext>
                </DroppableZone>

                <DroppableZone id={`pair-${pairId}-low`} title="LOW">
                  <SortableContext items={pair.low} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs" mx="auto">
                      {pair.low.map((itemId) => {
                        const item = items.find((i) => i.id === itemId);
                        return item ? <SortableItem key={itemId} item={item.label} /> : null;
                      })}
                    </Stack>
                  </SortableContext>
                </DroppableZone>
              </Group>
            </Stack>
          ))}

          <DroppableZone id="unassigned" title="Available Items">
            <SortableContext items={pairs.unassigned.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Flex gap="xs" wrap="wrap" justify="center" mx="auto">
                {pairs.unassigned.map((item) => (
                  <SortableItem key={item.id} item={item.label} />
                ))}
              </Flex>
            </SortableContext>
          </DroppableZone>

        </Stack>
      </DndContext>
    </Box>
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
    numItems,
  } = response;

  if (response.type === 'ranking-sublist') {
    return (
      <Box>
        {prompt.length > 0 && (
          <InputLabel prompt={prompt} required={required} index={idx} enumerateQuestions={enumerateQuestions} />
        )}
        <Text c="dimmed" size="sm" mt={0}>{secondaryText}</Text>
        <RankingSublistComponent
          disabled={disabled}
          options={options}
          answer={answer}
          responseId={response.id}
          numItems={numItems}
        />
      </Box>
    );
  }

  if (response.type === 'ranking-categorical') {
    return (
      <Box>
        {prompt.length > 0 && (
          <InputLabel prompt={prompt} required={required} index={idx} enumerateQuestions={enumerateQuestions} />
        )}
        <Text c="dimmed" size="sm" mt={0}>{secondaryText}</Text>
        <RankingCategoricalComponent
          disabled={disabled}
          options={options}
          answer={answer}
          responseId={response.id}
          numItems={numItems}
        />
      </Box>
    );
  }

  if (response.type === 'ranking-pairwise') {
    return (
      <Box>
        {prompt.length > 0 && (
          <InputLabel prompt={prompt} required={required} index={idx} enumerateQuestions={enumerateQuestions} />
        )}
        <Text c="dimmed" size="sm" mt={0}>{secondaryText}</Text>
        <RankingPairwiseComponent
          disabled={disabled}
          options={options}
          answer={answer}
          responseId={response.id}
        />
      </Box>
    );
  }

  return null;
}
