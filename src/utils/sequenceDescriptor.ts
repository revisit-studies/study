import { StudyConfig } from '../parser/types';
import { Sequence } from '../store/types';
import { generateSequenceAtIndexV1 } from './handleRandomSequences';

export const COMPACT_SEQUENCE_FORMAT = 'revisit-compact-sequence';
export const COMPACT_SEQUENCE_ALGORITHM_VERSION = 1;

export type CompactSequenceDescriptor = {
  format: typeof COMPACT_SEQUENCE_FORMAT;
  version: typeof COMPACT_SEQUENCE_ALGORITHM_VERSION;
  configHash: string;
  seed: string;
  numSequences: number;
};

export type SequenceArtifact = Sequence[] | CompactSequenceDescriptor;

export function isCompactSequenceDescriptor(
  value: unknown,
): value is CompactSequenceDescriptor {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && 'format' in value
    && value.format === COMPACT_SEQUENCE_FORMAT
  );
}

export function parseCompactSequenceDescriptor(
  value: unknown,
): CompactSequenceDescriptor {
  if (!isCompactSequenceDescriptor(value)) {
    throw new Error('The stored sequence descriptor is corrupt. Republish the study sequence.');
  }

  if (value.version !== COMPACT_SEQUENCE_ALGORITHM_VERSION) {
    throw new Error(
      `Sequence descriptor version ${String(value.version)} is not supported. `
      + 'Update ReVISit or republish the study sequence.',
    );
  }

  if (
    !/^[a-f0-9]{64}$/i.test(value.configHash)
    || !/^[a-f0-9]{64}$/i.test(value.seed)
    || !Number.isInteger(value.numSequences)
    || value.numSequences <= 0
  ) {
    throw new Error('The stored sequence descriptor is corrupt. Republish the study sequence.');
  }

  return value;
}

export function createCompactSequenceDescriptor(
  configHash: string,
  config: StudyConfig,
): CompactSequenceDescriptor {
  const descriptor: CompactSequenceDescriptor = {
    format: COMPACT_SEQUENCE_FORMAT,
    version: COMPACT_SEQUENCE_ALGORITHM_VERSION,
    configHash,
    seed: configHash,
    numSequences: config.uiConfig.numSequences || 1000,
  };

  return parseCompactSequenceDescriptor(descriptor);
}

function createVersionOneRandom(seed: string) {
  /* eslint-disable no-bitwise -- Versioned PRNG requires stable 32-bit integer operations. */
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }

  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  /* eslint-enable no-bitwise */
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

function getVersionOneCycleLength(config: StudyConfig) {
  const visit = (block: StudyConfig['sequence']): number[] => {
    if (!('components' in block)) {
      return [];
    }
    const current = block.order === 'latinSquare' ? [block.components.length] : [];
    return [
      ...current,
      ...block.components.flatMap((component) => (
        typeof component === 'string' || Array.isArray(component)
          ? []
          : visit(component)
      )),
    ];
  };

  return visit(config.sequence).reduce((cycle, length) => (
    length > 0 ? (cycle * length) / greatestCommonDivisor(cycle, length) : cycle
  ), 1);
}

function resolveVersionOneSequence(
  config: StudyConfig,
  descriptor: CompactSequenceDescriptor,
  index: number,
) {
  // V1 partitions rows into deterministic Latin-square cycles. Reconstructing a
  // late assignment therefore performs at most one cycle of work instead of
  // replaying every earlier participant row.
  const cycleLength = getVersionOneCycleLength(config);
  const cycle = Math.floor(index / cycleLength);
  const indexWithinCycle = index % cycleLength;
  return generateSequenceAtIndexV1(
    config,
    indexWithinCycle,
    createVersionOneRandom(`${descriptor.seed}:${cycle}`),
  );
}

export function resolveCompactSequence(
  config: StudyConfig,
  descriptorValue: unknown,
  index: number,
): Sequence {
  const descriptor = parseCompactSequenceDescriptor(descriptorValue);
  const expectedSequenceCount = config.uiConfig.numSequences || 1000;
  if (
    descriptor.seed !== descriptor.configHash
    || descriptor.numSequences !== expectedSequenceCount
  ) {
    throw new Error(
      'The stored sequence descriptor does not match this study config. '
      + 'Republish the study sequence.',
    );
  }
  if (!Number.isInteger(index) || index < 0 || index >= descriptor.numSequences) {
    throw new Error(
      `Sequence index ${index} is outside the descriptor range of `
      + `${descriptor.numSequences} sequences.`,
    );
  }

  switch (descriptor.version) {
    case 1:
      return resolveVersionOneSequence(config, descriptor, index);
    default:
      throw new Error(
        `Sequence descriptor version ${String(descriptor.version)} is not supported. `
        + 'Update ReVISit or republish the study sequence.',
      );
  }
}

export function expandCompactSequence(
  config: StudyConfig,
  descriptorValue: unknown,
): Sequence[] {
  const descriptor = parseCompactSequenceDescriptor(descriptorValue);
  const configWithDescriptorCount: StudyConfig = {
    ...config,
    uiConfig: {
      ...config.uiConfig,
      numSequences: descriptor.numSequences,
    },
  };

  switch (descriptor.version) {
    case 1:
      return Array.from(
        { length: descriptor.numSequences },
        (_, index) => resolveVersionOneSequence(configWithDescriptorCount, descriptor, index),
      );
    default:
      throw new Error(
        `Sequence descriptor version ${String(descriptor.version)} is not supported. `
        + 'Update ReVISit or republish the study sequence.',
      );
  }
}
