import type { ParticipantTags, Tag } from '../../analysis/individualStudy/thinkAloud/types';
import type { StorageEngine } from '../../storage/engines/types';
import type { ParticipantDataWithStatus } from '../../storage/types';
import type { StoredAnswer } from '../../store/types';
import { parseTrialOrder } from '../../utils/parseTrialOrder';

export type DownloadedTag = Pick<Tag, 'id' | 'name'>;

export interface DownloadedQualitativeCodes {
  participantTags: DownloadedTag[];
  taskTags: Record<string, DownloadedTag[]>;
}

const removeTagColor = ({ id, name }: Tag): DownloadedTag => ({ id, name });

export const createEmptyQualitativeCodes = (): DownloadedQualitativeCodes => ({
  participantTags: [],
  taskTags: {},
});

export function getAnswerIdentifier(answer: Pick<StoredAnswer, 'componentName' | 'identifier' | 'trialOrder'>) {
  return answer.identifier || `${answer.componentName}_${answer.trialOrder}`;
}

export function normalizeQualitativeCodes(
  qualitativeCodes: ParticipantTags | undefined,
  participant: ParticipantDataWithStatus,
): DownloadedQualitativeCodes {
  const storedTaskTags = Object.fromEntries(
    Object.entries(qualitativeCodes?.taskTags ?? {}).map(([identifier, tags]) => [identifier, tags.map(removeTagColor)]),
  );
  const taskTags: DownloadedQualitativeCodes['taskTags'] = {};

  Object.values(participant.answers).sort((a, b) => {
    const aOrder = parseTrialOrder(a.trialOrder);
    const bOrder = parseTrialOrder(b.trialOrder);
    const aStep = aOrder.step ?? Number.MAX_SAFE_INTEGER;
    const bStep = bOrder.step ?? Number.MAX_SAFE_INTEGER;
    const stepDiff = aStep - bStep;

    if (stepDiff !== 0) {
      return stepDiff;
    }

    return (aOrder.funcIndex ?? -1) - (bOrder.funcIndex ?? -1);
  }).forEach((answer) => {
    const identifier = getAnswerIdentifier(answer);
    taskTags[identifier] = storedTaskTags[identifier] ?? [];
  });

  Object.entries(storedTaskTags).forEach(([identifier, tags]) => {
    taskTags[identifier] ??= tags;
  });

  return {
    participantTags: qualitativeCodes?.participantTags.map(removeTagColor) ?? [],
    taskTags,
  };
}

export async function getParticipantQualitativeCodes(
  storageEngine: StorageEngine | undefined,
  authEmail: string,
  participant: ParticipantDataWithStatus,
) {
  if (!storageEngine) {
    return normalizeQualitativeCodes(undefined, participant);
  }

  try {
    const qualitativeCodes = await storageEngine.getParticipantAndTaskTags(authEmail, participant.participantId, false);
    return normalizeQualitativeCodes(qualitativeCodes, participant);
  } catch {
    return normalizeQualitativeCodes(undefined, participant);
  }
}
