import { describe, expect, it } from 'vitest';
import type { StudyConfig } from '../../parser/types';
import { getSkipConditionCorrectAnswers } from './useNextStep.utils';

function createStudyConfig(): StudyConfig {
  return {
    $schema: '',
    studyMetadata: {
      title: 'Skip logic regression test',
      version: '1.0.0',
      authors: ['Test'],
      date: '2026-03-25',
      description: 'Regression coverage for block skip correctness',
      organizations: ['Test Org'],
    },
    uiConfig: {
      contactEmail: 'test@example.com',
      helpTextPath: '',
      logoPath: '',
      withProgressBar: true,
      autoDownloadStudy: false,
      withSidebar: true,
    },
    baseComponents: {
      trial: {
        type: 'questionnaire',
        response: [
          {
            id: 'q1',
            type: 'radio',
            prompt: 'Favorite color',
            options: ['Blue', 'Red'],
          },
          {
            id: 'q2',
            type: 'radio',
            prompt: 'Favorite animal',
            options: ['Cat', 'Dog'],
          },
        ],
      },
    },
    components: {
      trial1: {
        baseComponent: 'trial',
        correctAnswer: [
          {
            id: 'q1',
            answer: 'Blue',
          },
          {
            id: 'q2',
            answer: 'Cat',
          },
        ],
      },
      attentionCheck: {
        type: 'questionnaire',
        response: [
          {
            id: 'q1',
            type: 'radio',
            prompt: 'Are you paying attention?',
            options: ['Yes', 'No'],
          },
        ],
        correctAnswer: [
          {
            id: 'q1',
            answer: 'Yes',
          },
        ],
      },
    },
    sequence: {
      order: 'fixed',
      components: ['trial1', 'attentionCheck'],
    },
  };
}

describe('getSkipConditionCorrectAnswers', () => {
  it('uses each candidate component config when counting block correctness', () => {
    const studyConfig = createStudyConfig();

    const correctAnswers = getSkipConditionCorrectAnswers([
      ['trial1_0', { answer: { q1: 'Blue', q2: 'Cat' } }],
      ['attentionCheck_1', { answer: { q1: 'No' } }],
    ], studyConfig);

    expect(correctAnswers).toEqual([true, false]);
  });
});
