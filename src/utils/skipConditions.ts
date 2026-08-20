import type {
  IndividualComponent,
  InheritedComponent,
  SkipConditions,
  StudyConfig,
} from '../parser/types';
import type { Sequence, StoredAnswer } from '../store/types';
import { componentAnswersAreCorrect } from './correctAnswer';
import { findIndexOfBlock } from './getSequenceFlatMap';
import { studyComponentToIndividualComponent } from './handleComponentInheritance';
import { parseTrialOrder } from './parseTrialOrder';

export type SkipEvaluationAnswer = Pick<StoredAnswer, 'answer' | 'timedOut'>;

export type SkipConditionWithExtents = SkipConditions[number] & {
  firstIndex: number;
  lastIndex: number;
};

export function areComponentAnswersCorrect(
  answers: StoredAnswer['answer'],
  componentConfig: IndividualComponent | InheritedComponent,
  studyConfig: StudyConfig,
) {
  const resolvedComponentConfig = studyComponentToIndividualComponent(componentConfig, studyConfig);

  if (!resolvedComponentConfig.correctAnswer) {
    return true;
  }

  return componentAnswersAreCorrect(
    answers,
    resolvedComponentConfig.correctAnswer,
    resolvedComponentConfig.response,
  );
}

export function getSkipConditionCorrectAnswers(
  componentsToCheck: Array<[string, Pick<SkipEvaluationAnswer, 'answer'>]>,
  studyConfig: StudyConfig,
) {
  return componentsToCheck.map(([candidateComponentName, responseObj]) => areComponentAnswersCorrect(
    responseObj.answer,
    studyConfig.components[candidateComponentName.slice(0, candidateComponentName.lastIndexOf('_'))],
    studyConfig,
  ));
}

export function getStoredAnswersForSkipEvaluation(answers: Record<string, StoredAnswer>) {
  return Object.entries(answers).reduce<Record<string, SkipEvaluationAnswer>>((acc, [key, responseObj]) => {
    if (!responseObj.timedOut) {
      acc[key] = {
        answer: responseObj.answer,
        timedOut: false,
      };
    }
    return acc;
  }, {});
}

export function getConditionTargetIndex(
  condition: SkipConditions[number],
  sequence: Sequence,
  flatSequence: string[],
) {
  if (condition.to === 'end') {
    const endIndex = flatSequence.indexOf('end');
    return endIndex === -1 ? flatSequence.length : endIndex;
  }

  const targetComponentIndex = flatSequence.indexOf(condition.to);
  if (targetComponentIndex !== -1) {
    return targetComponentIndex;
  }

  const targetBlockIndex = findIndexOfBlock(sequence, condition.to);
  return targetBlockIndex === -1 ? null : targetBlockIndex;
}

export function conditionIsTriggered(
  condition: SkipConditionWithExtents,
  answersForSkipEvaluation: Record<string, SkipEvaluationAnswer>,
  studyConfig: StudyConfig,
) {
  const validationCandidates = Object.entries(answersForSkipEvaluation).reduce<Record<string, SkipEvaluationAnswer>>((acc, [key, responseObj]) => {
    const componentIndex = parseTrialOrder(key.slice(key.lastIndexOf('_') + 1)).step;
    if (componentIndex !== null && componentIndex >= condition.firstIndex && componentIndex <= condition.lastIndex) {
      acc[key] = responseObj;
    }
    return acc;
  }, {});

  const componentsToCheck = condition.check !== 'block'
    ? Object.entries(validationCandidates).filter(([key]) => key.slice(0, key.lastIndexOf('_')) === condition.name)
    : Object.entries(validationCandidates);

  if (componentsToCheck.length === 0) {
    return false;
  }
  if (componentsToCheck.some(([_, responseObj]) => !responseObj)) {
    throw new Error(`There are components with missing response objects for the skip condition: ${JSON.stringify(condition, null, 2)}`);
  }

  if (condition.check === 'response') {
    const [, response] = componentsToCheck[0];
    return condition.comparison === 'equal'
      ? condition.value === response.answer[condition.responseId]
      : condition.value !== response.answer[condition.responseId];
  }

  if (condition.check === 'responses') {
    const [componentId, response] = componentsToCheck[0];
    return !areComponentAnswersCorrect(
      response.answer,
      studyConfig.components[componentId.slice(0, componentId.lastIndexOf('_'))],
      studyConfig,
    );
  }

  if (componentsToCheck.length < condition.value) {
    return false;
  }

  const correctAnswers = getSkipConditionCorrectAnswers(componentsToCheck, studyConfig);
  const numCorrect = correctAnswers.filter((correct) => correct).length;
  const numIncorrect = correctAnswers.length - numCorrect;

  return (condition.condition === 'numCorrect' && numCorrect === condition.value)
    || (condition.condition === 'numIncorrect' && numIncorrect === condition.value);
}
