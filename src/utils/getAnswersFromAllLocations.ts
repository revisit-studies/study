import type { Response } from '../parser/types';
import { StoredAnswer, TrialValidation, ValidationStatus } from '../store/types';

const OTHER_ANSWER_SUFFIX = '-other';

function isOtherSelected(value: StoredAnswer['answer'][string] | undefined) {
  return value === 'other' || (Array.isArray(value) && value.includes('__other'));
}

export function getResponseIdsWithOther(responses: Response[] = []) {
  return responses
    .filter((response) => (response.type === 'radio' || response.type === 'checkbox') && response.withOther)
    .map((response) => response.id);
}

// Merge the answer values from all locations of a trial's validation entry into a single answer object
export function getAnswersFromAllLocations(
  trialValidationEntry: TrialValidation[string] | undefined,
  responseIdsWithOther: string[] = [],
): StoredAnswer['answer'] {
  if (!trialValidationEntry) {
    return {};
  }
  const answers = Object.values(trialValidationEntry).reduce((acc, curr) => {
    if (Object.hasOwn(curr, 'values')) {
      return { ...acc, ...(curr as ValidationStatus).values };
    }
    return acc;
  }, {}) as StoredAnswer['answer'];

  const answersWithoutInactiveOther = Object.fromEntries(
    Object.entries(answers).filter(([key]) => {
      if (!key.endsWith(OTHER_ANSWER_SUFFIX)) {
        return true;
      }

      const responseId = key.slice(0, -OTHER_ANSWER_SUFFIX.length);
      if (!responseIdsWithOther.includes(responseId)) {
        return true;
      }

      return isOtherSelected(answers[responseId]);
    }),
  );

  return structuredClone(answersWithoutInactiveOther);
}
