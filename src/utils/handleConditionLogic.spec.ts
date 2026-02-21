import { describe, it, expect } from 'vitest';
import {
  parseConditionParam,
  resolveParticipantConditions,
  filterSequenceByCondition,
  getSequenceConditions,
  getConditionParticipantCounts,
} from './handleConditionLogic';
import { Sequence } from '../store/types';
import { ParticipantData } from '../storage/types';
import { QuestionnaireComponent, StudyConfig } from '../parser/types';

const components = Object.fromEntries(Array(50).fill(0).map((_, idx) => [`component_${idx}`, { type: 'questionnaire', response: [] } as QuestionnaireComponent]));

const config: StudyConfig = {
  $schema: '',
  studyMetadata: {
    title: '',
    version: '',
    authors: [],
    date: '',
    description: '',
    organizations: [],
  },
  uiConfig: {
    logoPath: '',
    contactEmail: '',
    withProgressBar: true,
    withSidebar: true,
    numSequences: 100_000,
  },
  components,
  sequence: {
    order: 'fixed',
    components: [],
    skip: [],
    interruptions: [],
  },
};

const participantData: ParticipantData = {
  participantId: 'participant-test-sequence-condition',
  participantConfigHash: 'config-hash-test-sequence-condition',
  sequence: {
    ...(config.sequence as Sequence),
    orderPath: '',
  },
  participantIndex: 0,
  answers: {},
  searchParams: {} as Record<string, string>,
  metadata: {
    userAgent: 'test',
    resolution: { width: 1600, height: 900 },
    language: '',
    ip: null,
  },
  completed: false,
  rejected: false,
  participantTags: [],
  stage: 'test-sequence-condition',
};

describe('parseConditionParam', () => {
  it('should return empty array for undefined', () => {
    expect(parseConditionParam(undefined)).toEqual([]);
  });

  it('should return empty array for null', () => {
    expect(parseConditionParam(null)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseConditionParam('')).toEqual([]);
  });

  it('should parse a single condition string', () => {
    expect(parseConditionParam('color')).toEqual(['color']);
  });

  it('should parse comma-separated conditions', () => {
    expect(parseConditionParam('color,size')).toEqual(['color', 'size']);
  });

  it('should trim whitespace around conditions', () => {
    expect(parseConditionParam('color , size , shape')).toEqual(['color', 'size', 'shape']);
  });

  it('should filter out empty conditions', () => {
    expect(parseConditionParam('color,,size')).toEqual(['color', 'size']);
  });
});

describe('filterSequenceByCondition', () => {
  const createTestSequence = (): Sequence => ({
    order: 'fixed',
    orderPath: '',
    components: [
      'intro',
      {
        order: 'random',
        orderPath: '',
        id: 'color',
        conditional: true,
        components: ['color-trial-1', 'color-trial-2'],
        skip: [],
        interruptions: [],
      },
      {
        order: 'random',
        orderPath: '',
        id: 'size',
        conditional: true,
        components: ['size-trial-1', 'size-trial-2'],
        skip: [],
        interruptions: [],
      },
      'outro',
    ],
    skip: [],
  });

  it('should return original sequence when no condition is specified', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence);
    expect(result).toEqual(sequence);
  });

  it('should return original sequence when condition is null', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, null);
    expect(result).toEqual(sequence);
  });

  it('should filter to only matching condition (color)', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, 'color');

    expect(result.components).toHaveLength(3);
    expect(result.components[0]).toBe('intro');
    expect(result.components[2]).toBe('outro');

    const colorBlock = result.components[1] as Sequence;
    expect(colorBlock.id).toBe('color');
    expect(colorBlock.conditional).toBe(true);
    expect(colorBlock.components).toEqual(['color-trial-1', 'color-trial-2']);
  });

  it('should filter to only matching condition (size)', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, 'size');

    expect(result.components).toHaveLength(3);
    expect(result.components[0]).toBe('intro');
    expect(result.components[2]).toBe('outro');

    const sizeBlock = result.components[1] as Sequence;
    expect(sizeBlock.id).toBe('size');
    expect(sizeBlock.conditional).toBe(true);
    expect(sizeBlock.components).toEqual(['size-trial-1', 'size-trial-2']);
  });

  it('should include multiple conditions with comma-separated string', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, 'color,size');

    expect(result.components).toHaveLength(4);
    expect(result.components[0]).toBe('intro');
    expect(result.components[3]).toBe('outro');

    const colorBlock = result.components[1] as Sequence;
    expect(colorBlock.id).toBe('color');
    expect(colorBlock.conditional).toBe(true);

    const sizeBlock = result.components[2] as Sequence;
    expect(sizeBlock.id).toBe('size');
    expect(sizeBlock.conditional).toBe(true);
  });

  it('should include multiple conditions when passed as an array', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, ['color', 'size']);

    expect(result.components).toHaveLength(4);
    expect(result.components[0]).toBe('intro');
    expect(result.components[3]).toBe('outro');

    const colorBlock = result.components[1] as Sequence;
    expect(colorBlock.id).toBe('color');

    const sizeBlock = result.components[2] as Sequence;
    expect(sizeBlock.id).toBe('size');
  });

  it('should exclude non-matching conditions', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, 'unknown');

    expect(result.components).toHaveLength(2);
    expect(result.components[0]).toBe('intro');
    expect(result.components[1]).toBe('outro');
  });

  it('should exclude nested condition when parent condition does not match', () => {
    const sequence: Sequence = {
      order: 'fixed',
      orderPath: '',
      components: [
        'intro',
        {
          order: 'random',
          orderPath: '',
          id: 'color',
          conditional: true,
          components: [
            {
              order: 'fixed',
              orderPath: '',
              id: 'size',
              conditional: true,
              components: ['size-trial-1'],
              skip: [],
            },
          ],
          skip: [],
        },
        'outro',
      ],
      skip: [],
    };

    const result = filterSequenceByCondition(sequence, 'size');
    expect(result.components).toHaveLength(2);
    expect(result.components[0]).toBe('intro');
    expect(result.components[1]).toBe('outro');
  });
});

