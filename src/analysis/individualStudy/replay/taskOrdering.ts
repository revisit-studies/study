import { StoredAnswer } from '../../../parser/types';
import { parseTrialOrder } from '../../../utils/parseTrialOrder';

export type ReplayAnswerEntry = [string, StoredAnswer];
export type ReplayTaskOrder = 'sequence' | 'answer-time';

export function compareReplayAnswerEntries(a: ReplayAnswerEntry, b: ReplayAnswerEntry) {
  const aOrder = parseTrialOrder(a[1].trialOrder);
  const bOrder = parseTrialOrder(b[1].trialOrder);

  if (aOrder.step !== bOrder.step) {
    return (aOrder.step ?? Number.MAX_SAFE_INTEGER) - (bOrder.step ?? Number.MAX_SAFE_INTEGER);
  }

  if (aOrder.funcIndex !== bOrder.funcIndex) {
    return (aOrder.funcIndex ?? -1) - (bOrder.funcIndex ?? -1);
  }

  return a[0].localeCompare(b[0]);
}

export function orderedReplayAnswerEntries(
  answers: Record<string, StoredAnswer> = {},
  taskOrder: ReplayTaskOrder = 'sequence',
) {
  const entries = Object.entries(answers);

  if (taskOrder === 'answer-time') {
    const completed = entries
      .filter(([, answer]) => answer.startTime !== 0)
      .sort((a, b) => a[1].startTime - b[1].startTime || compareReplayAnswerEntries(a, b));
    const incomplete = entries
      .filter(([, answer]) => answer.startTime === 0)
      .sort(compareReplayAnswerEntries);

    return [...completed, ...incomplete];
  }

  return entries.sort(compareReplayAnswerEntries);
}
