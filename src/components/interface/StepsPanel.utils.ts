import type { ParticipantData } from '../../parser/types';
import type { Sequence } from '../../store/types';

export function getDynamicComponentsForBlock(
  node: Sequence,
  participantAnswers: ParticipantData['answers'],
  index: number,
) {
  if (node.order !== 'dynamic') {
    return [];
  }

  return Object.entries(participantAnswers)
    .filter(([key]) => key.startsWith(`${node.id}_${index}_`))
    .map(([_, value]) => value.componentName);
}
