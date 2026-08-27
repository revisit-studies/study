import type { Response } from '../parser/types';
import { StoredAnswer, TrialValidation, ValidationStatus } from '../store/types';

const OTHER_ANSWER_SUFFIX = '-other';

function isOtherSelected(value: StoredAnswer['answer'][string] | undefined) {
  return value === 'other' || (Array.isArray(value) && value.includes('__other'));
}

// Merge the answer values from all locations of a trial's validation entry into a single answer object
export function getAnswersFromAllLocations(trialValidationEntry: TrialValidation[string] | undefined): StoredAnswer['answer'] {
  if (!trialValidationEntry) {
    return {};
  }
  const answers = Object.values(trialValidationEntry).reduce((acc, curr) => {
    if (Object.hasOwn(curr, 'values')) {
      return { ...acc, ...(curr as ValidationStatus).values };
    }
    return acc;
  }, {}) as StoredAnswer['answer'];

  return structuredClone(answers);
}

export function getPersistedAnswersFromAllLocations(
  trialValidationEntry: TrialValidation[string] | undefined,
  responses: Response[] = [],
): StoredAnswer['answer'] {
  const answers = getAnswersFromAllLocations(trialValidationEntry);
  const responseIds = new Set(responses.map((response) => response.id));
  const responseIdsWithOther = new Set(
    responses
      .filter((response) => (response.type === 'radio' || response.type === 'checkbox') && response.withOther)
      .map((response) => response.id),
  );

  const persistedAnswers = Object.fromEntries(
    Object.entries(answers).filter(([key]) => {
      if (!key.endsWith(OTHER_ANSWER_SUFFIX)) {
        return true;
      }

      if (responseIds.has(key)) {
        return true;
      }

      const responseId = key.slice(0, -OTHER_ANSWER_SUFFIX.length);
      if (!responseIdsWithOther.has(responseId)) {
        return true;
      }

      return isOtherSelected(answers[responseId]);
    }),
  );

  return structuredClone(persistedAnswers);
}
