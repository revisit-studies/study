import {
  Badge, Box, NavLink, HoverCard, Text, Tooltip, Code, Flex, Button,
} from '@mantine/core';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  IconArrowsShuffle, IconBrain, IconCheck, IconPackageImport, IconX, IconDice3, IconDice5, IconInfoCircle,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import {
  ComponentBlock, DynamicBlock, ParticipantData, StudyConfig, Response,
} from '../../parser/types';
import { Sequence, StoredAnswer } from '../../store/types';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { decryptIndex, encryptIndex } from '../../utils/encryptDecryptIndex';
import { useFlatSequence, useStoreSelector } from '../../store/store';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';
import { componentAnswersAreCorrect } from '../../utils/correctAnswer';

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

function hasRandomization(responses: Response[]) {
  return responses.some((response) => {
    if (response.type === 'radio' || response.type === 'checkbox' || response.type === 'buttons') {
      return response.optionOrder === 'random';
    }
    if (response.type === 'matrix-radio' || response.type === 'matrix-checkbox') {
      return response.questionOrder === 'random';
    }
    return false;
  });
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
  parentBlock,
  parentActive,
  answers,
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
  parentBlock: Sequence;
  parentActive: boolean;
  answers: ParticipantData['answers'];
}) {
  const studyId = useStudyId();
  const navigate = useNavigate();
  const currentStep = useCurrentStep();

  const task = studyConfig.components[step] && studyComponentToIndividualComponent(studyConfig.components[step], studyConfig);

  const stepIndex = subSequence && subSequence.components.slice(startIndex).includes(step) ? findTaskIndexInSequence(fullSequence, step, startIndex, subSequence.orderPath) : -1;

  const { trialId, funcIndex, analysisTab } = useParams();
  const [searchParams] = useSearchParams();
  const participantId = useMemo(() => searchParams.get('participantId'), [searchParams]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const flatSequence = analysisTab ? [] : useFlatSequence();

  const analysisActive = trialId === step;
  const dynamicActive = parentActive && parentBlock && funcIndex ? startIndex === decryptIndex(funcIndex) : false;
  const studyActive = participantView ? (currentStep === stepIndex || dynamicActive) : currentStep === `reviewer-${step}`;
  const active = analysisNavigation ? analysisActive : studyActive;

  const analysisNavigateTo = trialId ? `./../${step}` : `./${step}`;
  const dynamicNavigateTo = parentBlock.order === 'dynamic' ? `/${studyId}/${encryptIndex(flatSequence.indexOf(parentBlock.id!))}/${encryptIndex(startIndex)}` : '';
  const studyNavigateTo = participantView ? (parentBlock.order === 'dynamic' ? dynamicNavigateTo : `/${studyId}/${encryptIndex(stepIndex)}`) : `/${studyId}/reviewer-${step}`;
  const navigateTo = analysisNavigation ? () => navigate(analysisNavigateTo) : () => navigate(`${studyNavigateTo}${participantId ? `?participantId=${participantId}` : ''}`);

  const coOrComponents = step.includes('.co.')
    ? '.co.'
    : (step.includes('.components.') ? '.components.' : false);
  const cleanedStep = step.includes('$') && coOrComponents && step.includes(coOrComponents) ? step.split(coOrComponents).at(-1) : step;

  const matchingAnswer = parentBlock.order === 'dynamic' ? Object.entries(answers).find(([key, _]) => key === `${parentBlock.id}_${flatSequence.indexOf(parentBlock.id!)}_${cleanedStep}_${startIndex}`) : Object.entries(answers).find(([key, _]) => key === `${cleanedStep}_${stepIndex}` || key === `${step}_${stepIndex}`);
  const taskAnswer: StoredAnswer | null = matchingAnswer ? matchingAnswer[1] : null;

  const correctAnswer = taskAnswer && taskAnswer.correctAnswer.length > 0 && Object.keys(taskAnswer.answer).length > 0 && taskAnswer.correctAnswer;
  const correct = correctAnswer && taskAnswer && componentAnswersAreCorrect(taskAnswer.answer, correctAnswer);

  const correctIncorrectIcon = taskAnswer && correctAnswer ? (
    correct
      ? <IconCheck size={16} style={{ marginRight: 4, flexShrink: 0 }} color="green" />
      : <IconX size={16} style={{ marginRight: 4, flexShrink: 0 }} color="red" />
  ) : null;

  const INITIAL_CLAMP = 6;
  const responseJSONText = task && JSON.stringify(task.response, null, 2);
  const [responseClamp, setResponseClamp] = useState<number | undefined>(INITIAL_CLAMP);

  const correctAnswerJSONText = taskAnswer && taskAnswer.correctAnswer.length > 0
    ? JSON.stringify(taskAnswer.correctAnswer, null, 2)
    : task && task.correctAnswer
      ? JSON.stringify(task.correctAnswer, null, 2)
      : undefined;
  const [correctAnswerClamp, setCorrectAnswerClamp] = useState<number | undefined>(INITIAL_CLAMP);

  return (
    <HoverCard withinPortal position="left" withArrow arrowSize={10} shadow="md" offset={0} closeDelay={0}>
      <NavLink
        active={active}
        style={{
          lineHeight: '32px',
          height: '32px',
        }}
        label={(
          <Flex align="center">
            {interruption && (
            <Tooltip label="Interruption" position="right" withArrow>
              <IconBrain size={16} style={{ marginRight: 4, flexShrink: 0 }} color="orange" />
            </Tooltip>
            )}
            {step !== cleanedStep && (
            <Tooltip label="Package import" position="right" withArrow>
              <IconPackageImport size={16} style={{ marginRight: 4, flexShrink: 0 }} color="blue" />
            </Tooltip>
            )}
            {task?.responseOrder === 'random' && (
            <Tooltip label="Random responses" position="right" withArrow>
              <IconDice3 size={16} opacity={0.8} style={{ marginRight: 4, flexShrink: 0 }} color="black" />
            </Tooltip>
            )}
            {(task?.response && hasRandomization(task.response)) && (
            <Tooltip label="Random options" position="right" withArrow>
              <IconDice5 size={16} opacity={0.8} style={{ marginRight: 4, flexShrink: 0 }} color="black" />
            </Tooltip>
            )}
            {correctIncorrectIcon}
            <Text
              size="sm"
              span={active}
              fw={active ? '700' : undefined}
              display="inline"
              title={cleanedStep}
              style={{
                textWrap: 'nowrap',
                flexGrow: 1,
                width: 0,
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
            >
              {cleanedStep}
            </Text>
            {cleanedStep !== 'end' && (
              <HoverCard.Target>
                <IconInfoCircle size={16} style={{ marginLeft: '5px', verticalAlign: 'middle' }} opacity={0.5} />
              </HoverCard.Target>
            )}
          </Flex>
          )}
        onClick={navigateTo}
        disabled={disabled && parentBlock.order !== 'dynamic'}
      />
      {task && (
        <HoverCard.Dropdown>
          <Box mah={700} maw={500} style={{ overflow: 'auto' }}>
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
            {('parameters' in task || taskAnswer) && (
              <Box>
                <Text fw={900} display="inline-block" mr={2}>
                  Parameters:
                </Text>
                {' '}
                <Code block>{taskAnswer && JSON.stringify(Object.keys(taskAnswer).length > 0 ? taskAnswer.parameters : ('parameters' in task ? task.parameters : {}), null, 2)}</Code>
              </Box>
            )}
            {taskAnswer && Object.keys(taskAnswer.answer).length > 0 && (
              <Box>
                <Text fw={900} display="inline-block" mr={2}>
                  {correctIncorrectIcon}
                  Participant Answer:
                </Text>
                {' '}
                <Code block>{JSON.stringify(taskAnswer.answer, null, 2)}</Code>
              </Box>
            )}
            {correctAnswerJSONText && (
              <Box>
                <Text fw={900} display="inline-block" mr={2}>
                  Correct Answer:
                </Text>
                {' '}
                <Code block>
                  <Text size="xs" lineClamp={correctAnswerClamp}>{correctAnswerJSONText}</Text>
                  {correctAnswerJSONText.split('\n').length > INITIAL_CLAMP && (
                    <Flex justify="flex-end">
                      {(correctAnswerClamp === undefined || correctAnswerJSONText.split('\n').length > correctAnswerClamp) && (
                      <Button variant="light" size="xs" onClick={() => { setCorrectAnswerClamp((prev) => (prev === INITIAL_CLAMP ? undefined : INITIAL_CLAMP)); }}>
                        {correctAnswerClamp !== undefined ? 'Show more' : 'Show less'}
                      </Button>
                      )}
                    </Flex>
                  )}
                </Code>
              </Box>
            )}
            <Box>
              <Text fw={900} display="inline-block" mr={2}>
                Response:
              </Text>
              {' '}
              <Code block>
                <Text size="xs" lineClamp={responseClamp}>{responseJSONText}</Text>
                {responseJSONText.split('\n').length > INITIAL_CLAMP && (
                  <Flex justify="flex-end">
                    {(responseClamp === undefined || responseJSONText.split('\n').length > responseClamp) && (
                    <Button variant="light" size="xs" onClick={() => { setResponseClamp((prev) => (prev === INITIAL_CLAMP ? undefined : INITIAL_CLAMP)); }}>
                      {responseClamp !== undefined ? 'Show more' : 'Show less'}
                    </Button>
                    )}
                  </Flex>
                )}
              </Code>
            </Box>
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
  const { analysisTab } = useParams();
  let answers: ParticipantData['answers'] = {};
  if (!analysisTab) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    answers = useStoreSelector((state) => state.answers);
  }

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

  const [searchParams] = useSearchParams();
  const participantId = useMemo(() => searchParams.get('participantId'), [searchParams]);
  const currentStep = useCurrentStep();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const flatSequence = analysisTab ? [] : useFlatSequence();
  const dynamicBlockActive = typeof currentStep === 'number' && configSequence.order === 'dynamic' && flatSequence[currentStep] === configSequence.id;
  const indexofDynamicBlock = (configSequence.id && flatSequence.indexOf(configSequence.id)) || -1;

  const studyId = useStudyId();
  const navigate = useNavigate();
  const navigateTo = () => navigate(`/${studyId}/${encryptIndex(indexofDynamicBlock)}/${encryptIndex(0)}${participantId ? `?participantId=${participantId}` : ''}`);

  const toLoopOver = [
    ...components,
    ...Object.entries(answers).filter(([key, _]) => key.startsWith(`${configSequence.id}_${indexofDynamicBlock}_`)).map(([_, value]) => value.componentName),
  ];

  return (
    <NavLink
      key={configSequence.id}
      active={dynamicBlockActive}
      label={(
        <Flex align="center" style={{ opacity: sequenceStepsLength > 0 ? 1 : 0.5 }}>
          <Text
            size="sm"
            display="inline"
            fw={dynamicBlockActive ? 900 : 700}
            title={configSequence.id ? configSequence.id : configSequence.order}
            style={{
              textWrap: 'nowrap',
              flexGrow: 1,
              width: 0,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            {configSequence.id ? configSequence.id : configSequence.order}
          </Text>
          {configSequence.order === 'random' || configSequence.order === 'latinSquare' ? (
            <Tooltip label={configSequence.order} position="right" withArrow>
              <IconArrowsShuffle size="15" opacity={0.5} style={{ marginLeft: '5px', verticalAlign: 'middle' }} />
            </Tooltip>
          ) : null}
          {participantView && (
            <Badge ml={5} variant="light">
              {configSequence.order === 'dynamic' ? `${Object.keys(answers).filter((keys) => keys.startsWith(`${configSequence.id}_`)).length} / ?` : `${sequenceStepsLength}/${orderSteps.length}`}
            </Badge>
          )}
          {participantView && configSequence.interruptions && (
            <Badge ml={5} color="orange" variant="light">
              {participantSequence?.components.filter((s) => typeof s === 'string' && configSequence.interruptions?.flatMap((i) => i.components).includes(s)).length || 0}
            </Badge>
          )}
        </Flex>
      )}
      opened={isPanelOpened}
      onClick={() => (configSequence.order === 'dynamic' && !analysisNavigation && participantView ? navigateTo() : setIsPanelOpened(!isPanelOpened))}
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
                  parentBlock={configSequence}
                  parentActive={dynamicBlockActive}
                  answers={answers}
                />
              );
            }

            const newSequence = participantSequence?.components.find((s) => typeof s !== 'string' && s.orderPath === step.orderPath) as Sequence | undefined;

            return (
              <StepsPanel
                key={idx}
                configSequence={step}
                participantSequence={newSequence}
                fullSequence={fullSequence}
                participantView={participantView}
                studyConfig={studyConfig}
                analysisNavigation={analysisNavigation}
              />
            );
          })}
        </Box>
      ) : null }
    </NavLink>
  );
}
