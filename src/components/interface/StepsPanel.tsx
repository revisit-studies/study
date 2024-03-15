import {
  Badge, NavLink, Popover, Text,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconArrowsShuffle, IconBrain } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { createPortal } from 'react-dom';
import { ComponentBlock } from '../../parser/types';
import { Sequence } from '../../store/types';
import { deepCopy } from '../../utils/deepCopy';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';

export type ComponentBlockWithOrderPath = Omit<ComponentBlock, 'components'> & { orderPath: string; components: (ComponentBlockWithOrderPath | string)[]};

function findTaskIndexInSequence(sequence: Sequence, step: string, startIndex: number, requestedPath: string): number {
  let index = 0;

  // Loop through the sequence components and find the index of the task if it's in this block
  for (let i = 0; i < sequence.components.length; i += 1) {
    const component = sequence.components[i];
    if (typeof component === 'string') {
      if (requestedPath === sequence.orderPath && component === step && i >= startIndex) {
        break;
      }
      index += 1;
    } else {
      // See if the task is in the nested sequence
      index += findTaskIndexInSequence(component, step, startIndex, requestedPath);

      // If the task is in the nested sequence, break the loop. We need includes, because we need to break the loop if the task is in the nested sequence
      if (requestedPath.includes(component.orderPath)) {
        break;
      }
    }
  }

  return index;
}

function countInterruptionsRecursively(configSequence: ComponentBlockWithOrderPath, participantSequence: Sequence) {
  let count = 0;

  // Loop through the participant sequence and count the interruptions that are defined in the configSequence
  participantSequence.components.forEach((component) => {
    if (typeof component === 'string' && configSequence.interruptions?.flatMap((i) => i.components).includes(component)) {
      count += 1;
    } else if (typeof component !== 'string') {
      // If the component is a sequence, find the corresponding sequence in the configSequence and count the interruptions
      const configSubSequence = configSequence.components.find((c) => typeof c !== 'string' && c.orderPath === component.orderPath) as ComponentBlockWithOrderPath;
      count += countInterruptionsRecursively(configSubSequence, component);
    }
  });

  return count;
}

function reorderComponents(configSequence: ComponentBlockWithOrderPath['components'], participantSequence: Sequence['components']) {
  const newComponents: (string | ComponentBlockWithOrderPath)[] = [];

  // Iterate through the sequence components and reorder the orderComponents
  participantSequence.forEach((sequenceComponent) => {
    // Find the index of the sequenceComponent in the configSequence
    const configSequenceIndex = configSequence.findIndex((c) => {
      if (typeof c === 'string') {
        return c === sequenceComponent;
      }
      return typeof sequenceComponent !== 'string' && c.orderPath === sequenceComponent.orderPath;
    });

    if (configSequenceIndex !== -1) {
      newComponents.push(configSequence[configSequenceIndex]);
      configSequence.splice(configSequenceIndex, 1);
    }

    if (configSequenceIndex === -1 && typeof sequenceComponent === 'string') {
      newComponents.push(sequenceComponent);
    }
  });

  newComponents.push(...configSequence);

  return newComponents;
}

function StepItem({
  step,
  disabled,
  fullSequence,
  startIndex,
  interruption,
  subSequence,
}: {
  step: string;
  disabled: boolean;
  fullSequence: Sequence;
  startIndex: number;
  interruption: boolean,
  subSequence?: Sequence;
}) {
  const studyId = useStudyId();
  const navigate = useNavigate();
  const currentStep = useCurrentStep();
  const studyConfig = useStudyConfig();
  const [opened, { close, open }] = useDisclosure(false);

  const task = step in studyConfig.components && studyConfig.components[step];

  const stepIndex = subSequence && subSequence.components.slice(startIndex).includes(step) ? findTaskIndexInSequence(fullSequence, step, startIndex, subSequence.orderPath) : -1;
  const active = currentStep === stepIndex;

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
              <div>
                {interruption && <IconBrain size={16} style={{ marginRight: 4, marginBottom: -2 }} color="orange" />}
                {active ? <strong>{step}</strong> : step}
              </div>
            )}
            onClick={() => navigate(`/${studyId}/${stepIndex}`)}
            disabled={disabled}
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
  configSequence,
  fullSequence,
  participantSequence,
}: {
  configSequence: ComponentBlockWithOrderPath,
  fullSequence: Sequence,
  participantSequence?: Sequence,
}) {
  // If the participantSequence is provided, reorder the components
  let components = deepCopy(configSequence.components);
  if (participantSequence) {
    const reorderedComponents = reorderComponents(deepCopy(configSequence.components), deepCopy(participantSequence.components));
    components = reorderedComponents;
  }

  return (
    <div>
      {components.map((step, idx) => {
        if (typeof step === 'string') {
          return (
            <StepItem
              key={idx}
              step={step}
              disabled={participantSequence?.components[idx] !== step}
              fullSequence={fullSequence}
              startIndex={idx}
              interruption={(configSequence.interruptions && (configSequence.interruptions.findIndex((i) => i.components.includes(step)) > -1)) || false}
              subSequence={participantSequence}
            />
          );
        }

        const participantSubSequence = participantSequence?.components.find((s) => typeof s !== 'string' && s.orderPath === step.orderPath) as Sequence | undefined;

        // Count tasks - interruptions
        const sequenceStepsLength = participantSubSequence ? getSequenceFlatMap(participantSubSequence).length - countInterruptionsRecursively(step, participantSubSequence) : 0;
        const orderSteps = getSequenceFlatMap(step);

        return (
          <NavLink
            key={idx}
            label={(
              <div
                style={{
                  opacity: sequenceStepsLength > 0 ? 1 : 0.5,
                }}
              >
                Group:
                <Badge ml={5}>
                  {sequenceStepsLength}
                  /
                  {orderSteps.length}
                </Badge>
                {step.interruptions && (
                <Badge ml={5} color="orange">
                  {participantSubSequence?.components.filter((s) => typeof s === 'string' && step.interruptions?.flatMap((i) => i.components).includes(s)).length || 0}
                </Badge>
                )}
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
              <StepsPanel configSequence={step} participantSequence={participantSubSequence} fullSequence={fullSequence} />
            </div>
          </NavLink>
        );
      })}
    </div>
  );
}
