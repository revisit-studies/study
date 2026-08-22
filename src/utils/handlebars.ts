import Handlebars from 'handlebars';
import { StoredAnswer } from '../store/types';

Handlebars.registerHelper(
  'ifEquals',
  function ifEquals(this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
    return a === b ? options.fn(this) : options.inverse(this);
  },
);

Handlebars.registerHelper(
  'lookupAnswersRel',
  (offset: number, responseId: string, options: Handlebars.HelperOptions) => {
    const { answers, flatSequence, currentStep } = (options.data ?? {}) as {
      answers?: Record<string, StoredAnswer>; flatSequence?: string[]; currentStep?: unknown;
    };
    if (!answers || !flatSequence || typeof currentStep !== 'number') {
      return undefined;
    }
    const targetStep = currentStep + offset;
    if (targetStep < 0 || targetStep >= flatSequence.length) {
      return undefined;
    }
    const identifier = `${flatSequence[targetStep]}_${targetStep}`;
    return answers[identifier]?.answer?.[responseId];
  },
);

Handlebars.registerHelper(
  'lookupAnswers',
  (index: number, responseId: string, options: Handlebars.HelperOptions) => {
    const { answers, flatSequence } = (options.data ?? {}) as {
      answers?: Record<string, StoredAnswer>; flatSequence?: string[];
    };
    if (!answers || !flatSequence) {
      return undefined;
    }
    // Python-style negative indexing: -1 is the last step, -2 the second-to-last, etc.
    const resolvedIndex = index < 0 ? flatSequence.length + index : index;
    if (resolvedIndex < 0 || resolvedIndex >= flatSequence.length) {
      return undefined;
    }
    const identifier = `${flatSequence[resolvedIndex]}_${resolvedIndex}`;
    return answers[identifier]?.answer?.[responseId];
  },
);

export function compileTemplate(text: string, parameters: Record<string, unknown> = {}, options?: { noEscape?: boolean; data?: Record<string, unknown> }): string {
  try {
    return Handlebars.compile(text, { noEscape: options?.noEscape })({ ...parameters, REVISIT: options?.data }, { data: options?.data });
  } catch (e) {
    console.error('Failed to compile handlebars template', e);
    return text;
  }
}
