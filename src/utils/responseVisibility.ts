import type { Answer, Response } from '../parser/types';
import type { StoredAnswer } from '../store/types';
import { compareResponseValues, responseAnswerIsCorrect, shouldIgnoreArrayOrder } from './correctAnswer';
import { usesStandaloneDontKnowField } from '../components/response/responseValidation';

export const visibilityControllerTypes = new Set(['radio', 'dropdown', 'buttons', 'checkbox', 'shortText', 'numerical', 'date']);

export function responseValueKeys(response: Response): string[] {
  return [response.id,
    ...(usesStandaloneDontKnowField(response) ? [`${response.id}-dontKnow`] : []),
    ...('withOther' in response && response.withOther ? [`${response.id}-other`] : []),
  ];
}

/** Resolve dependencies before dependents, so hidden values cannot reveal another field.
 * Defaults are optional: persistence and replay must never invent answers.
 */
export function resolveResponseVisibility(
  responses: Response[],
  values: StoredAnswer['answer'],
  defaults: StoredAnswer['answer'] = {},
  correctAnswers: Answer[] = [],
) {
  const answers = { ...values };
  const byId = new Map(responses.map((response) => [response.id, response]));
  const visibleIds = new Set<string>();
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (response: Response): boolean => {
    if (visited.has(response.id)) return visibleIds.has(response.id);
    if (visiting.has(response.id)) return false;
    visiting.add(response.id);
    const condition = response.visibleIf;
    let visible = true;
    if (condition) {
      const controller = byId.get(condition.responseId);
      visible = !!controller && visit(controller);
      const value = answers[condition.responseId];
      const answered = value !== undefined && value !== null && value !== ''
        && !(Array.isArray(value) && value.length === 0)
        && !answers[`${condition.responseId}-dontKnow`];
      visible = visible && answered;
      if (visible) {
        if (condition.comparison === 'isCorrect') {
          const correctAnswer = correctAnswers.find((answer) => answer.id === condition.responseId);
          visible = !!correctAnswer && responseAnswerIsCorrect(
            value,
            correctAnswer.answer,
            correctAnswer.acceptableLow,
            correctAnswer.acceptableHigh,
            { ignoreArrayOrder: shouldIgnoreArrayOrder(controller) },
          ) === condition.value;
        } else {
          visible = compareResponseValues(value, condition.value, condition.comparison, {
            ignoreArrayOrder: true,
          });
        }
      }
      responseValueKeys(response).forEach((key) => {
        if (!visible) delete answers[key];
        else if (answers[key] === undefined && Object.hasOwn(defaults, key)) answers[key] = defaults[key];
      });
    }
    if (visible) visibleIds.add(response.id);
    visiting.delete(response.id);
    visited.add(response.id);
    return visible;
  };
  responses.forEach(visit);
  return { answers, visibleIds };
}

/** Exclude hidden responses while preserving correctness checks for legacy IDs absent from the config. */
export function getApplicableCorrectAnswers(
  responses: Response[],
  values: StoredAnswer['answer'],
  correctAnswers: Answer[] = [],
): Answer[] {
  const { visibleIds } = resolveResponseVisibility(responses, values, {}, correctAnswers);
  const byId = new Map(responses.map((response) => [response.id, response]));
  return correctAnswers.filter((answer) => !byId.get(answer.id)?.visibleIf || visibleIds.has(answer.id));
}
