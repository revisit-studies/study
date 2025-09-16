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
import { useListState } from '@mantine/hooks';
import {
  useMemo, useState, useEffect, useRef,
} from 'react';
import { RankingResponse, StringOption } from '../../parser/types';

interface ItemProps {
  item: {
    id: string;
    label: string;
  };
  index: number;
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
        <Text c="dimmed">{index}</Text>
        <Text>{item.label}</Text>
      </Flex>
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
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  index: number;
  enumerateQuestions: boolean;
  prompt?: string;
  required?: boolean;
  secondaryText?: string;
  answer: { value: Record<string, string>; onChange?: (value: Record<string, string>) => void };
}) {
  const items: {
    id: string;
    label: string;
  }[] = useMemo(() => options.map((option) => ({
    id: typeof option === 'string' ? option : option.value,
    label: typeof option === 'string' ? option : option.label,
  })), [options]);

  // initialize state based on answer value
  const initialState = useMemo(() => {
    if (answer?.value && Object.keys(answer.value).length > 0) {
      const orderedItems = [];
      const answerEntries = Object.entries(answer.value).sort((a, b) => parseInt(a[1], 10) - parseInt(b[1], 10));
      for (const [itemId] of answerEntries) {
        const item = items.find((i) => i.id === itemId);
        if (item) {
          orderedItems.push(item);
        }
      }
      const remainingItems = items.filter((item) => !Object.keys(answer.value).includes(item.id));
      return [...orderedItems, ...remainingItems];
    }
    return items;
  }, [items, answer]);

  const [state, handlers] = useListState(initialState);

  useEffect(() => {
    handlers.setState(initialState);
  }, [initialState, handlers]);

  // Sensors are used to detect drag and drop events
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = state.findIndex((i) => i.id === active.id);
    const newIndex = state.findIndex((i) => i.id === over.id);

    const newState = arrayMove(state, oldIndex, newIndex);
    handlers.setState(newState);

    // update answer value
    const answerValue: Record<string, string> = {};
    newState.forEach((item, idx) => {
      answerValue[item.id] = idx.toString();
    });
    if (answer.onChange) {
      answer.onChange(answerValue);
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

      <Paper withBorder ta="center" p="md">
        {/* TODO: make this a label in types? */}
        <Text size="md" fw={500} m="md">
          HIGH
        </Text>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={state.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <Stack gap="xs" w="40%" mx="auto">
              {state.map((item, idx) => (
                <Flex key={item.id} align="center" gap="sm">
                  <Box style={{ flexGrow: 1 }}>
                    <SortableItem item={item} index={idx + 1} />
                  </Box>
                </Flex>
              ))}
            </Stack>
          </SortableContext>
        </DndContext>

        <Text size="md" fw={500} m="md">
          LOW
        </Text>
      </Paper>
    </Box>
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
      p="md"
      m="md"
      ref={setNodeRef}
      style={{
        backgroundColor: isOver ? '#f0f8ff' : undefined,
        borderColor: isOver ? '#4dabf7' : undefined,
      }}
    >
      <Text size="md" fw={500} ta="center" mb="md">{title}</Text>
      {children}
    </Paper>
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
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  index: number;
  enumerateQuestions: boolean;
  prompt?: string;
  required?: boolean;
  secondaryText?: string;
  answer: { value: Record<string, string>; onChange?: (value: Record<string, string>) => void };
}) {
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
      Object.entries(answer.value).forEach(([itemId, category]) => {
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
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
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
            newState[sourceCategory as keyof typeof newState] = newState[sourceCategory as keyof typeof newState].filter((item) => item.id !== draggedItemId);
            newState[targetCategory as keyof typeof newState] = [...newState[targetCategory as keyof typeof newState], activeItem];
          }

          const answerValue: Record<string, string> = {};
          ['HIGH', 'MEDIUM', 'LOW'].forEach((category) => {
            newState[category as keyof typeof newState].forEach((item) => {
              answerValue[item.id] = category;
            });
          });

          if (answer.onChange) {
            answer.onChange(answerValue);
          }

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
        <Stack gap="sm" w="60%" mx="auto">
          <DroppableZone id="HIGH" title="HIGH">
            <SortableContext items={state.HIGH.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack
                gap="xs"
                w="50%"
                mx="auto"
                miw={200}
                mih={80}
                justify="flex-start"
                style={{
                  transition: 'all 200ms ease',
                  minHeight: '80px',
                }}
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
                w="50%"
                mx="auto"
                miw={200}
                mih={80}
                justify="flex-start"
                style={{
                  transition: 'all 200ms ease',
                  minHeight: '80px',
                }}
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
                w="50%"
                mx="auto"
                miw={200}
                mih={80}
                justify="flex-start"
                style={{
                  transition: 'all 200ms ease',
                  minHeight: '80px',
                }}
              >
                {state.LOW.map((item, idx) => (
                  <SortableItem key={item.id} item={item} index={idx + 1} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="unassigned" title="Unassigned Items">
            <SortableContext items={state.unassigned.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack
                gap="xs"
                w="50%"
                mx="auto"
                miw={200}
                mih={80}
                justify="flex-start"
                style={{
                  transition: 'all 200ms ease',
                  minHeight: '80px',
                }}
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
              shadow="lg"
              style={{
                cursor: 'grabbing',
                opacity: 0.9,
              }}
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

type PairwiseItem = { id: string; label: string };

function RankingPairwiseComponent({
  options,
  disabled = false,
  index,
  enumerateQuestions,
  prompt,
  required: _required,
  secondaryText,
  answer,
}: {
  options: (StringOption | string)[];
  disabled?: boolean;
  index: number;
  enumerateQuestions: boolean;
  prompt?: string;
  required?: boolean;
  secondaryText?: string;
  answer: { value: Record<string, string>; onChange?: (value: Record<string, string>) => void };
}) {
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
      Object.values(answer.value).forEach((pairLocation) => {
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

      Object.entries(answer.value).forEach(([itemId, pairLocation]) => {
        const item = itemList.find((i) => i.id === itemId);
        if (item && state[pairLocation]) {
          state[pairLocation].push(item);
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
          const activeItem = newState[sourceCategory as keyof typeof newState].find((item) => item.id === activeId);

          if (activeItem) {
            newState[sourceCategory as keyof typeof newState] = newState[sourceCategory as keyof typeof newState].filter((item) => item.id !== activeId);

            if (targetCategory !== 'unassigned') {
              const existingItems = newState[targetCategory as keyof typeof newState];
              if (existingItems.length > 0) {
                newState.unassigned = [...newState.unassigned, ...existingItems];
              }
              newState[targetCategory as keyof typeof newState] = [activeItem];
            } else {
              newState[targetCategory as keyof typeof newState] = [...newState[targetCategory as keyof typeof newState], activeItem];
            }
          }

          if (answer.onChange) {
            const answerValue: Record<string, string> = {};
            const entries = Object.entries(newState) as Array<[string, PairwiseItem[]]>;
            entries.forEach(([category, categoryItems]) => {
              if (category !== 'unassigned') {
                categoryItems.forEach((item) => {
                  answerValue[item.id] = category;
                });
              }
            });
            setTimeout(() => answer.onChange!(answerValue), 0);
          }

          return newState;
        });
      }
    }
  };

  const addNewPair = () => {
    if (isAddingPair || disabled || addingPairRef.current) return;
    addingPairRef.current = true;
    setIsAddingPair(true);

    setState((prev) => {
      const nextIndex = Object.keys(prev).reduce((max, key) => {
        const m = key.match(/^pair-(\d+)-(high|low)$/);
        if (m) {
          const idx = parseInt(m[1], 10);
          return Math.max(max, idx + 1);
        }
        return max;
      }, 0);

      return {
        ...prev,
        [`pair-${nextIndex}-high`]: [],
        [`pair-${nextIndex}-low`]: [],
      };
    });
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

      if (answer.onChange) {
        answer.onChange(answerValue);
      }

      setIsAddingPair(false);
      addingPairRef.current = false;
    }
  }, [state, isAddingPair, answer]);

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
        <DroppableZone id="unassigned" title="Available Items">
          <SortableContext items={state.unassigned.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <Flex gap="xs" wrap="wrap" justify="center">
              {state.unassigned.map((item, idx) => (
                <SortableItem key={item.id} item={item} index={idx + 1} />
              ))}
            </Flex>
          </SortableContext>
        </DroppableZone>

        <Stack gap="md" w="80%" mx="auto">
          {getPairs().map((pair) => (
            <Stack key={`pair-${pair.index}`} gap="sm">
              <Group justify="center" gap="md">
                <DroppableZone id={`pair-${pair.index}-high`} title="HIGH">
                  <SortableContext items={pair.high.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs" w="50%" mx="auto" miw={150} mih={80} justify="center">
                      {pair.high.map((item, idx) => (
                        <SortableItem key={item.id} item={item} index={idx + 1} />
                      ))}
                    </Stack>
                  </SortableContext>
                </DroppableZone>

                <DroppableZone id={`pair-${pair.index}-low`} title="LOW">
                  <SortableContext items={pair.low.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs" w="50%" mx="auto" miw={150} mih={80} justify="center">
                      {pair.low.map((item, idx) => (
                        <SortableItem key={item.id} item={item} index={idx + 1} />
                      ))}
                    </Stack>
                  </SortableContext>
                </DroppableZone>
              </Group>
            </Stack>
          ))}

          <Button
            variant="filled"
            color="orange"
            onClick={addNewPair}
            disabled={disabled || isAddingPair}
            mx="auto"
            w="fit-content"
          >
            {isAddingPair ? 'Adding...' : 'Add New Pair'}
          </Button>

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
  answer: { value: Record<string, string>; onChange?: (value: Record<string, string>) => void };
  index: number;
  enumerateQuestions: boolean;
}) {
  const {
    prompt,
    required,
    options,
    secondaryText,
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
        enumerateQuestions={enumerateQuestions}
        prompt={prompt}
        required={required}
        secondaryText={secondaryText}
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
      />
    );
  }

  return null;
}
