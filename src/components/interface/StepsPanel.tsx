import {
  Badge, Box, NavLink, HoverCard, Text, Tooltip, Code,
} from '@mantine/core';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { IconArrowsShuffle, IconBrain, IconPackageImport } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { ComponentBlock, DynamicBlock, StudyConfig } from '../../parser/types';
import { Sequence } from '../../store/types';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { encryptIndex } from '../../utils/encryptDecryptIndex';
import { useFlatSequence, useStoreSelector } from '../../store/store';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';
import { PREFIX } from '../../utils/Prefix';

export type ComponentBlockWithOrderPath =
  Omit<ComponentBlock, 'components'> & { orderPath: string; components: (ComponentBlockWithOrderPath | string)[]; interruptions?: { components: string[] }[] }
  | (DynamicBlock & { orderPath: string; interruptions?: { components: string[] }[]; components: (ComponentBlockWithOrderPath | string)[]; });

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
      if (component.order === 'dynamic') {
        index += 1;
      } else {
        // See if the task is in the nested sequence
        index += findTaskIndexInSequence(component, step, startIndex, requestedPath);
      }

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

  if (configSequence) {
    newComponents.push(...configSequence);
  }

  return newComponents;
}

function StepItem({
  step,
  disabled,
  fullSequence,
  startIndex,
  interruption,
  participantView,
  studyConfig,
  subSequence,
  analysisNavigation,
}: {
  step: string;
  disabled: boolean;
  fullSequence: Sequence;
  startIndex: number;
  interruption: boolean;
  participantView: boolean;
  studyConfig: StudyConfig;
  subSequence?: Sequence;
  analysisNavigation?: boolean;
}) {
  const studyId = useStudyId();
  const navigate = useNavigate();
  const currentStep = useCurrentStep();

  const task = studyConfig.components[step] && studyComponentToIndividualComponent(studyConfig.components[step], studyConfig);

  const stepIndex = subSequence && subSequence.components.slice(startIndex).includes(step) ? findTaskIndexInSequence(fullSequence, step, startIndex, subSequence.orderPath) : -1;

  const { trialId } = useParams();
  const [searchParams] = useSearchParams();
  const participantId = useMemo(() => searchParams.get('participantId'), [searchParams]);

  const analysisActive = trialId === step;
  const studyActive = participantView ? currentStep === stepIndex : currentStep === `reviewer-${step}`;
  const active = analysisNavigation ? analysisActive : studyActive;

  const analysisNavigateTo = useCallback(() => (trialId ? navigate(`./../${step}`) : navigate(`./${step}`)), [navigate, step, trialId]);
  const studyNavigateTo = () => (participantView ? (participantId ? navigate(`/${studyId}/${encryptIndex(stepIndex)}?participantId=${participantId}`) : navigate(`/${studyId}/${encryptIndex(stepIndex)}`)) : navigate(`/${studyId}/reviewer-${step}`));
  const navigateTo = analysisNavigation ? analysisNavigateTo : studyNavigateTo;

  const coOrComponents = step.includes('.co.')
    ? '.co.'
    : (step.includes('.components.') ? '.components.' : false);
  const cleanedStep = step.includes('$') && coOrComponents && step.includes(coOrComponents) ? step.split(coOrComponents).at(-1) : step;

  return (
    <HoverCard withinPortal position="left" withArrow arrowSize={10} shadow="md" offset={0}>
      <HoverCard.Target>
        <NavLink
          active={active}
          style={{
            lineHeight: '32px',
            height: '32px',
          }}
          label={(
            <Box>
              {interruption && <IconBrain size={16} style={{ marginRight: 4, marginBottom: -2 }} color="orange" />}
              {step !== cleanedStep && (
                <IconPackageImport size={16} style={{ marginRight: 4, marginBottom: -2 }} color="var(--mantine-color-blue-outline)" />
              )}
              <Text size="sm" span={active} fw={active ? '700' : undefined} display="inline" style={{ textWrap: 'nowrap' }}>{cleanedStep}</Text>
            </Box>
          )}
          onClick={navigateTo}
          disabled={disabled}
        />
      </HoverCard.Target>
      {task && (
        <HoverCard.Dropdown>
          <Box mah={700} style={{ overflow: 'auto' }}>
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                Name:
              </Text>
              {' '}
              <Text fw={400} component="span">
                {cleanedStep}
              </Text>
            </Box>
            {task.description && (
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                Description:
              </Text>
              {' '}
              <Text fw={400} component="span">
                {task.description}
              </Text>
            </Box>
            )}
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                Response:
              </Text>
              {' '}
              <Code block>{JSON.stringify(task.response, null, 2)}</Code>
            </Box>
            {task.correctAnswer && (
              <Box>
                <Text fw={900} display="inline-block" mr={2}>
                  Correct Answer:
                </Text>
                {' '}
                <Code block>{JSON.stringify(task.correctAnswer, null, 2)}</Code>
              </Box>
            )}
            {task.meta && (
            <Box>
              <Text fw="900" component="span">Task Meta: </Text>
              <Code block>{JSON.stringify(task.meta, null, 2)}</Code>
            </Box>
            )}
          </Box>
        </HoverCard.Dropdown>
      )}
    </HoverCard>
  );
}

