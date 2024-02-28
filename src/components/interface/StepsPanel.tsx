import {
  Badge, NavLink, Popover, Text,
} from '@mantine/core';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowsShuffle } from '@tabler/icons-react';
import { createPortal } from 'react-dom';
import { useDisclosure } from '@mantine/hooks';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { deepCopy } from '../../utils/deepCopy';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { IndividualComponent, InheritedComponent, OrderObject } from '../../parser/types';
import { Sequence } from '../../store/types';
import { findTaskIndexInSequence, getSequenceFlatMap, getSubSequence } from '../../utils/getSequenceFlatMap';

function JSONstringifyOrdered(obj: object) {
  const allKeys = new Set<string>();
  // eslint-disable-next-line no-sequences
  JSON.stringify(obj, (key, value) => (allKeys.add(key), value));
  return JSON.stringify(obj, Array.from(allKeys).sort());
}

function reorderComponents(orderComponents: (string | OrderObject)[], sequenceComponents: (string | Sequence)[], path: string) {
  const newComponents: (string | OrderObject)[] = [];

  // Iterate through the sequence components and reorder the orderComponents
  sequenceComponents.forEach((sequenceComponent) => {
    if (typeof sequenceComponent === 'string') {
      newComponents.push(sequenceComponent);
    } else {
      const sequencePathNextIndex = sequenceComponent.path.replace(`${path}-`, '').split('-')[0];
      const orderComponent = orderComponents[+sequencePathNextIndex];
      newComponents.push(orderComponent);
    }
  });

  // If there are any unused orderComponents, add them to the end
  orderComponents.forEach((orderComponent) => {
    if (!newComponents.includes(orderComponent)) {
      newComponents.push(orderComponent);
    }
  });

  return newComponents;
}

function StepItem({
  startIndex,
  step,
  fullSequence,
  sequence,
  path,
  task,
  studyId,
}: {
  startIndex: number;
  step: string;
  fullSequence: Sequence;
  sequence: Sequence;
  path: string;
  task: false | IndividualComponent | InheritedComponent;
  studyId: string | null;
}) {
  const navigate = useNavigate();
  const [opened, { close, open }] = useDisclosure(false);

  const stepIsInSequence = sequence.components.includes(step);
  const index = stepIsInSequence ? findTaskIndexInSequence(fullSequence, step, startIndex, path, 'root') : -1;
  const active = useCurrentStep() === index;

  return (
    <Popover position="left" withArrow arrowSize={10} shadow="md" opened={opened} offset={20}>
      <Popover.Target>
        <div
          onMouseEnter={open}
          onMouseLeave={close}
        >
          <NavLink
            active={active}
            style={{
              lineHeight: '32px',
              height: '32px',
            }}
            label={(
              <div>{active ? <strong>{step}</strong> : step}</div>
            )}
            onClick={() => navigate(`/${studyId}/${index}`)}
            disabled={!stepIsInSequence}
          />
        </div>
      </Popover.Target>
      {task && (task.description || task.meta) && createPortal(
        <Popover.Dropdown onMouseLeave={close}>
          <Text size="sm">
            <div>
              {task.description && (
                <div>
                  <Text fw={900} display="inline-block" mr={2}>
                    Description:
                  </Text>
                  <Text fw={400} component="span">
                    {task.description}
                  </Text>
                </div>
              )}
              {task.meta && (
                <Text>
                  <Text fw="900" component="span">Task Meta: </Text>
                  <pre style={{ margin: 0, padding: 0 }}>{`${JSON.stringify(task.meta, null, 2)}`}</pre>
                </Text>
              )}
            </div>
          </Text>
        </Popover.Dropdown>,
        document.body,
      )}
    </Popover>
  );
}

export function StepsPanel({
  fullSequence,
  fullOrder,
  path,
  index = 0,
}: {
  fullSequence: Sequence;
  fullOrder: OrderObject;
  path: string;
  index?: number;
}) {
  const studyId = useStudyId();
  const studyConfig = useStudyConfig();

  const parentPath = path.split('-').slice(0, -1).join('-');

  let sequence: Sequence = getSubSequence(fullSequence, path);
  let order: OrderObject;

  if (sequence === undefined) {
    // Find all available order paths
    const availableOrderPaths: string[] = [];
    getSubSequence(fullOrder, parentPath).components.forEach((component, idx) => (typeof component !== 'string' ? availableOrderPaths.push(`${parentPath}-${idx}`) : null));

    // Find the ones that are used in the sequence
    const usedOrderPaths: string[] = [];
    getSubSequence(fullSequence, parentPath).components.forEach((component) => (typeof component !== 'string' ? usedOrderPaths.push(component.path) : null));

    // Find the ones that are not used
    const unusedOrderPaths = availableOrderPaths.filter((p) => !usedOrderPaths.includes(p));

    // Get an index for the unusedOrderPaths, based on our index passed in
    const unusedIndex = index - usedOrderPaths.length;

    order = getSubSequence(fullOrder, unusedOrderPaths[unusedIndex]);
    sequence = { path: `${unusedOrderPaths[unusedIndex]}`, components: [] };
  } else {
    order = getSubSequence(fullOrder, sequence.path);
  }

  const newOrder = useMemo(() => {
    const nOrder = deepCopy(order);

    // Reorder the nOrder.components based on the sequence
    nOrder.components = reorderComponents(nOrder.components, sequence?.components || [], path);

    return nOrder;
  }, [order, sequence]);

  return (
    <div>
      {newOrder.components.map((step, idx) => {
        if (typeof step === 'string') {
          const task = step in studyConfig.components && studyConfig.components[step];
          return (
            <StepItem
              key={idx}
              startIndex={idx}
              fullSequence={fullSequence}
              sequence={sequence}
              path={path}
              step={step}
              studyId={studyId}
              task={task}
            />
          );
        }

        const orderIndex = order.components.findIndex((c) => {
          if (JSONstringifyOrdered(c as OrderObject) === JSONstringifyOrdered(step)) {
            return true;
          }
          return false;
        });

        const subSequence = getSubSequence(fullSequence, `${path}-${idx}`);
        const sequenceSteps = subSequence === undefined ? [] : getSequenceFlatMap(subSequence);
        const orderSteps = getSequenceFlatMap(getSubSequence(fullOrder, `${path}-${orderIndex}`));

        return (
          <NavLink
            key={idx}
            label={(
              <div
                style={{
                  opacity: sequenceSteps ? 1 : 0.5,
                }}
              >
                Group:
                <Badge ml={5}>
                  {sequenceSteps.length}
                  /
                  {orderSteps.length}
                </Badge>
                <Text c="dimmed" display="inline" mr={5} ml={5}>
                  {step.order}
                </Text>
                {step.order === 'random' || step.order === 'latinSquare' ? (
                  <IconArrowsShuffle size="15" opacity={0.5} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
                ) : null}
              </div>
            )}
            defaultOpened
            childrenOffset={32}
            style={{
              lineHeight: '32px',
              height: '32px',
              position: 'sticky',
              backgroundColor: '#fff',
            }}
          >
            <div style={{ borderLeft: '1px solid #e9ecef' }}>
              <StepsPanel fullOrder={fullOrder} fullSequence={fullSequence} path={`${path}-${idx}`} index={idx} />
            </div>
          </NavLink>
        );
      })}
    </div>
  );
}
