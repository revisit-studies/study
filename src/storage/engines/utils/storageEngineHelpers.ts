import { ParticipantData } from '../../types';
import type {
  CloudStorageEngine, SequenceAssignment, StorageEngine,
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

// Contended Firestore transactions give up with one of these codes once the SDK
// has used its own attempts.
const TRANSACTION_CONTENTION_CODES = new Set(['aborted', 'failed-precondition']);

// Each contention failure has already spent several seconds in the SDK's own
// backoff, so allow only a few before reporting it.
export const SEQUENCE_ALLOCATION_CONTENTION_RETRIES = 3;

export function isTransactionContentionError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    && TRANSACTION_CONTENTION_CODES.has(String((error as { code: unknown }).code));
}

export async function retrySequenceAllocation<T>(
  allocate: () => Promise<T | null>,
): Promise<T> {
  let contentionRetries = 0;
  for (let attempt = 0; attempt < SEQUENCE_ALLOCATION_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      // eslint-disable-next-line no-await-in-loop
      await waitForAllocationRetry(attempt);
    }
    let allocation: T | null;
    try {
      // eslint-disable-next-line no-await-in-loop
      allocation = await allocate();
    } catch (error) {
      // A transaction that lost every race committed nothing, so running the
      // allocation again is safe.
      if (!isTransactionContentionError(error) || contentionRetries >= SEQUENCE_ALLOCATION_CONTENTION_RETRIES) throw error;
      contentionRetries += 1;
      allocation = null;
    }
    if (allocation) {
      return allocation;
    }
  }
  throw new Error('Failed to claim a rejected sequence assignment after concurrent updates');
}

// Every gzip stream starts with these two bytes; JSON text never does.
const GZIP_MAGIC = [0x1f, 0x8b];

/**
 * Gzips text for upload, or returns undefined where the browser cannot
 * (CompressionStream is in every current browser, but not in older ones).
 */
export async function gzipText(text: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if (typeof CompressionStream === 'undefined') return undefined;
  const compressed = new Response(new TextEncoder().encode(text)).body!.pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

/**
 * Reads a downloaded storage object as text. Objects uploaded gzipped are
 * normally decompressed by the browser, which honors their Content-Encoding;
 * this also handles one served still compressed.
 */
export async function readStorageText(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]) {
    const decompressed = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'));
    return new Response(decompressed).text();
  }
  return new TextDecoder().decode(bytes);
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

/**
 * Whether the browser is built on WebKit rather than Blink or Gecko. This
 * includes desktop Safari and every iOS and iPadOS browser, since Apple requires
 * them all to use WebKit (Chrome on iOS reports CriOS, not Chrome).
 */
export function isWebKitBrowser(userAgent: string) {
  return /AppleWebKit/.test(userAgent) && !/(Chrome|Chromium|Edg|OPR)\//.test(userAgent);
}
