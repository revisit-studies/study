import { ParticipantData } from '../types';
import type { CloudStorageEngine, StorageEngine } from './types';
import { StudyConfig } from '../../parser/types';

export async function hash(input: string) {
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function isParticipantData(obj: unknown): obj is ParticipantData {
  const potentialParticipantData = obj as ParticipantData;
  return typeof potentialParticipantData === 'object' && potentialParticipantData && potentialParticipantData.participantId !== undefined;
}

export function isCloudStorageEngine(engine: StorageEngine | undefined): engine is CloudStorageEngine {
  return !!engine && engine.isCloudEngine();
}

export function calculateProgressData(
  answers: ParticipantData['answers'],
  flatSequence: string[],
  studyConfig: StudyConfig,
  currentStep: number | string,
  funcIndex: string | undefined,
): { total: number; answered: string[]; isDynamic: boolean } {
  const answered = Object.values(answers).filter((answer) => answer.endTime > -1).map((answer) => answer.componentName);

  const isDynamic = funcIndex !== undefined;

  const total = flatSequence.map((step) => {
    if (studyConfig.components[step]) {
      return 1;
    }

    return Object.entries(answers).filter(([key, _]) => key.includes(`${step}_`)).length;
  }).reduce((a, b) => a + b, 0);

  return { total, answered, isDynamic };
}
