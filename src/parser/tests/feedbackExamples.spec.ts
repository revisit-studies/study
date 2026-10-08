import { readFileSync } from 'node:fs';
import {
  beforeAll, describe, expect, test,
} from 'vitest';
import type { StudyConfig, StoredAnswer } from '../types';
import { parseGlobalConfig, parseStudyConfig } from '../parser';
import { componentAnswersAreCorrect } from '../../utils/componentCorrectness';

const readConfig = (path: string) => readFileSync(`public/${path}`, 'utf8');

let feedbackStudy: StudyConfig;

beforeAll(async () => {
  const feedback = await parseStudyConfig(readConfig('demo-answer-feedback/config.json'));
  expect(feedback.errors).toEqual([]);
  feedbackStudy = feedback;
});

test('registers the feedback study in the global Demo Studies list', () => {
  const global = parseGlobalConfig(readConfig('global.json'));
  expect(global.configsList).toContain('demo-answer-feedback');
  expect(global.configs['demo-answer-feedback']).toEqual({
    tab: 'Demo Studies', path: 'demo-answer-feedback/config.json',
  });
});

type Example = [component: string, response: string, correct: StoredAnswer['answer'][string], incorrect: StoredAnswer['answer'][string]];

const examples: Example[] = [
  ['Exact Answer and Lists', 'exact', 4, 3],
  ['Exact Answer and Lists', 'country', 'USA', 'Canada'],
  ['Exact Answer and Lists', 'number-list', 1, 0],
  ['Exact Answer and Lists', 'number-list', 3, 2.5],
  ['Exact Answer and Lists', 'number-list', 5, 6],
  ['Numeric Ranges', 'closed-range', -10, -11],
  ['Numeric Ranges', 'closed-range', 10, 11],
  ['Numeric Ranges', 'lower-bound', 0, -1],
  ['Numeric Ranges', 'upper-bound', 0, 1],
  ['Alternative Selections', 'checkbox-set', ['B', 'A'], ['A', 'C']],
  ['Alternative Selections', 'checkbox-set', ['D', 'C'], ['A', 'B', 'C']],
  ['Alternative Selections', 'dropdown-set', ['Yellow', 'Green'], ['Red', 'Green']],
  ['Alternative Selections', 'ranking-set', { C: '0', D: '1' }, { D: '0', C: '1' }],
  ['Alternative Selections', 'checkbox-multiple', ['4', '-4', '|4|', '16/4'], ['4', '-4']],
  ['Unlimited Hints', 'hinted-number', 150, 149],
  ['Unlimited Hints', 'hinted-number', 160, 161],
];

describe('documented correct and incorrect answers', () => {
  test.each(examples)('%s / %s accepts %j and rejects %j', (name, responseId, correct, incorrect) => {
    const component = feedbackStudy.components[name];
    const answer = component.correctAnswer?.find((entry) => entry.id === responseId);
    expect(answer).toBeDefined();
    expect(componentAnswersAreCorrect({ [responseId]: correct }, [answer!], component.response)).toBe(true);
    expect(componentAnswersAreCorrect({ [responseId]: incorrect }, [answer!], component.response)).toBe(false);
  });
});
