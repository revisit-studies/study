import {
  describe, expect, test, vi,
} from 'vitest';
import { compileTemplate } from '../handlebars';
import { StoredAnswer } from '../../store/types';

function makeAnswer(value: unknown): StoredAnswer {
  return {
    answer: { response: value },
    identifier: 'test',
    componentName: 'test',
    trialOrder: 'test',
    incorrectAnswers: {},
    startTime: 0,
    endTime: 0,
  } as unknown as StoredAnswer;
}

describe('compileTemplate', () => {
  test('substitutes a variable from parameters', () => {
    expect(compileTemplate('hello {{name}}', { name: 'world' })).toBe('hello world');
  });

  test('renders an empty string for a missing variable', () => {
    expect(compileTemplate('hello {{missing}}', {})).toBe('hello ');
  });

  test('defaults parameters to an empty object when omitted', () => {
    expect(compileTemplate('hello {{missing}}')).toBe('hello ');
  });

  test('returns the original text unchanged when it has no placeholders', () => {
    expect(compileTemplate('just plain text', { name: 'world' })).toBe('just plain text');
  });

  test('HTML-escapes substituted values by default', () => {
    expect(compileTemplate('{{value}}', { value: 'Q & A <b>' })).toBe('Q &amp; A &lt;b&gt;');
  });

  test('does not escape substituted values when noEscape is set', () => {
    expect(compileTemplate('{{value}}', { value: 'Q & A <b>' }, { noEscape: true })).toBe('Q & A <b>');
  });

  test('falls back to the raw text and logs an error for a malformed template', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const malformed = 'hello {{unclosed';
    expect(compileTemplate(malformed, { name: 'world' })).toBe(malformed);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('exposes the data frame under the REVISIT key on the root context', () => {
    expect(compileTemplate('{{REVISIT.currentStep}}', {}, { data: { currentStep: 3 } })).toBe('3');
  });
});

describe('ifEquals helper', () => {
  test('renders the primary block when values are equal', () => {
    expect(compileTemplate('{{#ifEquals a b}}yes{{else}}no{{/ifEquals}}', { a: 1, b: 1 })).toBe('yes');
  });

  test('renders the else block when values are not equal', () => {
    expect(compileTemplate('{{#ifEquals a b}}yes{{else}}no{{/ifEquals}}', { a: 1, b: 2 })).toBe('no');
  });

  test('uses strict equality (no type coercion)', () => {
    expect(compileTemplate('{{#ifEquals a b}}yes{{else}}no{{/ifEquals}}', { a: 1, b: '1' })).toBe('no');
  });

  test('supports "else ifEquals" chaining', () => {
    const template = '{{#ifEquals a 1}}one{{else ifEquals a 2}}two{{else}}other{{/ifEquals}}';
    expect(compileTemplate(template, { a: 1 })).toBe('one');
    expect(compileTemplate(template, { a: 2 })).toBe('two');
    expect(compileTemplate(template, { a: 3 })).toBe('other');
  });
});

describe('lookupAnswers helper', () => {
  const data = {
    flatSequence: ['intro', 'trial', 'outro'],
    answers: {
      intro_0: makeAnswer('intro-answer'),
      trial_1: makeAnswer('trial-answer'),
      outro_2: makeAnswer('outro-answer'),
    },
  };

  test('looks up an answer by absolute (positive) index', () => {
    expect(compileTemplate('{{lookupAnswers 1 "response"}}', {}, { data })).toBe('trial-answer');
  });

  test('supports Python-style negative indexing (-1 is the last step)', () => {
    expect(compileTemplate('{{lookupAnswers -1 "response"}}', {}, { data })).toBe('outro-answer');
  });

  test('renders empty when the resolved index is out of range', () => {
    expect(compileTemplate('{{lookupAnswers 99 "response"}}', {}, { data })).toBe('');
    expect(compileTemplate('{{lookupAnswers -99 "response"}}', {}, { data })).toBe('');
  });

  test('renders empty when there is no answer recorded for the resolved step', () => {
    const sparseData = { flatSequence: ['intro', 'trial'], answers: {} };
    expect(compileTemplate('{{lookupAnswers 0 "response"}}', {}, { data: sparseData })).toBe('');
  });

  test('renders empty when the data frame is missing answers/flatSequence', () => {
    expect(compileTemplate('{{lookupAnswers 0 "response"}}', {})).toBe('');
  });
});

describe('lookupAnswersRel helper', () => {
  const data = {
    flatSequence: ['intro', 'trial', 'outro'],
    currentStep: 1,
    answers: {
      intro_0: makeAnswer('intro-answer'),
      trial_1: makeAnswer('trial-answer'),
      outro_2: makeAnswer('outro-answer'),
    },
  };

  test('looks up the previous trial\'s answer with a negative offset', () => {
    expect(compileTemplate('{{lookupAnswersRel -1 "response"}}', {}, { data })).toBe('intro-answer');
  });

  test('looks up the next trial\'s answer with a positive offset', () => {
    expect(compileTemplate('{{lookupAnswersRel 1 "response"}}', {}, { data })).toBe('outro-answer');
  });

  test('renders empty when the target step is out of range', () => {
    expect(compileTemplate('{{lookupAnswersRel -5 "response"}}', {}, { data })).toBe('');
    expect(compileTemplate('{{lookupAnswersRel 5 "response"}}', {}, { data })).toBe('');
  });

  test('renders empty when currentStep is missing from the data frame', () => {
    const noCurrentStep = { flatSequence: data.flatSequence, answers: data.answers };
    expect(compileTemplate('{{lookupAnswersRel -1 "response"}}', {}, { data: noCurrentStep })).toBe('');
  });

  test('renders empty when the data frame is missing entirely', () => {
    expect(compileTemplate('{{lookupAnswersRel -1 "response"}}', {})).toBe('');
  });
});
