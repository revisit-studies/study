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
import { useMemo, useState } from 'react';
import { RankingResponse, StringOption } from '../../parser/types';

function SortableItem({ item }: {
  item: {
    id: string;
    label: string;
    originalIndex: number;
  };
}) {
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
      style={{
        ...style,
        cursor: 'grab',
      }}
      p="sm"
      withBorder
      shadow="sm"
      {...attributes}
      {...listeners}
    >
      <Text>{item.label}</Text>
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

function RankingSublistComponent({
  options,
  disabled,
  index: _index,
  enumerateQuestions,
  prompt,
  required: _required,
  secondaryText,
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  index: number;
  enumerateQuestions: boolean;
  prompt?: string;
  required?: boolean;
  secondaryText?: string;
}) {
  const items: {
    id: string;
    label: string;
    originalIndex: number;
  }[] = useMemo(() => options.map((option, idx) => ({
    id: typeof option === 'string' ? option : option.value,
    label: typeof option === 'string' ? option : option.label,
    originalIndex: idx,
  })), [options]);

  const [state, handlers] = useListState(items);

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
        <Text size="md" fw={500} m="md">
          HIGH
        </Text>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={state.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <Stack gap="xs" w="40%" mx="auto">
              {state.map((item) => (
                <Flex key={item.id} align="center" gap="sm">
                  <Box style={{ flexGrow: 1 }}>
                    <SortableItem item={item} />
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

function RankingCategoricalComponent({
  options,
  disabled,
  index,
  enumerateQuestions,
  prompt,
  required: _required,
  secondaryText,
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  index: number;
  enumerateQuestions: boolean;
  prompt?: string;
  required?: boolean;
  secondaryText?: string;
}) {
  const items: {
    id: string;
    label: string;
    originalIndex: number;
  }[] = useMemo(() => options.map((option, idx) => ({
    id: typeof option === 'string' ? option : option.value,
    label: typeof option === 'string' ? option : option.label,
    originalIndex: idx,
  })), [options]);

  const [state, setState] = useState({
    unassigned: items,
    HIGH: [] as {
      id: string;
      label: string;
      originalIndex: number;
    }[],
    MEDIUM: [] as {
      id: string;
      label: string;
      originalIndex: number;
    }[],
    LOW: [] as {
      id: string;
      label: string;
      originalIndex: number;
    }[],
  });

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
    if (state.unassigned.find((item) => item.id === activeId)) sourceCategory = 'unassigned';
    if (state.HIGH.find((item) => item.id === activeId)) sourceCategory = 'HIGH';
    if (state.MEDIUM.find((item) => item.id === activeId)) sourceCategory = 'MEDIUM';
    if (state.LOW.find((item) => item.id === activeId)) sourceCategory = 'LOW';

    if (sourceCategory && targetCategory && sourceCategory !== targetCategory) {
      if (['unassigned', 'HIGH', 'MEDIUM', 'LOW'].includes(targetCategory)) {
        setState((prev) => {
          const newState = { ...prev };
          const activeItem = newState[sourceCategory as keyof typeof newState].find((item) => item.id === activeId);

          if (activeItem) {
            newState[sourceCategory as keyof typeof newState] = newState[sourceCategory as keyof typeof newState].filter((item) => item.id !== activeId);
            newState[targetCategory as keyof typeof newState] = [...newState[targetCategory as keyof typeof newState], activeItem];
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Stack gap="sm" w="60%" mx="auto">
          <DroppableZone id="HIGH" title="HIGH">
            <SortableContext items={state.HIGH.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs" w="50%" mx="auto">
                {state.HIGH.map((item) => (
                  <SortableItem key={item.id} item={item} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="MEDIUM" title="MEDIUM">
            <SortableContext items={state.MEDIUM.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs" w="50%" mx="auto">
                {state.MEDIUM.map((item) => (
                  <SortableItem key={item.id} item={item} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="LOW" title="LOW">
            <SortableContext items={state.LOW.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs" w="50%" mx="auto">
                {state.LOW.map((item) => (
                  <SortableItem key={item.id} item={item} />
                ))}
              </Stack>
            </SortableContext>
          </DroppableZone>

          <DroppableZone id="unassigned" title="Unassigned Items">
            <SortableContext items={state.unassigned.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <Stack gap="xs" w="50%" mx="auto">
                {state.unassigned.map((item) => (
                  <SortableItem key={item.id} item={item} />
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
  index,
  enumerateQuestions,
  prompt,
  required: _required,
  secondaryText,
}: {
  options: (StringOption | string)[];
  disabled: boolean;
  index: number;
  enumerateQuestions: boolean;
  prompt?: string;
  required?: boolean;
  secondaryText?: string;
}) {
  const itemList: {
    id: string;
    label: string;
    originalIndex: number;
  }[] = useMemo(() => options.map((option, idx) => ({
    id: typeof option === 'string' ? option : option.value,
    label: typeof option === 'string' ? option : option.label,
    originalIndex: idx,
  })), [options]);

  const [state, setState] = useState({
    unassigned: itemList,
    'pair-0-high': [] as {
      id: string;
      label: string;
      originalIndex: number;
    }[],
    'pair-0-low': [] as {
      id: string;
      label: string;
      originalIndex: number;
    }[],
  });

  const [pairCount, setPairCount] = useState(1);

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

          return newState;
        });
      }
    }
  };

  const addNewPair = () => {
    const newPairIndex = pairCount;
    setState((prev) => ({
      ...prev,
      [`pair-${newPairIndex}-high`]: [],
      [`pair-${newPairIndex}-low`]: [],
    }));
    setPairCount((prev) => prev + 1);
  };

  const getPairs = () => {
    const pairs = [];
    for (let i = 0; i < pairCount; i += 1) {
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
              {state.unassigned.map((item) => (
                <SortableItem key={item.id} item={item} />
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
                      {pair.high.map((item) => (
                        <SortableItem key={item.id} item={item} />
                      ))}
                    </Stack>
                  </SortableContext>
                </DroppableZone>

                <DroppableZone id={`pair-${pair.index}-low`} title="LOW">
                  <SortableContext items={pair.low.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs" w="50%" mx="auto" miw={150} mih={80} justify="center">
                      {pair.low.map((item) => (
                        <SortableItem key={item.id} item={item} />
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
            disabled={disabled}
            mx="auto"
            w="fit-content"
          >
            Add New Pair
          </Button>

        </Stack>
      </DndContext>
    </Box>
  );
}

export function RankingInput({
  response,
  disabled,
  // answer,
  index,
  enumerateQuestions,
}: {
  response: RankingResponse;
  disabled: boolean;
  // answer: { value: string[] };
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
        enumerateQuestions={enumerateQuestions}
        prompt={prompt}
        required={required}
        secondaryText={secondaryText}
      />
    );
  }

  return null;
}
