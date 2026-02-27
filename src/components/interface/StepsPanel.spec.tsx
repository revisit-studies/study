import {
  describe, expect, test,
} from 'vitest';
import { Sequence, StoredAnswer } from '../../store/types';
import { getDynamicComponentsForBlock } from './StepsPanel.utils';

describe('StepsPanel tree walking', () => {
  test('does not append answer-derived components for non-dynamic blocks', () => {
    const block: Sequence = {
      id: 'drawing100m',
      order: 'fixed',
      orderPath: 'root-0',
      components: ['drawing100m', 'drawingFollowUp100M'],
      skip: [],
      interruptions: [],
    };

    const participantAnswers = {
      drawing100m_3: {
        componentName: 'drawing100m',
      } as StoredAnswer,
    };

    expect(getDynamicComponentsForBlock(block, participantAnswers, 3)).toEqual([]);
  });

  test('appends answer-derived components for dynamic blocks', () => {
    const block: Sequence = {
      id: 'dynamicDrawing',
      order: 'dynamic',
      orderPath: 'root-0',
      components: [],
      skip: [],
      interruptions: [],
    };

    const participantAnswers = {
      dynamicDrawing_2_generatedA_0: {
        componentName: 'generatedA',
      } as StoredAnswer,
      dynamicDrawing_2_generatedB_1: {
        componentName: 'generatedB',
      } as StoredAnswer,
    };

    expect(getDynamicComponentsForBlock(block, participantAnswers, 2)).toEqual(['generatedA', 'generatedB']);
  });
});
