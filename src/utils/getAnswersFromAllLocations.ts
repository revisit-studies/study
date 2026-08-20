import { StoredAnswer, TrialValidation, ValidationStatus } from '../store/types';

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
