import {
  NavLink, Popover, Text,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import { IconBrain } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { createPortal } from 'react-dom';
import { Sequence } from '../../store/types';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';

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

export function StepItem({
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
  const { demoName } = useParams();
  const [opened, { close, open }] = useDisclosure(false);

  const task = step in studyConfig.components && studyConfig.components[step];

  const stepIndex = subSequence && subSequence.components.slice(startIndex).includes(step) ? findTaskIndexInSequence(fullSequence, step, startIndex, subSequence.orderPath) : -1;
  const active = stepIndex !== -1 && currentStep === stepIndex;

  return (
    <Popover position="left" withArrow arrowSize={10} shadow="md" opened={opened} offset={20}>
      <Popover.Target>
        <div
          onMouseEnter={open}
          onMouseLeave={close}
        >
          <NavLink
            active={active || demoName === step}
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
            onClick={() => navigate(`/${studyId}/${stepIndex}/${stepIndex === -1 ? step : ''}`)}
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
