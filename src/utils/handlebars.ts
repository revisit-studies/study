import Handlebars from 'handlebars';
import { StoredAnswer } from '../store/types';
import { parseTrialOrder } from './parseTrialOrder';

Handlebars.registerHelper(
  'ifEquals',
  function ifEquals(this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
    return a === b ? options.fn(this) : options.inverse(this);
  },
);

// Runtime participant sequences append an 'end' sentinel to flatSequence, and dynamic-block
// steps are stored under one answer per iteration (`${blockName}_${step}_${component}_${funcIndex}`)
// rather than under the block's own step identifier. Indexing flatSequence directly would treat
// 'end' as a real, answer-bearing step and would never find a dynamic block's iteration answers.
// This walks flatSequence in order and produces only identifiers that can actually hold an answer:
// the step's own identifier for regular steps, or one entry per recorded iteration (ordered by
// funcIndex) for dynamic blocks.
//
// Dynamic iterations are matched by trialOrder's step number (`${step}_${funcIndex}`), not by a
// string prefix on the identifier — a regular component at a later step can have an identifier
// that happens to start with an earlier dynamic block's prefix (e.g. dynamic block `block` at
// step 1 vs. a regular component `block_1_trial` at step 2, whose identifier is
// `block_1_trial_2`), and a prefix match would wrongly sweep that answer into the block's
// iterations.
function getAnswerBearingSequence(flatSequence: string[], answers: Record<string, StoredAnswer>): string[] {
  const identifiers: string[] = [];
  flatSequence.forEach((componentName, index) => {
    if (componentName === 'end') {
      return;
    }
    const staticIdentifier = `${componentName}_${index}`;
    if (staticIdentifier in answers) {
      identifiers.push(staticIdentifier);
      return;
    }
    Object.entries(answers)
      .filter(([, answer]) => {
        const parsed = parseTrialOrder(answer.trialOrder);
        return parsed.step === index && parsed.funcIndex !== null;
      })
      .sort(([, a], [, b]) => (parseTrialOrder(a.trialOrder).funcIndex ?? 0) - (parseTrialOrder(b.trialOrder).funcIndex ?? 0))
      .forEach(([key]) => identifiers.push(key));
  });
  return identifiers;
}

// Locates the current position within an answer-bearing sequence. Inside a dynamic block,
// `currentComponent`/`funcIndex` (when available) pin down the exact iteration; otherwise this
// falls back to the step's own identifier, which is correct for regular (non-dynamic) steps.
function findCurrentPosition(
  identifiers: string[],
  flatSequence: string[],
  currentStep: number,
  currentComponent: unknown,
  funcIndex: unknown,
): number {
  if (typeof currentComponent === 'string' && typeof funcIndex === 'number') {
    const dynamicIdentifier = `${flatSequence[currentStep]}_${currentStep}_${currentComponent}_${funcIndex}`;
    const dynamicPosition = identifiers.indexOf(dynamicIdentifier);
    if (dynamicPosition !== -1) {
      return dynamicPosition;
    }
  }
  return identifiers.indexOf(`${flatSequence[currentStep]}_${currentStep}`);
}

type LookupData = {
  answers?: Record<string, StoredAnswer>;
  flatSequence?: string[];
  currentStep?: unknown;
  currentComponent?: unknown;
  funcIndex?: unknown;
};

// The stored record of the step `offset` steps away from the current one (-1 is the previous step).
function resolveRelativeStep(offset: number, options: Handlebars.HelperOptions): StoredAnswer | undefined {
  const {
    answers, flatSequence, currentStep, currentComponent, funcIndex,
  } = (options.data ?? {}) as LookupData;
  if (!answers || !flatSequence || typeof currentStep !== 'number') {
    return undefined;
  }
  const identifiers = getAnswerBearingSequence(flatSequence, answers);
  const currentPosition = findCurrentPosition(identifiers, flatSequence, currentStep, currentComponent, funcIndex);
  if (currentPosition === -1) {
    return undefined;
  }
  const targetPosition = currentPosition + offset;
  if (targetPosition < 0 || targetPosition >= identifiers.length) {
    return undefined;
  }
  return answers[identifiers[targetPosition]];
}

// The stored record of the step at absolute position `index` in the sequence.
function resolveAbsoluteStep(index: number, options: Handlebars.HelperOptions): StoredAnswer | undefined {
  const { answers, flatSequence } = (options.data ?? {}) as LookupData;
  if (!answers || !flatSequence) {
    return undefined;
  }
  const identifiers = getAnswerBearingSequence(flatSequence, answers);
  // Python-style negative indexing: -1 is the last step, -2 the second-to-last, etc.
  const resolvedIndex = index < 0 ? identifiers.length + index : index;
  if (resolvedIndex < 0 || resolvedIndex >= identifiers.length) {
    return undefined;
  }
  return answers[identifiers[resolvedIndex]];
}

const getAnswer = (step: StoredAnswer | undefined, responseId: string) => step?.answer?.[responseId];
const getParameter = (step: StoredAnswer | undefined, name: string) => step?.parameters?.[name];
const getCorrectAnswer = (step: StoredAnswer | undefined, responseId: string) => step?.correctAnswer?.find((entry) => entry.id === responseId)?.answer;

// Each lookup comes in two forms: `lookupXRel offset key` (relative to the current step) and
// `lookupX index key` (absolute position in the sequence).
Handlebars.registerHelper(
  'lookupAnswersRel',
  (offset: number, responseId: string, options: Handlebars.HelperOptions) => getAnswer(resolveRelativeStep(offset, options), responseId),
);
Handlebars.registerHelper(
  'lookupAnswers',
  (index: number, responseId: string, options: Handlebars.HelperOptions) => getAnswer(resolveAbsoluteStep(index, options), responseId),
);

// The parameters a step was shown with, including sequence and factor parameters.
Handlebars.registerHelper(
  'lookupParametersRel',
  (offset: number, name: string, options: Handlebars.HelperOptions) => getParameter(resolveRelativeStep(offset, options), name),
);
Handlebars.registerHelper(
  'lookupParameters',
  (index: number, name: string, options: Handlebars.HelperOptions) => getParameter(resolveAbsoluteStep(index, options), name),
);

// The `answer` of the step's `correctAnswer` entry for the given response id.
Handlebars.registerHelper(
  'lookupCorrectAnswerRel',
  (offset: number, responseId: string, options: Handlebars.HelperOptions) => getCorrectAnswer(resolveRelativeStep(offset, options), responseId),
);
Handlebars.registerHelper(
  'lookupCorrectAnswer',
  (index: number, responseId: string, options: Handlebars.HelperOptions) => getCorrectAnswer(resolveAbsoluteStep(index, options), responseId),
);

export function compileTemplate(text: string, parameters: Record<string, unknown> = {}, options?: { noEscape?: boolean; data?: Record<string, unknown> }): string {
  try {
    return Handlebars.compile(text, { noEscape: options?.noEscape })({ ...parameters, REVISIT: options?.data }, { data: options?.data });
  } catch (e) {
    console.error('Failed to compile handlebars template', e);
    return text;
  }
}
