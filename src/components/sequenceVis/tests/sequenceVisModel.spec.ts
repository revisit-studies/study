import { describe, expect, test } from 'vitest';
import type { StudyConfig } from '../../../parser/types';
import type { FactorCompiledBlock } from '../../../parser/utils';
import type { Sequence } from '../../../store/types';
import {
  buildSequenceVisualization, getFactorExpressionDetails, layoutSequenceVisualization,
} from '../sequenceVisModel';

const factorBlock: FactorCompiledBlock = {
  id: 'trials',
  order: 'random',
  numSamples: 1,
  components: [],
  __revisitFactor: {
    factor: 'difficulty',
    baseComponents: ['trial'],
    conditionComponents: {
      'trials__difficulty=easy': ['trials__difficulty=easy__trial'],
      'trials__difficulty=hard': ['trials__difficulty=hard__trial'],
    },
    order: 'random',
    numSamples: 1,
    hasRuntimeOrder: false,
    hasRuntimeSample: false,
  },
};

const configuredSequence: StudyConfig['sequence'] = {
  order: 'fixed',
  components: [
    'intro',
    factorBlock,
    { order: 'dynamic', id: 'follow-up', functionPath: 'study/dynamic.ts' },
  ],
};

const participantSequence: Sequence = {
  id: 'root',
  orderPath: 'root',
  order: 'fixed',
  skip: [],
  components: [
    'intro',
    {
      id: 'trials',
      orderPath: 'root-1',
      order: 'random',
      skip: [],
      components: ['trials__difficulty=easy__trial'],
    },
    {
      id: 'follow-up',
      orderPath: 'root-2',
      order: 'dynamic',
      skip: [],
      components: [],
    },
  ],
};

describe('sequence visualization model', () => {
  test('keeps design factors compact and retains dynamic blocks', () => {
    const root = buildSequenceVisualization(
      configuredSequence,
      participantSequence,
      { difficulty: ['easy', 'hard'] },
      'design',
      false,
    );
    const factor = root.children[1];

    expect(factor).toMatchObject({
      kind: 'factor',
      label: 'trials',
      totalConditions: 2,
      selectedConditions: 1,
      children: [],
    });
    expect(root.children[2]).toMatchObject({ kind: 'dynamic', label: 'follow-up' });
  });

  test('shows selected and unselected conditions in an expanded design', () => {
    const root = buildSequenceVisualization(
      configuredSequence,
      participantSequence,
      { difficulty: ['easy', 'hard'] },
      'design',
      true,
    );
    const conditions = root.children[1].children;

    expect(conditions.map(({ label }) => label)).toEqual([
      'difficulty = easy',
      'difficulty = hard',
    ]);
    expect(conditions.map(({ active }) => active)).toEqual([true, false]);
    expect(conditions[0].children[0]).toMatchObject({ kind: 'component', active: true });
  });

  test('participant view displays only realized factor conditions', () => {
    const root = buildSequenceVisualization(
      configuredSequence,
      participantSequence,
      { difficulty: ['easy', 'hard'] },
      'participant',
      false,
    );
    const factor = root.children[1];

    expect(factor.kind).toBe('factor');
    expect(factor.children).toHaveLength(1);
    expect(factor.children[0]).toMatchObject({ label: 'difficulty = easy', active: true });
  });

  test('describes nested factor actions', () => {
    const detail = getFactorExpressionDetails({
      action: 'sample',
      factors: [{ action: 'cross', factors: ['difficulty', 'interface'] }],
      numSamples: 2,
      samplingStrategy: 'withoutReplacement',
    }, {
      difficulty: ['easy', 'hard'],
      interface: ['chart', 'table'],
    });

    expect(detail).toMatchObject({ action: 'sample', summary: '2 without replacement' });
    expect(detail.children[0]).toMatchObject({ action: 'cross' });
    expect(detail.children[0].children).toHaveLength(2);
  });

  test('computes stable, compact dimensions from the tree depth and width', () => {
    const root = buildSequenceVisualization(
      configuredSequence,
      participantSequence,
      { difficulty: ['easy', 'hard'] },
      'design',
      true,
    );
    const layout = layoutSequenceVisualization(root, 640);

    expect(layout.width).toBeGreaterThanOrEqual(640);
    expect(layout.height).toBeGreaterThan(100);
    expect(layout.height).toBeLessThan(200);
    expect(layout.nodes.map(({ key }) => key)).toContain('root-1');
    expect(layout.edges).toHaveLength(layout.nodes.length - 1);
  });
});
