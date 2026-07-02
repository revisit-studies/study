import type { ParticipantData, SkipConditions, StudyConfig } from '../../parser/types';
import type { Sequence, StoredAnswer } from '../../store/types';
import { findBlockForStep, getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { parseTrialOrder } from '../../utils/parseTrialOrder';
import {
  conditionIsTriggered,
  getConditionTargetIndex,
  type SkipEvaluationAnswer,
} from '../../utils/skipConditions';

export function getDynamicComponentsForBlock(
  node: Sequence,
  participantAnswers: ParticipantData['answers'],
  index: number,
) {
  if (node.order !== 'dynamic') {
    return [];
  }

  return Object.entries(participantAnswers)
    .filter(([key]) => key.startsWith(`${node.id}_${index}_`))
    .map(([_, value]) => value.componentName);
}

function formatReference(reference: string) {
  const separator = reference.includes('.components.')
    ? '.components.'
    : reference.includes('.sequences.')
      ? '.sequences.'
      : reference.includes('.co.')
        ? '.co.'
        : reference.includes('.se.')
          ? '.se.'
          : false;

  return separator ? reference.split(separator).at(-1)! : reference;
}

function formatValue(value: string | number) {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatTarget(target: string) {
  return target === 'end' ? 'the end of the study' : formatReference(target);
}

export function formatSkipConditionSummary(condition: SkipConditions[number]) {
  const target = formatTarget(condition.to);

  if (condition.check === 'response') {
    const comparison = condition.comparison === 'equal' ? 'equals' : 'does not equal';
    return `If ${formatReference(condition.name)}.${condition.responseId} ${comparison} ${formatValue(condition.value)}, skip to ${target}.`;
  }

  if (condition.check === 'responses') {
    return `If ${formatReference(condition.name)} does not match its correct answers, skip to ${target}.`;
  }

  if (condition.check === 'block') {
    const result = condition.condition === 'numCorrect' ? 'correct' : 'incorrect';
    return `If this block has ${pluralize(condition.value, result, result)} component ${condition.value === 1 ? 'response' : 'responses'}, skip to ${target}.`;
  }

  const result = condition.condition === 'numCorrect' ? 'correct' : 'incorrect';
  return `If ${formatReference(condition.name)} has ${pluralize(condition.value, result, result)} repeated ${condition.value === 1 ? 'response' : 'responses'}, skip to ${target}.`;
}

function shouldShowSkipConditionForBlock(condition: SkipConditions[number], sequence: Sequence) {
  if (condition.check === 'block') {
    return getSequenceFlatMap(sequence).length > 0;
  }

  return getSequenceFlatMap(sequence).includes(condition.name);
}

export function getSkipConditionSummariesForBlock(sequence: Sequence) {
  return sequence.skip
    .filter((condition) => shouldShowSkipConditionForBlock(condition, sequence))
    .map(formatSkipConditionSummary);
}

function getCompletedTopLevelAnswers(participantAnswers: ParticipantData['answers']) {
  return Object.entries(participantAnswers)
    .map(([identifier, answer]) => {
      const { step, funcIndex } = parseTrialOrder(answer.trialOrder);
      return {
        identifier,
        answer,
        step,
        funcIndex,
      };
    })
    .filter((entry): entry is {
      identifier: string;
      answer: StoredAnswer;
      step: number;
      funcIndex: null;
    } => entry.step !== null && entry.funcIndex === null && entry.answer.endTime > -1 && !entry.answer.timedOut)
    .sort((a, b) => a.step - b.step);
}

function getAnswersForSkipEvaluation(participantAnswers: ParticipantData['answers'], currentStep: number) {
  return Object.entries(participantAnswers).reduce<Record<string, SkipEvaluationAnswer>>((acc, [key, responseObj]) => {
    const { step, funcIndex } = parseTrialOrder(responseObj.trialOrder);
    if (step !== null && funcIndex === null && step <= currentStep && responseObj.endTime > -1 && !responseObj.timedOut) {
      acc[key] = {
        answer: responseObj.answer,
        timedOut: false,
      };
    }
    return acc;
  }, {});
}

export function getSkippedTrialOrders(
  sequence: Sequence,
  participantAnswers: ParticipantData['answers'],
  studyConfig: StudyConfig,
) {
  const skippedTrialOrders = new Set<number>();
  const flatSequence = getSequenceFlatMap(sequence);

  getCompletedTopLevelAnswers(participantAnswers).forEach(({ step }) => {
    const blocksForStep = findBlockForStep(sequence, step);
    if (!blocksForStep) {
      return;
    }

    const answersForSkipEvaluation = getAnswersForSkipEvaluation(participantAnswers, step);
    const skipConditions = blocksForStep.flatMap((block) => block.currentBlock.skip.map((condition) => ({
      ...condition,
      firstIndex: block.firstIndex,
      lastIndex: step,
    })));

    const triggeredCondition = skipConditions.find((condition) => conditionIsTriggered(
      condition,
      answersForSkipEvaluation,
      studyConfig,
    ));

    if (!triggeredCondition) {
      return;
    }

    const targetIndex = getConditionTargetIndex(triggeredCondition, sequence, flatSequence);
    if (targetIndex === null || targetIndex <= step + 1) {
      return;
    }

    for (let skippedIndex = step + 1; skippedIndex < targetIndex; skippedIndex += 1) {
      skippedTrialOrders.add(skippedIndex);
    }
  });

  return skippedTrialOrders;
}
