import { describe, it, expect } from 'vitest';
import { parseConditionParam, filterSequenceByCondition, getSequenceConditions } from './handleSequenceConditions';
import { Sequence } from '../store/types';

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

  it('should handle array input', () => {
    expect(parseConditionParam(['color', 'size'])).toEqual(['color', 'size']);
  });

  it('should trim array values', () => {
    expect(parseConditionParam([' color ', ' size '])).toEqual(['color', 'size']);
  });
});

describe('filterSequenceByCondition', () => {
  const createTestSequence = (): Sequence => ({
    order: 'fixed',
    orderPath: 'root',
    components: [
      'intro',
      {
        order: 'random',
        orderPath: 'root-1',
        condition: 'color',
        components: ['color-trial-1', 'color-trial-2'],
        skip: [],
      },
      {
        order: 'random',
        orderPath: 'root-2',
        condition: 'size',
        components: ['size-trial-1', 'size-trial-2'],
        skip: [],
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
    expect(colorBlock.condition).toBe('color');
    expect(colorBlock.components).toEqual(['color-trial-1', 'color-trial-2']);
  });

  it('should filter to only matching condition (size)', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, 'size');

    expect(result.components).toHaveLength(3);
    expect(result.components[0]).toBe('intro');
    expect(result.components[2]).toBe('outro');

    const sizeBlock = result.components[1] as Sequence;
    expect(sizeBlock.condition).toBe('size');
    expect(sizeBlock.components).toEqual(['size-trial-1', 'size-trial-2']);
  });

  it('should include multiple conditions with comma-separated string', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, 'color,size');

    expect(result.components).toHaveLength(4);
    expect(result.components[0]).toBe('intro');
    expect(result.components[3]).toBe('outro');

    const colorBlock = result.components[1] as Sequence;
    expect(colorBlock.condition).toBe('color');

    const sizeBlock = result.components[2] as Sequence;
    expect(sizeBlock.condition).toBe('size');
  });

  it('should include multiple conditions with array', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, ['color', 'size']);

    expect(result.components).toHaveLength(4);
    expect(result.components[0]).toBe('intro');
    expect(result.components[3]).toBe('outro');

    const colorBlock = result.components[1] as Sequence;
    expect(colorBlock.condition).toBe('color');

    const sizeBlock = result.components[2] as Sequence;
    expect(sizeBlock.condition).toBe('size');
  });

  it('should exclude non-matching conditions', () => {
    const sequence = createTestSequence();
    const result = filterSequenceByCondition(sequence, 'unknown');

    expect(result.components).toHaveLength(2);
    expect(result.components[0]).toBe('intro');
    expect(result.components[1]).toBe('outro');
  });
});

describe('getSequenceConditions', () => {
  it('should return all unique conditions from a sequence', () => {
    const sequence: Sequence = {
      order: 'fixed',
      orderPath: 'root',
      components: [
        {
          order: 'random',
          orderPath: 'root-0',
          condition: 'color',
          components: ['color-trial'],
          skip: [],
        },
        {
          order: 'random',
          orderPath: 'root-1',
          condition: 'size',
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
      orderPath: 'root',
      components: ['intro', 'outro'],
      skip: [],
    };

    const conditions = getSequenceConditions(sequence);
    expect(conditions).toEqual([]);
  });

  it('should return unique conditions (no duplicates)', () => {
    const sequence: Sequence = {
      order: 'fixed',
      orderPath: 'root',
      components: [
        {
          order: 'random',
          orderPath: 'root-0',
          condition: 'color',
          components: ['color-trial-1'],
          skip: [],
        },
        {
          order: 'random',
          orderPath: 'root-1',
          condition: 'color',
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
