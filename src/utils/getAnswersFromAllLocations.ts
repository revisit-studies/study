import { normalizeResponseAnswerValues, resolveResponseVisibility } from './responseVisibility';
import { getSavedScoresForAnswer } from './correctAnswer';
import type { Answer, GlobalStoreValues, Response } from '../parser/types';
import type {
  CheckAnswerState, StoredAnswer, TrialValidation, ValidationStatus,
} from '../store/types';

export function getPersistedAnswerValues(
  currentAnswers: StoredAnswer['answer'],
  responses: Response[] = [],
  correctAnswers: Answer[] = [],
  checkAnswer?: CheckAnswerState,
  store: GlobalStoreValues = {},
): StoredAnswer['answer'] {
  const normalizedAnswers = normalizeResponseAnswerValues(currentAnswers, responses);
  const persistedScores = getSavedScoresForAnswer(checkAnswer, normalizedAnswers);
  const { answers } = resolveResponseVisibility(responses, normalizedAnswers, {}, correctAnswers, persistedScores, store);
  return structuredClone(normalizeResponseAnswerValues(answers, responses));
}

// Merge the answer values from all locations of a trial's validation entry into a single answer object
export function getAnswersFromAllLocations(trialValidationEntry: TrialValidation[string] | undefined): StoredAnswer['answer'] {
  if (!trialValidationEntry) {
    return {};
  }
  const answers = Object.values(trialValidationEntry).reduce((acc, curr) => {
    if (curr && typeof curr === 'object' && Object.hasOwn(curr, 'values')) {
      return { ...acc, ...(curr as ValidationStatus).values };
    }
    return acc;
  }, {}) as StoredAnswer['answer'];

  return structuredClone(answers);
}

export function getPersistedAnswersFromAllLocations(
  trialValidationEntry: TrialValidation[string] | undefined,
  responses: Response[] = [],
  correctAnswers: Answer[] = [],
  checkAnswer?: CheckAnswerState,
  store: GlobalStoreValues = {},
): StoredAnswer['answer'] {
  return getPersistedAnswerValues(
    getAnswersFromAllLocations(trialValidationEntry),
    responses,
    correctAnswers,
    checkAnswer,
    store,
  );
}