export function StepsPanel({
  configSequence,
  fullSequence,
  participantSequence,
  participantView,
  studyConfig,
  analysisNavigation,
}: {
  configSequence: ComponentBlockWithOrderPath;
  fullSequence: Sequence;
  participantSequence?: Sequence;
  participantView: boolean;
  studyConfig: StudyConfig;
  analysisNavigation?: boolean;
}) {
  // If the participantSequence is provided, reorder the components
  let components = structuredClone(configSequence.components);
  if (participantSequence && participantView) {
    const reorderedComponents = reorderComponents(structuredClone(configSequence.components), structuredClone(participantSequence.components));
    components = reorderedComponents;
  }

  // Hacky. This call is not conditional, it either always happens or never happens. Not ideal.
  const answers = useStoreSelector((state) => state.answers);

  if (!participantView) {
    // Add interruptions to the sequence
    components = [
      ...(configSequence.interruptions?.flatMap((interruption) => interruption.components) || []),
      ...(components || []),
    ];
  }

  // Count tasks - interruptions
  const sequenceStepsLength = useMemo(() => (participantSequence ? getSequenceFlatMap(participantSequence).length - countInterruptionsRecursively(configSequence, participantSequence) : 0), [configSequence, participantSequence]);
  const orderSteps = useMemo(() => getSequenceFlatMap(configSequence), [configSequence]);

  const [isPanelOpened, setIsPanelOpened] = useState<boolean>(sequenceStepsLength > 0);

  const currentStep = useCurrentStep();
  const flatSequence = useFlatSequence();
  const dynamicBlockActive = typeof currentStep === 'number' && configSequence.order === 'dynamic' && flatSequence[currentStep] === configSequence.id;

  const studyId = useStudyId();
  const navigate = useNavigate();
  const navigateTo = () => navigate(`${PREFIX}${studyId}/${encryptIndex(flatSequence.indexOf(configSequence.id!))}/${encryptIndex(0)}`);

  const toLoopOver = [
    ...components,
    ...Object.entries(answers).filter(([key, _]) => key.includes(`${configSequence.id}_`)).map(([_, value]) => value.componentName),
  ];

  return (
    <NavLink
      key={configSequence.id}
      active={dynamicBlockActive}
      label={(
        <Box
          style={{
            opacity: sequenceStepsLength > 0 ? 1 : 0.5,
          }}
        >
          <Text size="sm" display="inline" fw={dynamicBlockActive ? 900 : 700}>
            {configSequence.id ? configSequence.id : configSequence.order}
          </Text>
          {configSequence.order === 'random' || configSequence.order === 'latinSquare' ? (
            <Tooltip label={configSequence.order} position="right" withArrow>
              <IconArrowsShuffle size="15" opacity={0.5} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
            </Tooltip>
          ) : null}
          {participantView && (
            <Badge ml={5} variant="light">
              {configSequence.order === 'dynamic' ? `${Object.keys(answers).filter((keys) => keys.startsWith(`${configSequence.id}_`)).length - 1} / ?` : `${sequenceStepsLength}/${orderSteps.length}`}
            </Badge>
          )}
          {participantView && configSequence.interruptions && (
            <Badge ml={5} color="orange" variant="light">
              {participantSequence?.components.filter((s) => typeof s === 'string' && configSequence.interruptions?.flatMap((i) => i.components).includes(s)).length || 0}
            </Badge>
          )}
        </Box>
            )}
      opened={isPanelOpened}
      onClick={() => (configSequence.order === 'dynamic' ? navigateTo() : setIsPanelOpened(!isPanelOpened))}
      childrenOffset={32}
      style={{
        lineHeight: '32px',
        height: '32px',
      }}
    >
      {isPanelOpened ? (
        <Box style={{ borderLeft: '1px solid #e9ecef' }}>
          {toLoopOver.map((step, idx) => {
            if (typeof step === 'string') {
              return (
                <StepItem
                  key={idx}
                  step={step}
                  disabled={participantView && participantSequence?.components[idx] !== step}
                  fullSequence={fullSequence}
                  startIndex={idx}
                  interruption={(configSequence.interruptions && (configSequence.interruptions.findIndex((i) => i.components.includes(step)) > -1)) || false}
                  participantView={participantView}
                  studyConfig={studyConfig}
                  subSequence={participantSequence}
                  analysisNavigation={analysisNavigation}
                />
              );
            }

            const newSequence = participantSequence?.components.find((s) => typeof s !== 'string' && s.orderPath === step.orderPath) as Sequence | undefined;

            return (
              <StepsPanel key={idx} configSequence={step} participantSequence={newSequence} fullSequence={fullSequence} participantView={participantView} studyConfig={studyConfig} analysisNavigation={analysisNavigation} />
            );
          })}
        </Box>
      ) : null }
    </NavLink>
  );
}
