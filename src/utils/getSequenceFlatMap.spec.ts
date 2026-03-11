import { describe, expect, it } from 'vitest';
import type { DynamicBlock, StudyConfig } from '../parser/types';
import type { Sequence } from '../store/types';
import {
  addPathToComponentBlock,
  findBlockForStep,
  findFuncBlock,
  findIndexOfBlock,
  getSequenceFlatMap,
  getSequenceFlatMapWithInterruptions,
} from './getSequenceFlatMap';

const dynamicBlock: DynamicBlock = {
  id: 'dynamic-step',
  order: 'dynamic',
  functionPath: 'functions/dynamic.js',
};

const componentSequence: StudyConfig['sequence'] = {
  order: 'fixed',
  components: [
    'intro',
    {
      order: 'fixed',
      components: [
        'a',
        dynamicBlock,
        {
          order: 'fixed',
          components: ['b'],
          skip: [],
        },
      ],
      skip: [],
    },
    'outro',
  ],
  interruptions: [
    {
      firstLocation: 1,
      spacing: 2,
      components: ['break-1'],
    },
  ],
  skip: [],
};

const storeSequence: Sequence = {
  id: 'root',
  orderPath: '0',
  order: 'fixed',
  components: [
    'intro',
    {
      id: 'child',
      orderPath: '0-1',
      order: 'fixed',
      components: ['a', 'b'],
      skip: [],
    },
    {
      id: 'leaf',
      orderPath: '0-2',
      order: 'fixed',
      components: ['c'],
      skip: [],
    },
  ],
  skip: [],
};

describe('getSequenceFlatMap utilities', () => {
  it('flattens nested blocks and represents dynamic blocks by id', () => {
    expect(getSequenceFlatMap(componentSequence)).toEqual([
      'intro',
      'a',
      'dynamic-step',
      'b',
      'outro',
    ]);
  });

  it('finds dynamic function blocks by id', () => {
    expect(findFuncBlock('dynamic-step', componentSequence)).toEqual(dynamicBlock);
    expect(findFuncBlock('missing-dynamic', componentSequence)).toBeUndefined();
  });

  it('flattens interruptions and excludes dynamic blocks for interruption mapping', () => {
    expect(getSequenceFlatMapWithInterruptions(componentSequence)).toEqual([
      'intro',
      'a',
      'b',
      'outro',
      'break-1',
    ]);
  });

  it('finds nested blocks by step index and by order path', () => {
    const byStep = findBlockForStep(storeSequence, 2);
    expect(byStep).not.toBeNull();
    if (!byStep) {
      throw new Error('Expected byStep block result');
    }

    expect(byStep[0].currentBlock.id).toBe('child');
    expect(byStep[0].firstIndex).toBe(1);
    expect(byStep[0].lastIndex).toBe(2);
    expect(byStep[1].currentBlock.id).toBe('root');

    const byPath = findBlockForStep(storeSequence, '0-2');
    expect(byPath).not.toBeNull();
    if (!byPath) {
      throw new Error('Expected byPath block result');
    }
    expect(byPath[0].currentBlock.id).toBe('leaf');
    expect(byPath[0].firstIndex).toBe(3);
    expect(byPath[0].lastIndex).toBe(3);

    expect(findBlockForStep(storeSequence, 100)).toBeNull();
  });

  it('finds block start indices and returns -1 when missing', () => {
    expect(findIndexOfBlock(storeSequence, 'root')).toBe(0);
    expect(findIndexOfBlock(storeSequence, 'child')).toBe(1);
    expect(findIndexOfBlock(storeSequence, 'leaf')).toBe(3);
    expect(findIndexOfBlock(storeSequence, 'missing')).toBe(-1);
  });

  it('adds deterministic order paths to strings, dynamic blocks, and nested blocks', () => {
    expect(addPathToComponentBlock('component-id', '0-0')).toBe('component-id');

    const dynamicWithPath = addPathToComponentBlock(dynamicBlock, '0-1');
    if (typeof dynamicWithPath === 'string') {
      throw new Error('Expected dynamic block object');
    }
    expect(dynamicWithPath.orderPath).toBe('0-1');
    expect(dynamicWithPath.components).toEqual([]);
    expect(dynamicWithPath.skip).toEqual([]);
    expect(dynamicWithPath.interruptions).toEqual([]);

    const nestedWithPath = addPathToComponentBlock(componentSequence, '0');
    if (typeof nestedWithPath === 'string') {
      throw new Error('Expected component block object');
    }
    expect(nestedWithPath.orderPath).toBe('0');
    expect(nestedWithPath.components).toHaveLength(3);
    const nestedChild = nestedWithPath.components[1];
    if (typeof nestedChild === 'string') {
      throw new Error('Expected nested child block object');
    }
    expect(nestedChild.orderPath).toBe('0-1');
  });
});
