import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Button,
  Flex,
  Group,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import {
  useMemo, useState, useEffect, useRef,
} from 'react';
import { RankingResponse, StringOption } from '../../parser/types';
import { useStoreActions, useStoreDispatch } from '../../store/store';

interface ItemProps {
  item: {
    id: string;
    label: string;
  };
  index?: number;
}
function SortableItem({ item, index }: ItemProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition,
  } = useSortable({
    id: item.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      withBorder
      p="sm"
    >
      <Flex align="center" gap="sm">
        {index !== undefined && <Text c="dimmed">{index}</Text>}
        <Text>{item.label}</Text>
      </Flex>
    </Paper>
  );
}

function DroppableZone({
  id,
  children,
  title,
}: {
  id: string;
  children: React.ReactNode;
  title: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <Paper
      withBorder
      p="sm"
      ref={setNodeRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        backgroundColor: isOver ? '#f0f8ff' : undefined,
        borderColor: isOver ? '#4dabf7' : undefined,
      }}
    >
      <Text size="md" fw={500} ta="center" mb="xs">{title}</Text>
      {children}
    </Paper>
  );
}

function RankingSublistComponent({
  options,
  disabled,
  index: _index,
  enumerateQuestions,
  prompt,
  required: _required,
  secondaryText,
  answer,
  responseId,
  numItems,
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  index: number;
  enumerateQuestions: boolean;
  prompt?: string;
  required?: boolean;
  secondaryText?: string;
  answer: { value: Record<string, string> };
  responseId: string;
  numItems?: number;
}) {
  const { onChange } = (answer as { onChange?: (value: Record<string, string>) => void });
  const { setRankingAnswers } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const _choices: { id: string; label: string }[] = useMemo(
    () => options.map((option) => ({
      id: typeof option === 'string' ? option : option.value,
      label: typeof option === 'string' ? option : option.label,
    })),
    [options],
  );

  const initialState = useMemo(() => {
    let selected: { id: string; label: string }[] = [];
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

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const inSelected = state.selected.findIndex((i) => i.id === active.id) !== -1;
    const inUnassigned = state.unassigned.findIndex((i) => i.id === active.id) !== -1;
    const overId = over.id as string;
    const overInSelected = overId === 'sublist-selected' || state.selected.findIndex((i) => i.id === overId) !== -1;
    const overInUnassigned = overId === 'sublist-unassigned' || state.unassigned.findIndex((i) => i.id === overId) !== -1;

    if (inSelected && overInSelected) {
      const oldIndex = state.selected.findIndex((i) => i.id === active.id);
      const newIndex = state.selected.findIndex((i) => i.id === (over.id as string));
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
      const moved = state.unassigned.find((i) => i.id === active.id)!;
      const newUnassigned = state.unassigned.filter((i) => i.id !== active.id);
      const newSelected = [...state.selected, moved];
      setState({ selected: newSelected, unassigned: newUnassigned });
      const answerValue: Record<string, string> = {};
      newSelected.forEach((item, idx) => { answerValue[item.id] = idx.toString(); });
      onChange?.(answerValue);
      storeDispatch(setRankingAnswers({ responseId, values: answerValue }));
      return;
    }

    if (inSelected && (overInUnassigned || !overInSelected)) {
      const moved = state.selected.find((i) => i.id === active.id)!;
      const newSelected = state.selected.filter((i) => i.id !== active.id);
      const exists = state.unassigned.find((i) => i.id === moved.id);
      const newUnassigned = exists ? state.unassigned : [...state.unassigned, moved];
      setState({ selected: newSelected, unassigned: newUnassigned });
      const answerValue: Record<string, string> = {};
      newSelected.forEach((item, idx) => { answerValue[item.id] = idx.toString(); });
      onChange?.(answerValue);
      storeDispatch(setRankingAnswers({ responseId, values: answerValue }));
    }
  };

  return (
    <Box mb="lg" w="60%" mx="auto">
      {!enumerateQuestions && prompt && (
        <Text fw={500} mb="sm">
          {prompt}
        </Text>
      )}
      {secondaryText && (
        <Text size="sm" c="dimmed" mb="md">
          {secondaryText}
        </Text>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Box ta="center" mb="md">

          <DroppableZone id="sublist-selected" title="">
            <Text size="md" fw={500} m="md">HIGH</Text>
            <SortableContext items={state.selected.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack w="400px" mx="auto">
                {state.selected.map((item, index) => (
                  <SortableItem key={item.id} item={item} index={index + 1} />
                ))}
              </Stack>
            </SortableContext>
            <Text size="md" fw={500} m="md">LOW</Text>
          </DroppableZone>

        </Box>

        <DroppableZone id="sublist-unassigned" title="Available Items">
          <SortableContext items={state.unassigned.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <Flex gap="xs" wrap="wrap" justify="center" w="400px" mx="auto">
              {state.unassigned.map((item) => (
                <SortableItem key={item.id} item={item} />
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
  index,
  enumerateQuestions,
  prompt,
  required: _required,
  secondaryText,
  answer,
  responseId,
  numItems,
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  index: number;
  enumerateQuestions: boolean;
  prompt?: string;
  required?: boolean;
  secondaryText?: string;
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
  }[] = useMemo(() => options.map((option) => ({
    id: typeof option === 'string' ? option : option.value,
    label: typeof option === 'string' ? option : option.label,
  })), [options]);

  const initialState = useMemo(() => {
    const state = {
      unassigned: [...items],
      HIGH: [] as {
        id: string;
        label: string;
      }[],
      MEDIUM: [] as {
        id: string;
        label: string;
      }[],
      LOW: [] as {
        id: string;
        label: string;
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
  const [activeId, setActiveId] = useState<string | null>(null);

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
    <Box mb="lg">
      {enumerateQuestions && prompt && (
        <Text fw={500} mb="sm">
          {index + 1}
          .
          {prompt}
        </Text>
      )}
      {!enumerateQuestions && prompt && (
        <Text fw={500} mb="sm">
          {prompt}
        </Text>
      )}
      {secondaryText && (
        <Text size="sm" c="dimmed" mb="md">
          {secondaryText}
        </Text>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Stack gap="sm" w="600px" mx="auto">
          <DroppableZone id="HIGH" title="HIGH">
            <SortableContext items={state.HIGH.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack
                gap="xs"
                w="400px"
                mx="auto"
              >
                {state.HIGH.map((item, idx) => (
                  <SortableItem key={item.id} item={item} index={idx + 1} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="MEDIUM" title="MEDIUM">
            <SortableContext items={state.MEDIUM.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack
                gap="xs"
                w="400px"
                mx="auto"
              >
                {state.MEDIUM.map((item, idx) => (
                  <SortableItem key={item.id} item={item} index={idx + 1} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="LOW" title="LOW">
            <SortableContext items={state.LOW.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack
                gap="xs"
                w="400px"
                mx="auto"
              >
                {state.LOW.map((item, idx) => (
                  <SortableItem key={item.id} item={item} index={idx + 1} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="unassigned" title="Available Items">
            <SortableContext items={state.unassigned.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack
                gap="xs"
                w="400px"
                mx="auto"
              >
                {state.unassigned.map((item, idx) => (
                  <SortableItem key={item.id} item={item} index={idx + 1} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>
        </Stack>

        <DragOverlay>
          {activeId ? (
            <Paper
              p="sm"
              withBorder
            >
              <Text>
                {items.find((item) => item.id === activeId)?.label}
              </Text>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>
    </Box>
  );
}

function RankingPairwiseComponent({
  options,
  disabled,
  index,
  enumerateQuestions,
  prompt,
  required: _required,
  secondaryText,
  answer,
  responseId,
}: {
  options: (StringOption | string)[];
  disabled?: boolean;
  index: number;
  enumerateQuestions: boolean;
  prompt?: string;
  required?: boolean;
  secondaryText?: string;
  answer: { value: Record<string, string> };
  responseId: string;
}) {
  const { onChange } = (answer as { onChange?: (value: Record<string, string>) => void });
  const { setRankingAnswers } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const itemList: {
    id: string;
    label: string;
  }[] = useMemo(() => options.map((option) => ({
    id: typeof option === 'string' ? option : option.value,
    label: typeof option === 'string' ? option : option.label,
  })), [options]);

  const { initialState, initialPairCount } = useMemo(() => {
    const state: Record<string, {
      id: string;
      label: string;
    }[]> = {
      unassigned: [...itemList],
      'pair-0-high': [],
      'pair-0-low': [],
    };

    let pairCount = 1;

    if (answer?.value && Object.keys(answer.value).length > 0) {
      const pairKeys = new Set<string>();
      (Object.values(answer.value) as string[]).forEach((pairLocation) => {
        const match = pairLocation.match(/^pair-(\d+)-(high|low)$/);
        if (match) {
          pairKeys.add(match[1]);
        }
      });

      pairCount = Math.max(1, pairKeys.size);

      for (let i = 0; i < pairCount; i += 1) {
        state[`pair-${i}-high`] = [];
        state[`pair-${i}-low`] = [];
      }

      (Object.entries(answer.value) as [string, string][]).forEach(([itemId, pairLocation]) => {
        const item = itemList.find((i) => i.id === itemId);
        const key = pairLocation as keyof typeof state;
        if (item && state[key]) {
          state[key].push(item);
          state.unassigned = state.unassigned.filter((i) => i.id !== itemId);
        }
      });
    }

    return { initialState: state, initialPairCount: pairCount };
  }, [itemList, answer]);

  const [state, setState] = useState(initialState);
  const [_pairCount, setPairCount] = useState(initialPairCount);
  const [isAddingPair, setIsAddingPair] = useState(false);
  const addingPairRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      setState(initialState);
      setPairCount(initialPairCount);
      initializedRef.current = true;
    }
  }, [initialState, initialPairCount]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const targetCategory = over.id as string;

    let sourceCategory = '';
    for (const [category, categoryItems] of Object.entries(state)) {
      if (categoryItems.find((item) => item.id === activeId)) {
        sourceCategory = category;
        break;
      }
    }

    if (sourceCategory && targetCategory && sourceCategory !== targetCategory) {
      if (Object.keys(state).includes(targetCategory)) {
        setState((prev) => {
          const newState = { ...prev };
          const sourceArr = newState[sourceCategory as keyof typeof newState] as { id: string; label: string }[];
          const targetArr = newState[targetCategory as keyof typeof newState] as { id: string; label: string }[];
          const activeItem = sourceArr.find((item) => item.id === activeId);

          if (activeItem) {
            if (sourceCategory === 'unassigned' && targetCategory !== 'unassigned') {
              newState.unassigned = newState.unassigned.filter((i) => i.id !== activeItem.id);
              if (targetArr.length > 0) {
                const itemsToReturn = targetArr.filter((i) => !newState.unassigned.find((u) => u.id === i.id));
                newState.unassigned = [...newState.unassigned, ...itemsToReturn];
              }
              newState[targetCategory as keyof typeof newState] = [activeItem];
            } else {
              newState[sourceCategory as keyof typeof newState] = sourceArr.filter((item) => item.id !== activeId);

              if (targetCategory !== 'unassigned') {
                const itemsToReturn = targetArr.filter((i) => !newState.unassigned.find((u) => u.id === i.id));
                if (itemsToReturn.length > 0) {
                  newState.unassigned = [...newState.unassigned, ...itemsToReturn];
                }
                newState[targetCategory as keyof typeof newState] = [activeItem];
              } else if (!newState.unassigned.find((u) => u.id === activeItem.id)) {
                newState.unassigned = [...targetArr, activeItem];
              } else {
                newState.unassigned = [...targetArr];
              }
            }
          }

          if (Array.isArray(newState.unassigned)) {
            const seen = new Set<string>();
            newState.unassigned = newState.unassigned.filter((it) => {
              if (seen.has(it.id)) return false;
              seen.add(it.id);
              return true;
            });
          }

          const answerValue: Record<string, string> = {};
          const entries = Object.entries(newState) as Array<[string, { id: string; label: string }[]]>;
          entries.forEach(([category, categoryItems]) => {
            if (category !== 'unassigned') {
              categoryItems.forEach((item) => {
                answerValue[item.id] = category;
              });
            }
          });
          onChange?.(answerValue);
          storeDispatch(setRankingAnswers({ responseId, values: answerValue }));

          return newState;
        });
      }
    }
  };

  const addNewPair = () => {
    if (disabled || addingPairRef.current) return;
    addingPairRef.current = true;

    setState((prev) => {
      const pairIndices = Object.keys(prev)
        .map((k) => {
          const m = k.match(/^pair-(\d+)-(high|low)$/);
          return m ? parseInt(m[1], 10) : null;
        })
        .filter((v): v is number => v !== null);
      const nextIndex = pairIndices.length > 0 ? Math.max(...pairIndices) + 1 : 0;

      const nextState = {
        ...prev,
        [`pair-${nextIndex}-high`]: [],
        [`pair-${nextIndex}-low`]: [],
      };

      return nextState;
    });

    setTimeout(() => {
      addingPairRef.current = false;
      setIsAddingPair(false);
    }, 0);
  };

  useEffect(() => {
    if (isAddingPair) {
      const answerValue: Record<string, string> = {};
      Object.entries(state).forEach(([category, categoryItems]) => {
        if (category !== 'unassigned') {
          categoryItems.forEach((item) => {
            answerValue[item.id] = category;
          });
        }
      });

      onChange?.(answerValue);
      storeDispatch(setRankingAnswers({ responseId, values: answerValue }));

      setIsAddingPair(false);
      addingPairRef.current = false;
    }
  }, [state, isAddingPair, answer, responseId, onChange, storeDispatch, setRankingAnswers]);

  const getPairs = () => {
    const pairs = [];
    const pairKeys = Object.keys(state).filter((key) => key.startsWith('pair-') && key.endsWith('-high'));
    const actualPairCount = pairKeys.length;

    for (let i = 0; i < actualPairCount; i += 1) {
      pairs.push({
        index: i,
        high: state[`pair-${i}-high` as keyof typeof state] || [],
        low: state[`pair-${i}-low` as keyof typeof state] || [],
      });
    }
    return pairs;
  };

  return (
    <Box mb="lg">
      {enumerateQuestions && prompt && (
        <Text fw={500} mb="sm">
          {index + 1}
          .
          {prompt}
        </Text>
      )}
      {!enumerateQuestions && prompt && (
        <Text fw={500} mb="sm">
          {prompt}
        </Text>
      )}
      {secondaryText && (
        <Text size="sm" c="dimmed" mb="md">
          {secondaryText}
        </Text>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>

        <Button
          variant="filled"
          color="orange"
          onClick={addNewPair}
        >
          Add New Pair
        </Button>

        <Stack gap="md" w="800px" mx="auto">
          {getPairs().map((pair) => (
            <Stack key={`pair-${pair.index}`} gap="sm" w="100%">
              <Group justify="center" gap="md" wrap="nowrap" w="100%">
                <DroppableZone id={`pair-${pair.index}-high`} title="HIGH">
                  <SortableContext items={pair.high.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs" w="300px" mx="auto">
                      {pair.high.map((item) => (
                        <SortableItem key={item.id} item={item} />
                      ))}
                    </Stack>
                  </SortableContext>
                </DroppableZone>

                <DroppableZone id={`pair-${pair.index}-low`} title="LOW">
                  <SortableContext items={pair.low.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs" w="300px" mx="auto">
                      {pair.low.map((item) => (
                        <SortableItem key={item.id} item={item} />
                      ))}
                    </Stack>
                  </SortableContext>
                </DroppableZone>
              </Group>
            </Stack>
          ))}

          <DroppableZone id="unassigned" title="Available Items">
            <SortableContext items={state.unassigned.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Flex gap="xs" wrap="wrap" justify="center" w="300px" mx="auto">
                {state.unassigned.map((item) => (
                  <SortableItem key={item.id} item={item} />
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
  disabled,
  answer,
  index,
  enumerateQuestions,
}: {
  response: RankingResponse;
  disabled: boolean;
  answer: { value: Record<string, string> };
  index: number;
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
      <RankingSublistComponent
        options={options}
        disabled={disabled}
        index={index}
        answer={answer}
        enumerateQuestions={enumerateQuestions}
        prompt={prompt}
        required={required}
        secondaryText={secondaryText}
        responseId={response.id}
        numItems={numItems}
      />
    );
  }

  if (response.type === 'ranking-categorical') {
    return (
      <RankingCategoricalComponent
        options={options}
        disabled={disabled}
        index={index}
        answer={answer}
        required={required}
        enumerateQuestions={enumerateQuestions}
        prompt={prompt}
        secondaryText={secondaryText}
        responseId={response.id}
        numItems={numItems}
      />
    );
  }

  if (response.type === 'ranking-pairwise') {
    return (
      <RankingPairwiseComponent
        options={options}
        disabled={disabled}
        index={index}
        answer={answer}
        enumerateQuestions={enumerateQuestions}
        prompt={prompt}
        required={required}
        secondaryText={secondaryText}
        responseId={response.id}
      />
    );
  }

  return null;
}
