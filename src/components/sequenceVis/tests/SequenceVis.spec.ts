import { describe, expect, test } from 'vitest';
import type {
  ComponentBlock, FactorBlock, StudyConfig,
} from '../../../parser/types';
import {
  getSequenceLayout,
  isNonFactoredComponentSequence,
} from '../SequenceVis';

const fixedSequence: ComponentBlock = {
  order: 'fixed',
  components: ['intro', {
    id: 'trials',
    order: 'random',
    numSamples: 1,
    components: ['trial-a', 'trial-b'],
  }, 'end'],
};

describe('sequence visualization layout', () => {
  test('recognizes component-block sequences and rejects factor blocks', () => {
    const factorSequence: FactorBlock = {
      type: 'factor',
      id: 'factor-trials',
      factor: 'condition',
      components: 'trial',
    };

    expect(isNonFactoredComponentSequence(fixedSequence)).toBe(true);
    expect(isNonFactoredComponentSequence(factorSequence)).toBe(false);
  });

  test('rejects component-block sequences containing a nested factor block', () => {
    const nestedFactorSequence: StudyConfig['sequence'] = {
      order: 'fixed',
      components: [
        'intro',
        {
          type: 'factor',
          id: 'factor-trials',
          factor: 'condition',
          components: 'trial',
        },
      ],
    };

    expect(isNonFactoredComponentSequence(nestedFactorSequence)).toBe(false);
  });

  test('lays out nested blocks without changing component names', () => {
    const [blocks, arrows] = getSequenceLayout(fixedSequence, 900);

    expect(blocks.map(({ component }) => (
      typeof component === 'string' ? component : component.id
    ))).toEqual(['intro', 'trials', 'trial-a', 'trial-b', 'end']);
    expect(blocks.map(({ id }) => id)).toEqual([
      'root_0',
      'trials',
      'root_1_0',
      'root_1_1',
      'root_2',
    ]);
    expect(arrows).toHaveLength(0);
  });

  test('marks components outside numSamples as inactive', () => {
    const nestedSequence = fixedSequence.components[1] as ComponentBlock;
    const [blocks] = getSequenceLayout(nestedSequence, 600);

    expect(blocks.map(({ active }) => active)).toEqual([true, false]);
  });
});
