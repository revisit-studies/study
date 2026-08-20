import { describe, expect, test } from 'vitest';
import type { ComponentBlock } from '../../parser/types';
import type { Sequence } from '../../store/types';
import {
  addPathToComponentBlock,
  findBlockForStep,
  findFuncBlock,
  findIndexOfBlock,
  getSequenceFlatMap,
  getSequenceFlatMapWithInterruptions,
} from '../getSequenceFlatMap';

const seq = (components: (string | Sequence)[], extra: Omit<Partial<Sequence>, 'components'> = {}): Sequence => ({
  order: 'fixed',
  orderPath: 'root',
  skip: [],
  components,
  ...extra,
});

const cb = (components: ComponentBlock['components'], extra: Omit<Partial<ComponentBlock>, 'components'> = {}): ComponentBlock => ({
  order: 'fixed',
  components,
  ...extra,
});

describe('getSequenceFlatMap', () => {
  test('returns a flat list of component names from a simple sequence', () => {
    expect(getSequenceFlatMap(seq(['intro', 'trial1', 'end']))).toEqual(['intro', 'trial1', 'end']);
  });

  test('recursively flattens nested sequences', () => {
    const nested = seq(['q1', 'q2'], { orderPath: 'root-0' });
    expect(getSequenceFlatMap(seq(['intro', nested, 'end']))).toEqual(['intro', 'q1', 'q2', 'end']);
  });

  test('returns [id] for a dynamic block', () => {
    const dynBlock = {
      order: 'dynamic' as const, id: 'func1', skip: [], orderPath: 'root', components: [],
    };
    expect(getSequenceFlatMap(dynBlock)).toEqual(['func1']);
  });
});

describe('getSequenceFlatMapWithInterruptions', () => {
  test('returns components including interruption components', () => {
    const sequence = cb(['trial1'], {
      interruptions: [{ components: ['int1', 'int2'] }] as ComponentBlock['interruptions'],
    });
    const result = getSequenceFlatMapWithInterruptions(sequence);
    expect(result).toContain('trial1');
    expect(result).toContain('int1');
    expect(result).toContain('int2');
  });

  test('returns empty array for a dynamic block', () => {
    const dynBlock = { order: 'dynamic' as const, id: 'f1', functionPath: 'f.js' };
    expect(getSequenceFlatMapWithInterruptions(dynBlock)).toEqual([]);
  });

  test('handles sequences with no interruptions', () => {
    const result = getSequenceFlatMapWithInterruptions(cb(['a', 'b']));
    expect(result).toEqual(['a', 'b']);
  });
});

describe('findFuncBlock', () => {
  test('returns the dynamic block with the matching id', () => {
    const dynBlock = { order: 'dynamic' as const, id: 'myFunc', functionPath: 'func.js' };
    const sequence = cb([dynBlock]);
    const found = findFuncBlock('myFunc', sequence);
    expect(found).toBe(dynBlock);
  });

  test('returns undefined when no block with that id exists', () => {
    expect(findFuncBlock('nonexistent', cb(['a']))).toBeUndefined();
  });
});

describe('findBlockForStep', () => {
  test('returns null when the step is out of range', () => {
    expect(findBlockForStep(seq(['a', 'b']), 5)).toBeNull();
  });

  test('returns block info array for a valid step index', () => {
    const result = findBlockForStep(seq(['a', 'b', 'c']), 1);
    expect(result).not.toBeNull();
    expect(result![0].currentBlock).toBeDefined();
  });

  test('returns block info for a matching orderPath string', () => {
    const inner = seq(['x', 'y'], { orderPath: 'inner-path' });
    const result = findBlockForStep(seq(['a', inner, 'b']), 'inner-path');
    expect(result).not.toBeNull();
  });
});

describe('findIndexOfBlock', () => {
  test('returns -1 when the block id is not found', () => {
    expect(findIndexOfBlock(seq(['a', 'b']), 'missing')).toBe(-1);
  });

  test('returns 0 when the root sequence itself has the target id', () => {
    const root = seq(['a'], { id: 'root-id' });
    expect(findIndexOfBlock(root, 'root-id')).toBe(0);
  });

  test('returns the flat index of a nested sequence', () => {
    const inner = seq(['x', 'y'], { id: 'inner', orderPath: 'r-1' });
    const root = seq(['a', inner, 'b']);
    expect(findIndexOfBlock(root, 'inner')).toBe(1);
  });
});

describe('addPathToComponentBlock', () => {
  test('returns string components unchanged', () => {
    expect(addPathToComponentBlock('trial1', 'some-path')).toBe('trial1');
  });

  test('adds orderPath to a sequence block and recurses into components', () => {
    const result = addPathToComponentBlock(seq(['a', 'b']), 'my-path');
    expect(result).toHaveProperty('orderPath', 'my-path');
  });

  test('handles a dynamic block by returning it with the given orderPath and empty arrays', () => {
    const dyn = {
      order: 'dynamic' as const, id: 'f', skip: [], orderPath: '', components: [],
    };
    const result = addPathToComponentBlock(dyn, 'dyn-path');
    expect(result).toHaveProperty('orderPath', 'dyn-path');
  });
});
