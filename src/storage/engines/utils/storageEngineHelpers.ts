import { ParticipantData } from '../../types';
import type {
  CloudStorageEngine, SequenceAssignment, SequenceAssignmentAllocation, StorageEngine,
} from '../types';
import { StudyConfig } from '../../../parser/types';

export const SEQUENCE_ALLOCATION_ATTEMPTS = 50;

export async function waitForAllocationRetry(attempt: number) {
  // Jitter separates clients that read the same allocator version during an enrollment burst.
  const ceiling = Math.min(250, 10 * (2 ** Math.min(attempt, 5)));
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ceiling * (0.5 + Math.random() * 0.5));
  });
}

export async function retrySequenceAllocation(
  allocate: () => Promise<SequenceAssignmentAllocation | null>,
): Promise<SequenceAssignmentAllocation> {
  for (let attempt = 0; attempt < SEQUENCE_ALLOCATION_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      // eslint-disable-next-line no-await-in-loop
      await waitForAllocationRetry(attempt);
    }
    // eslint-disable-next-line no-await-in-loop
    const allocation = await allocate();
    if (allocation) {
      return allocation;
    }
  }
  throw new Error('Failed to claim a rejected sequence assignment after concurrent updates');
}

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

export function rebuildSequenceAllocator(assignments: SequenceAssignment[]) {
  return assignments.reduce((allocator, assignment) => ({
    nextSequenceIndex: Math.max(
      allocator.nextSequenceIndex,
      (assignment.sequenceIndex ?? -1) + 1,
      (assignment.reusableSequenceIndex ?? -1) + 1,
    ),
    nextCreationIndex: Math.max(allocator.nextCreationIndex, (assignment.creationIndex ?? -1) + 1),
  }), {
    nextSequenceIndex: assignments.filter((assignment) => !assignment.claimed).length,
    nextCreationIndex: assignments.length,
  });
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
