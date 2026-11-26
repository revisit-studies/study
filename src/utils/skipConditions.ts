import type {
  GlobalStoreValues, IndividualComponent,
  InheritedComponent,
  SkipConditions,
  StudyConfig,
} from '../parser/types';
import type { CheckAnswerState, Sequence, StoredAnswer } from '../store/types';
import { compareResponseValues, hasResponseScorer, isResponseScorerUnavailable } from './correctAnswer';
import { componentAnswersAreCorrect } from './componentCorrectness';
import { findIndexOfBlock } from './getSequenceFlatMap';
import { studyComponentToIndividualComponent } from './handleComponentInheritance';
import { parseTrialOrder } from './parseTrialOrder';

export type SkipEvaluationAnswer = Pick<StoredAnswer, 'answer' | 'timedOut'> & {
  componentName?: StoredAnswer['componentName'];
  trialOrder?: StoredAnswer['trialOrder'];
  checkAnswer?: CheckAnswerState;
  correctAnswer?: StoredAnswer['correctAnswer'];
  store?: GlobalStoreValues;
};

export type SkipConditionWithExtents = SkipConditions[number] & {
  firstIndex: number;
  lastIndex: number;
};

function getSkipEvaluationComponentName(
  identifier: string,
  responseObj: Pick<SkipEvaluationAnswer, 'componentName' | 'trialOrder'>,
  studyConfig: StudyConfig,
) {
  if (
    responseObj.componentName
    && responseObj.trialOrder
    && parseTrialOrder(responseObj.trialOrder).funcIndex !== null
  ) {
    return responseObj.componentName;
  }

  const identifierComponentName = identifier.slice(0, identifier.lastIndexOf('_'));
  return Object.hasOwn(studyConfig.components, identifierComponentName)
    ? identifierComponentName
    : responseObj.componentName ?? identifierComponentName;
}

export function areComponentAnswersCorrect(
  answers: StoredAnswer['answer'],
  componentConfig: IndividualComponent | InheritedComponent,
  studyConfig: StudyConfig,
  checkAnswer?: CheckAnswerState,
  correctAnswers?: StoredAnswer['correctAnswer'],
  store: GlobalStoreValues = {},
) {
  const resolvedComponentConfig = studyComponentToIndividualComponent(componentConfig, studyConfig);

  const answerRules = correctAnswers ?? resolvedComponentConfig.correctAnswer;
  const hasSavedScores = Object.keys(checkAnswer?.scores ?? {}).length > 0;
  const hasConfiguredScorer = resolvedComponentConfig.response?.some((response) => (
    hasResponseScorer(response) || isResponseScorerUnavailable(response)
  ));
  if (!answerRules?.length
    && !hasConfiguredScorer
    && !hasSavedScores) {
    return true;
  }

  return componentAnswersAreCorrect(
    answers,
    answerRules,
    resolvedComponentConfig.response,
    checkAnswer,
    store,
  );
}

export function getSkipConditionCorrectAnswers(
  componentsToCheck: Array<[string, Pick<SkipEvaluationAnswer, 'answer' | 'componentName' | 'trialOrder' | 'checkAnswer' | 'correctAnswer' | 'store'>]>,
  studyConfig: StudyConfig,
) {
  return componentsToCheck.map(([candidateComponentName, responseObj]) => {
    const componentName = getSkipEvaluationComponentName(candidateComponentName, responseObj, studyConfig);
    return areComponentAnswersCorrect(
      responseObj.answer,
      studyConfig.components[componentName],
      studyConfig,
      responseObj.checkAnswer,
      responseObj.correctAnswer,
      responseObj.store,
    );
  });
}

export function getStoredAnswersForSkipEvaluation(answers: Record<string, StoredAnswer>) {
  return Object.entries(answers).reduce<Record<string, SkipEvaluationAnswer>>((acc, [key, responseObj]) => {
    if (!responseObj.timedOut && !responseObj.recordingArchived) {
      acc[key] = {
        answer: responseObj.answer,
        timedOut: false,
        componentName: responseObj.componentName,
        trialOrder: responseObj.trialOrder,
        checkAnswer: responseObj.checkAnswer,
        correctAnswer: responseObj.correctAnswer,
        store: responseObj.globalStoreEntry,
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
  store: GlobalStoreValues = {},
) {
  if (condition.check === 'globalVariable') {
    return Object.hasOwn(store, condition.variable) && compareResponseValues(store[condition.variable], condition.value, condition.comparison);
  }
  const validationCandidates = Object.entries(answersForSkipEvaluation).reduce<Record<string, SkipEvaluationAnswer>>((acc, [key, responseObj]) => {
    const componentIndex = parseTrialOrder(
      responseObj.trialOrder ?? key.slice(key.lastIndexOf('_') + 1),
    ).step;
    if (componentIndex !== null && componentIndex >= condition.firstIndex && componentIndex <= condition.lastIndex) {
      acc[key] = responseObj;
    }
    return acc;
  }, {});

  const componentsToCheck = condition.check !== 'block'
    ? Object.entries(validationCandidates).filter(([key, responseObj]) => (
      getSkipEvaluationComponentName(key, responseObj, studyConfig) === condition.name
    ))
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
    const componentName = getSkipEvaluationComponentName(componentId, response, studyConfig);
    return areComponentAnswersCorrect(
      response.answer,
      studyConfig.components[componentName],
      studyConfig,
      response.checkAnswer,
      response.correctAnswer,
      response.store,
    ) === false;
  }

  if (componentsToCheck.length < condition.value) {
    return false;
  }

  const correctAnswers = getSkipConditionCorrectAnswers(componentsToCheck, studyConfig);
  const numCorrect = correctAnswers.filter((correct) => correct === true).length;
  const numIncorrect = correctAnswers.filter((correct) => correct === false).length;

  return (condition.condition === 'numCorrect' && numCorrect === condition.value)
    || (condition.condition === 'numIncorrect' && numIncorrect === condition.value);
}