describe('resolveParticipantConditions', () => {
  it('should use persisted participant conditions when URL override is disabled', () => {
    const result = resolveParticipantConditions({
      urlCondition: 'shape',
      participantConditions: ['color'],
      participantSearchParamCondition: 'size',
      allowUrlOverride: false,
    });

    expect(result).toEqual(['color']);
  });

  it('should use persisted search param condition when participant conditions are missing', () => {
    const result = resolveParticipantConditions({
      urlCondition: 'shape',
      participantConditions: undefined,
      participantSearchParamCondition: 'size',
      allowUrlOverride: false,
    });

    expect(result).toEqual(['size']);
  });

  it('should use URL condition when override is enabled', () => {
    const result = resolveParticipantConditions({
      urlCondition: 'shape,color',
      participantConditions: ['size'],
      participantSearchParamCondition: 'size',
      allowUrlOverride: true,
    });

    expect(result).toEqual(['shape', 'color']);
  });

  it('should fall back to persisted condition when URL condition is empty with override enabled', () => {
    const result = resolveParticipantConditions({
      urlCondition: '',
      participantConditions: ['size'],
      participantSearchParamCondition: 'color',
      allowUrlOverride: true,
    });

    expect(result).toEqual(['size']);
  });
});

describe('getSequenceConditions', () => {
  it('should return all unique conditions from a sequence', () => {
    const sequence: Sequence = {
      order: 'fixed',
      orderPath: '',
      components: [
        {
          order: 'random',
          orderPath: '',
          id: 'color',
          conditional: true,
          components: ['color-trial'],
          skip: [],
        },
        {
          order: 'random',
          orderPath: '',
          id: 'size',
          conditional: true,
          components: ['size-trial'],
          skip: [],
        },
      ],
      skip: [],
    };

    const conditions = getSequenceConditions(sequence);
    expect(conditions).toContain('color');
    expect(conditions).toContain('size');
    expect(conditions).toHaveLength(2);
  });

  it('should return empty array when no conditions exist', () => {
    const sequence: Sequence = {
      order: 'fixed',
      orderPath: '',
      components: ['intro', 'outro'],
      skip: [],
    };

    const conditions = getSequenceConditions(sequence);
    expect(conditions).toEqual([]);
  });

  it('should return unique conditions (no duplicates)', () => {
    const sequence: Sequence = {
      order: 'fixed',
      orderPath: '',
      components: [
        {
          order: 'random',
          orderPath: '',
          id: 'color',
          conditional: true,
          components: ['color-trial-1'],
          skip: [],
        },
        {
          order: 'random',
          orderPath: '',
          id: 'color',
          conditional: true,
          components: ['color-trial-2'],
          skip: [],
        },
      ],
      skip: [],
    };

    const conditions = getSequenceConditions(sequence);
    expect(conditions).toEqual(['color']);
  });
});

describe('getConditionParticipantCounts', () => {
  it('should count participants with no condition as default', () => {
    const participants = [
      { ...participantData, participantId: 'participant-default', searchParams: {} as Record<string, string> },
      { ...participantData, participantId: 'participant-empty', searchParams: { condition: '' } },
    ];

    expect(getConditionParticipantCounts(participants)).toEqual({
      default: 2,
    });
  });

  it('should count participants with single conditions', () => {
    const participants = [
      { ...participantData, participantId: 'participant-color', searchParams: { condition: 'color' } },
      { ...participantData, participantId: 'participant-size', searchParams: { condition: 'size' } },
    ];

    expect(getConditionParticipantCounts(participants)).toEqual({
      color: 1,
      size: 1,
    });
  });

  it('should count participants with multiple comma-separated conditions', () => {
    const participants = [
      { ...participantData, participantId: 'participant-color-size', searchParams: { condition: 'color,size' } },
      { ...participantData, participantId: 'participant-size-shape', searchParams: { condition: 'size,shape' } },
    ];

    expect(getConditionParticipantCounts(participants)).toEqual({
      color: 1,
      size: 2,
      shape: 1,
    });
  });

  it('should return empty object for empty participant list', () => {
    expect(getConditionParticipantCounts([])).toEqual({});
  });

  it('should prefer conditions over searchParams.condition', () => {
    const participants = [
      {
        ...participantData, participantId: 'participant-top-level', conditions: ['color'], searchParams: { condition: 'size' },
      },
      { ...participantData, participantId: 'participant-fallback', searchParams: { condition: 'shape' } },
    ];

    expect(getConditionParticipantCounts(participants)).toEqual({
      color: 1,
      shape: 1,
    });
  });

  it('should fall back to searchParams.condition when conditions are undefined', () => {
    const participants = [
      {
        ...participantData, participantId: 'participant-no-top-level', conditions: undefined, searchParams: { condition: 'size' },
      },
    ];

    expect(getConditionParticipantCounts(participants)).toEqual({
      size: 1,
    });
  });

  it('should count conditions with multiple values', () => {
    const participants = [
      { ...participantData, participantId: 'participant-multi', conditions: ['color', 'size'] },
    ];

    expect(getConditionParticipantCounts(participants)).toEqual({
      color: 1,
      size: 1,
    });
  });
});
