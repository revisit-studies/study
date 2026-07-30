import {
  describe, expect, test,
} from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LibraryConfig, StudyConfig } from '../../parser/types';
import { expandLibrarySequences } from '../../parser/libraryParser';
import {
  COMPACT_SEQUENCE_ALGORITHM_VERSION,
  createCompactSequenceDescriptor,
  expandCompactSequence,
  parseCompactSequenceDescriptor,
  resolveCompactSequence,
} from '../sequenceDescriptor';

const configHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const config: StudyConfig = {
  $schema: '',
  studyMetadata: {
    title: 'Compact sequence test',
    version: '1',
    authors: [],
    date: '',
    description: '',
    organizations: [],
  },
  uiConfig: {
    logoPath: '',
    contactEmail: '',
    withProgressBar: true,
    withSidebar: false,
    numSequences: 12,
  },
  components: {
    a: { type: 'questionnaire', response: [] },
    b: { type: 'questionnaire', response: [] },
    c: { type: 'questionnaire', response: [] },
    break: { type: 'questionnaire', response: [] },
    finish: { type: 'questionnaire', response: [] },
  },
  sequence: {
    id: 'root',
    order: 'latinSquare',
    components: [
      {
        id: 'random-trials',
        order: 'random',
        numSamples: 2,
        components: ['a', 'b', 'c'],
        interruptions: [{
          spacing: 'random',
          numInterruptions: 1,
          components: ['break'],
        }],
        conditional: true,
      },
      {
        id: 'dynamic-trials',
        order: 'dynamic',
        functionPath: 'test/dynamic.js',
      },
      'finish',
    ],
  },
};

describe('compact sequence descriptors', () => {
  test('reproduces every legacy expanded row without storing the expanded array', () => {
    const descriptor = createCompactSequenceDescriptor(configHash, config);
    const legacyExpandedArray = expandCompactSequence(config, descriptor);

    legacyExpandedArray.forEach((legacySequence, index) => {
      expect(resolveCompactSequence(config, descriptor, index)).toEqual(legacySequence);
      expect(resolveCompactSequence(config, descriptor, index)).toEqual(legacySequence);
    });

    expect(descriptor).toEqual({
      format: 'revisit-compact-sequence',
      version: COMPACT_SEQUENCE_ALGORITHM_VERSION,
      configHash,
      seed: configHash,
      numSequences: 12,
    });
    expect(JSON.stringify(descriptor).length).toBeLessThan(
      JSON.stringify(legacyExpandedArray).length / 10,
    );
  });

  test('locks version one ordering for nested, conditional, dynamic, and interrupted blocks', () => {
    const descriptor = createCompactSequenceDescriptor(configHash, config);
    const summarizeComponents = (sequence: ReturnType<typeof resolveCompactSequence>) => (
      sequence.components.map((component) => (
        typeof component === 'string'
          ? component
          : `${component.id}[${component.components.join(',')}]`
      ))
    );
    const selectedSequences = [
      resolveCompactSequence(config, descriptor, 0),
      resolveCompactSequence(config, descriptor, 5),
      resolveCompactSequence(config, descriptor, 11),
    ];

    expect(selectedSequences.map(summarizeComponents)).toEqual([
      ['dynamic-trials[]', 'finish', 'random-trials[b,break,c]', 'end'],
      ['finish', 'dynamic-trials[]', 'random-trials[a,break,c]', 'end'],
      ['random-trials[b,break,c]', 'dynamic-trials[]', 'finish', 'end'],
    ]);
    expect(selectedSequences[0].components[2]).toMatchObject({
      conditional: true,
      interruptions: [{
        spacing: 'random',
        numInterruptions: 1,
        components: ['break'],
      }],
    });
  });

  test('rejects unsupported and corrupt descriptor versions with actionable errors', () => {
    const descriptor = createCompactSequenceDescriptor(configHash, config);

    expect(() => parseCompactSequenceDescriptor({
      ...descriptor,
      version: 2,
    })).toThrow('Sequence descriptor version 2 is not supported');
    expect(() => parseCompactSequenceDescriptor({
      ...descriptor,
      seed: 'not-a-valid-seed',
    })).toThrow('stored sequence descriptor is corrupt');
    expect(() => resolveCompactSequence(config, descriptor, 12)).toThrow(
      'outside the descriptor range',
    );
  });

  test('is materially smaller than the expanded library-calvi sequence artifact', () => {
    const calviStudy = JSON.parse(readFileSync(
      resolve(process.cwd(), 'public/library-calvi/config.json'),
      'utf8',
    )) as StudyConfig;
    const calviLibrary = JSON.parse(readFileSync(
      resolve(process.cwd(), 'public/libraries/calvi/config.json'),
      'utf8',
    )) as LibraryConfig;
    const expandedConfig: StudyConfig = {
      ...calviStudy,
      sequence: expandLibrarySequences(
        calviStudy.sequence,
        { calvi: calviLibrary },
      ),
    };
    const descriptor = createCompactSequenceDescriptor(configHash, expandedConfig);
    const expandedBytes = new TextEncoder().encode(
      JSON.stringify(expandCompactSequence(expandedConfig, descriptor)),
    ).byteLength;
    const descriptorBytes = new TextEncoder().encode(
      JSON.stringify(descriptor),
    ).byteLength;

    expect(descriptorBytes).toBeLessThan(expandedBytes / 100);
  });
});
