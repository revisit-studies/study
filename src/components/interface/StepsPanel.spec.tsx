import {
  describe, expect, test,
} from 'vitest';
import type { StudyConfig } from '../../parser/types';
import { Sequence, StoredAnswer } from '../../store/types';
import {
  formatSkipConditionSummary,
  getDynamicComponentsForBlock,
  getSkipConditionSummariesForBlock,
  getSkippedTrialOrders,
} from './StepsPanel.utils';

function buildStoredAnswer(
  componentName: string,
  trialOrder: number,
  answer: StoredAnswer['answer'],
): StoredAnswer {
  return {
    answer,
    identifier: `${componentName}_${trialOrder}`,
    componentName,
    trialOrder: `${trialOrder}`,
    incorrectAnswers: {},
    startTime: 1,
    endTime: 2,
    windowEvents: [],
    timedOut: false,
    helpButtonClickedCount: 0,
    parameters: {},
    correctAnswer: [],
    optionOrders: {},
    questionOrders: {},
  };
}

function buildStudyConfig(sequence: Sequence): StudyConfig {
  return {
    $schema: 'https://raw.githubusercontent.com/revisit-studies/study/v2.4.3/src/parser/StudyConfigSchema.json',
    studyMetadata: {
      title: 'Study browser skip logic test',
      description: 'Test config',
      version: '1.0.0',
      authors: ['ReVISit'],
      date: '2026-06-10',
      organizations: ['ReVISit'],
    },
    uiConfig: {
      contactEmail: 'test@example.com',
      logoPath: 'revisitAssets/revisitLogoSquare.svg',
      withSidebar: true,
      withProgressBar: true,
    },
    components: {
      trial1: {
        type: 'questionnaire',
        response: [{
          id: 'q1',
          type: 'radio',
          prompt: 'Question',
          location: 'belowStimulus',
          options: ['Blue', 'Red'],
        }],
        correctAnswer: [{
          id: 'q1',
          answer: 'Blue',
        }],
      },
      middle: {
        type: 'markdown',
        path: 'test-skip-logic/continuingComponent.md',
        response: [],
      },
      targetComponent: {
        type: 'markdown',
        path: 'test-skip-logic/targetComponent.md',
        response: [],
      },
      '$testLib.components.libraryQuestion': {
        type: 'questionnaire',
        response: [{
          id: 'q1',
          type: 'radio',
          prompt: 'Library question',
          location: 'belowStimulus',
          options: ['Yes', 'No'],
        }],
        correctAnswer: [{
          id: 'q1',
          answer: 'Yes',
        }],
      },
    },
    sequence: sequence as StudyConfig['sequence'],
  };
}

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

  test('does not include answers from similarly prefixed indices', () => {
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
      dynamicDrawing_20_generatedWrong_0: {
        componentName: 'generatedWrong',
      } as StoredAnswer,
    };

    expect(getDynamicComponentsForBlock(block, participantAnswers, 2)).toEqual(['generatedA']);
  });
});

