import type { ParticipantData } from '../parser/types';
import type { StoredAnswer } from './types';
import { parseTrialOrder } from '../utils/parseTrialOrder';

/** Reset later active/draft answers without changing their randomized assignment. */
export function projectGlobalStoreAnswers(answers: ParticipantData['answers'], answer: StoredAnswer, replaceLater: boolean) {
  const result = structuredClone(answers);
  const currentOrder = parseTrialOrder(answer.trialOrder);
  if (currentOrder.step === null) throw new Error('Cannot submit an unresolved trial.');
  const currentStep = currentOrder.step;
  if (replaceLater) {
    Object.entries(result).forEach(([identifier, candidate]) => {
      const order = parseTrialOrder(candidate.trialOrder);
      if (order.step === null || order.step < currentStep || (order.step === currentStep && (order.funcIndex ?? -1) <= (currentOrder.funcIndex ?? -1))) return;
      if (order.funcIndex !== null) delete result[identifier];
      else {
        result[identifier] = {
          ...candidate,
          globalStoreEntry: undefined,
          assetIdentifier: undefined,
          answer: {},
          incorrectAnswers: {},
          startTime: 0,
          endTime: -1,
          windowEvents: [],
          timedOut: false,
          helpButtonClickedCount: 0,
          checkAnswer: undefined,
          responseSubmitAttempted: false,
        };
      }
    });
  }
  result[answer.identifier] = answer;
  return result;
}
