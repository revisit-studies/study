import { StudyConfig } from '../parser/types';
import { Sequence } from '../store/types';
import {
  generateSequenceArray,
  generateSequenceAtIndex,
} from './handleRandomSequences';

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
  let state = Number.parseInt(seed.slice(0, 8), 16) >>> 0;

  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  /* eslint-enable no-bitwise */
}

export function resolveCompactSequence(
  config: StudyConfig,
  descriptorValue: unknown,
  index: number,
): Sequence {
  const descriptor = parseCompactSequenceDescriptor(descriptorValue);
  if (!Number.isInteger(index) || index < 0 || index >= descriptor.numSequences) {
    throw new Error(
      `Sequence index ${index} is outside the descriptor range of `
      + `${descriptor.numSequences} sequences.`,
    );
  }

  switch (descriptor.version) {
    case 1:
      return generateSequenceAtIndex(config, index, createVersionOneRandom(descriptor.seed));
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
      return generateSequenceArray(
        configWithDescriptorCount,
        createVersionOneRandom(descriptor.seed),
      );
    default:
      throw new Error(
        `Sequence descriptor version ${String(descriptor.version)} is not supported. `
        + 'Update ReVISit or republish the study sequence.',
      );
  }
}
