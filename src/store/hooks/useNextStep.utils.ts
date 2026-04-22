import {
  ConfigResponseBlockLocation,
  IndividualComponent,
  InheritedComponent,
  Response,
  StudyConfig,
} from '../../parser/types';
import { StoredAnswer, TrialValidation } from '../types';
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

function getValidatedResponseLocations(responses: Response[]): ConfigResponseBlockLocation[] {
  const locations = new Set<ConfigResponseBlockLocation>();

  responses.forEach((response) => {
    if (response.type === 'textOnly' || response.type === 'divider' || response.type === 'reactive') {
      return;
    }

    locations.add(response.location ?? 'belowStimulus');
  });

  return [...locations];
}

export function getNextValidationState({
  componentConfig,
  currentStep,
  isAnalysis,
  validation,
}: {
  componentConfig: IndividualComponent | InheritedComponent;
  currentStep: number | string;
  isAnalysis: boolean;
  validation?: TrialValidation[string];
}) {
  if (typeof currentStep !== 'number') {
    return {
      isNextHardDisabled: true,
      isNextSoftBlocked: false,
      hardDisabledReason: 'step' as const,
    };
  }

  if (isAnalysis) {
    return {
      isNextHardDisabled: true,
      isNextSoftBlocked: false,
      hardDisabledReason: 'analysis' as const,
    };
  }

  const isStimulusInvalid = validation ? !validation.stimulus.valid : false;
  if (isStimulusInvalid) {
    return {
      isNextHardDisabled: true,
      isNextSoftBlocked: false,
      hardDisabledReason: 'stimulus' as const,
    };
  }

  const responseLocations = getValidatedResponseLocations(componentConfig.response || []);
  const isResponseInvalid = responseLocations.some(
    (location) => validation?.[location] && !validation[location].valid,
  );

  return {
    isNextHardDisabled: false,
    isNextSoftBlocked: isResponseInvalid,
    hardDisabledReason: null,
  };
}
