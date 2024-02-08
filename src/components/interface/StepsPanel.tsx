import {
  Badge, NavLink, Popover, Text,
} from '@mantine/core';
import { ReactNode, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowsShuffle } from '@tabler/icons-react';
import { createPortal } from 'react-dom';
import { useDisclosure } from '@mantine/hooks';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { deepCopy } from '../../utils/deepCopy';
import { useCurrentStep } from '../../routes';
import { IndividualComponent, InheritedComponent, OrderObject } from '../../parser/types';

function getFlatMap(orderObj: OrderObject):string[] {
  return orderObj.components.flatMap((component) => (typeof component === 'string' ? component : getFlatMap(component)));
}

function getVisibleChildComponent(sequence: string[], orderObj: OrderObject) {
  const flatObj = getFlatMap(orderObj);

  const visibleChild = flatObj.find(
    (component:string) => sequence.indexOf(component) !== -1,
  );

  return visibleChild;
}

function StepItem({
  step,
  currentStep,
  sequence,
  task,
  studyId,
}: {
  step: string;
  currentStep: string;
  sequence: string[];
  task: false | IndividualComponent | InheritedComponent;
  studyId: string | null;
}) {
  const navigate = useNavigate();
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <Popover position="left" withArrow arrowSize={10} shadow="md" opened={opened} offset={20}>
      <Popover.Target>
        <div
          onMouseEnter={open}
          onMouseLeave={close}
        >
          <NavLink
            active={step === currentStep}
            style={{
              lineHeight: '32px',
              height: '32px',
            }}
            label={(
              <div
                style={{
                  opacity: sequence.indexOf(step) === -1 ? '.3' : 1,
                }}
              >
                {step === currentStep ? <strong>{step}</strong> : step}
              </div>
            )}
            onClick={() => navigate(`/${studyId}/${step}`)}
            disabled={sequence.indexOf(step) === -1}
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
              {task.meta && <Text fw={900}>Task Meta:</Text>}
              {task.meta
                && Object.keys(task.meta).map((key) => (
                  <div key={key}>
                    <Text display="inline-block" mr={2}>
                      {key}
                      :
                    </Text>
                    <Text display="inline-block" mr={2}>
                      {(task.meta as Record<string, ReactNode>)[key]}
                    </Text>
                  </div>
                ))}
            </div>
          </Text>
        </Popover.Dropdown>,
        document.body,
      )}
    </Popover>
  );
}

export function StepsPanel({
  sequence,
  order,
  depth = 0,
}: {
  sequence: string[];
  order: OrderObject;
  depth?: number;
}) {
  const { studyId = null } = useParams<{
    studyId: string;
  }>();
  const currentStep = useCurrentStep();
  const studyConfig = useStudyConfig();

  const newOrder = useMemo(() => {
    const nOrder = deepCopy(order);

    // reorder based on sequence
    nOrder.components.sort((a, b) => {
      const keyA = typeof a === 'string' ? a : getVisibleChildComponent(sequence, a);
      const keyB = typeof b === 'string' ? b : getVisibleChildComponent(sequence, b);
      const idxA = keyA ? sequence.indexOf(keyA) : 10000;
      const idxB = keyB ? sequence.indexOf(keyB) : 10000;
      return (idxA === -1 ? 10000 : idxA) - (idxB === -1 ? 10000 : idxB);
    });

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
              currentStep={currentStep}
              sequence={sequence}
              step={step}
              studyId={studyId}
              task={task}
            />
          );
        }
        return (
          <NavLink
            key={idx}
            label={(
              <div
                style={{
                  opacity: getVisibleChildComponent(sequence, step) ? 1 : 0.5,
                }}
              >
                Group:
                <Badge ml={5}>
                  {step.numSamples && (`${step.numSamples}/`)}
                  {step.components.length}
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
              top: `${32 * depth}px`,
              backgroundColor: '#fff',
            }}
          >
            <div style={{ borderLeft: '1px solid #e9ecef' }}>
              <StepsPanel order={step} sequence={sequence} depth={depth + 1} />
            </div>
          </NavLink>
        );
      })}
    </div>
  );
}