describe('StepsPanel skip summaries', () => {
  test('formats response skip conditions with target text', () => {
    expect(formatSkipConditionSummary({
      name: 'trial1',
      check: 'response',
      responseId: 'q1',
      comparison: 'notEqual',
      value: 'Blue',
      to: 'targetComponent',
    })).toBe('If trial1.q1 does not equal "Blue", skip to targetComponent.');
  });

  test('formats responses skip conditions with normal end target text', () => {
    expect(formatSkipConditionSummary({
      name: 'trial1',
      check: 'responses',
      to: 'end',
    })).toBe('If trial1 does not match its correct answers, skip to the end of the study.');
  });

  test('formats block and repeated component skip conditions', () => {
    expect(formatSkipConditionSummary({
      check: 'block',
      condition: 'numIncorrect',
      value: 2,
      to: 'targetComponent',
    })).toBe('If this block has 2 incorrect component responses, skip to targetComponent.');

    expect(formatSkipConditionSummary({
      name: 'trial1',
      check: 'repeatedComponent',
      condition: 'numCorrect',
      value: 1,
      to: 'end',
    })).toBe('If trial1 has 1 correct repeated response, skip to the end of the study.');
  });

  test('combines all possible skip conditions for one block', () => {
    const block: Sequence = {
      order: 'fixed',
      orderPath: 'root-0',
      components: ['trial1'],
      skip: [
        {
          name: 'trial1',
          check: 'responses',
          to: 'end',
        },
        {
          check: 'block',
          condition: 'numCorrect',
          value: 1,
          to: 'targetComponent',
        },
      ],
      interruptions: [],
    };

    expect(getSkipConditionSummariesForBlock(block)).toEqual([
      'If trial1 does not match its correct answers, skip to the end of the study.',
      'If this block has 1 correct component response, skip to targetComponent.',
    ]);
  });

  test('keeps imported library skip logic readable after references are resolved', () => {
    const block: Sequence = {
      id: '$testLib.sequences.librarySequence',
      order: 'fixed',
      orderPath: 'root-0',
      components: ['$testLib.components.libraryQuestion'],
      skip: [{
        name: '$testLib.components.libraryQuestion',
        check: 'responses',
        to: 'end',
      }],
      interruptions: [],
    };

    expect(getSkipConditionSummariesForBlock(block)).toEqual([
      'If libraryQuestion does not match its correct answers, skip to the end of the study.',
    ]);
  });
});

describe('StepsPanel skipped trial detection', () => {
  test('marks only rows omitted by a triggered skip as skipped', () => {
    const sequence: Sequence = {
      order: 'fixed',
      orderPath: 'root',
      components: [
        {
          order: 'fixed',
          orderPath: 'root-0',
          components: ['trial1'],
          skip: [{
            name: 'trial1',
            check: 'response',
            responseId: 'q1',
            comparison: 'notEqual',
            value: 'Blue',
            to: 'targetComponent',
          }],
          interruptions: [],
        },
        'middle',
        'targetComponent',
      ],
      skip: [],
      interruptions: [],
    };

    const skippedTrialOrders = getSkippedTrialOrders(
      sequence,
      {
        trial1_0: buildStoredAnswer('trial1', 0, { q1: 'Red' }),
        targetComponent_2: buildStoredAnswer('targetComponent', 2, {}),
      },
      buildStudyConfig(sequence),
    );

    expect([...skippedTrialOrders]).toEqual([1]);
  });

  test('does not mark the end sentinel as skipped when skipping to end', () => {
    const sequence: Sequence = {
      order: 'fixed',
      orderPath: 'root',
      components: [
        {
          order: 'fixed',
          orderPath: 'root-0',
          components: ['trial1'],
          skip: [{
            name: 'trial1',
            check: 'response',
            responseId: 'q1',
            comparison: 'notEqual',
            value: 'Blue',
            to: 'end',
          }],
          interruptions: [],
        },
        'middle',
        'end',
      ],
      skip: [],
      interruptions: [],
    };

    const skippedTrialOrders = getSkippedTrialOrders(
      sequence,
      {
        trial1_0: buildStoredAnswer('trial1', 0, { q1: 'Red' }),
        end_2: buildStoredAnswer('end', 2, {}),
      },
      buildStudyConfig(sequence),
    );

    expect([...skippedTrialOrders]).toEqual([1]);
  });

  test('does not mark randomization or condition omissions as skipped', () => {
    const sequence: Sequence = {
      order: 'fixed',
      orderPath: 'root',
      components: [
        'trial1',
        'targetComponent',
      ],
      skip: [],
      interruptions: [],
    };

    const skippedTrialOrders = getSkippedTrialOrders(
      sequence,
      {
        trial1_0: buildStoredAnswer('trial1', 0, { q1: 'Blue' }),
        targetComponent_1: buildStoredAnswer('targetComponent', 1, {}),
      },
      buildStudyConfig(sequence),
    );

    expect([...skippedTrialOrders]).toEqual([]);
  });
});
