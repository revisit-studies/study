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

Handlebars.registerHelper(
  'lookupAnswersRel',
  (offset: number, responseId: string, options: Handlebars.HelperOptions) => {
    const {
      answers, flatSequence, currentStep, currentComponent, funcIndex,
    } = (options.data ?? {}) as {
      answers?: Record<string, StoredAnswer>; flatSequence?: string[]; currentStep?: unknown; currentComponent?: unknown; funcIndex?: unknown;
    };
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
    return answers[identifiers[targetPosition]]?.answer?.[responseId];
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
    const identifiers = getAnswerBearingSequence(flatSequence, answers);
    // Python-style negative indexing: -1 is the last step, -2 the second-to-last, etc.
    const resolvedIndex = index < 0 ? identifiers.length + index : index;
    if (resolvedIndex < 0 || resolvedIndex >= identifiers.length) {
      return undefined;
    }
    return answers[identifiers[resolvedIndex]]?.answer?.[responseId];
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
