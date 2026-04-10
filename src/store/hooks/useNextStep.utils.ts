import {
  IndividualComponent, InheritedComponent, StudyConfig,
} from '../../parser/types';
import { StoredAnswer } from '../types';
import { componentAnswersAreCorrect } from '../../utils/correctAnswer';
import { studyComponentToIndividualComponent } from '../../utils/handleComponentInheritance';

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
  componentsToCheck: Array<[string, { answer: StoredAnswer['answer'] }]>,
  studyConfig: StudyConfig,
) {
  return componentsToCheck.map(([candidateComponentName, responseObj]) => areComponentAnswersCorrect(
    responseObj.answer,
    studyConfig.components[candidateComponentName.slice(0, candidateComponentName.lastIndexOf('_'))],
    studyConfig,
  ));
}
