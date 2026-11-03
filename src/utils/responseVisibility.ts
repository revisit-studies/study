import type { Answer, GlobalStoreValues, Response } from '../parser/types';
import type { StoredAnswer } from '../store/types';
import { compareResponseValues, isResponseScoreCorrect, scoreResponseAnswer } from './correctAnswer';
import { usesStandaloneDontKnowField } from '../components/response/responseValidation';

export const visibilityControllerTypes = new Set(['radio', 'dropdown', 'buttons', 'checkbox', 'shortText', 'numerical', 'date']);

export function responseValueKeys(response: Response): string[] {
  return [response.id,
    ...(usesStandaloneDontKnowField(response) ? [`${response.id}-dontKnow`] : []),
    ...('withOther' in response && response.withOther ? [`${response.id}-other`] : []),
  ];
}

function isOtherSelected(value: StoredAnswer['answer'][string] | undefined) {
  return value === 'other' || (Array.isArray(value) && value.includes('__other'));
}

/** Remove inactive Other text while preserving response IDs that happen to use the suffix. */
export function normalizeResponseAnswerValues(values: StoredAnswer['answer'], responses: Response[]) {
  const responseIds = new Set(responses.map((response) => response.id));
  const responseIdsWithOther = new Set(
    responses
      .filter((response) => (response.type === 'radio' || response.type === 'checkbox') && response.withOther)
      .map((response) => response.id),
  );

  return Object.fromEntries(
    Object.entries(values).filter(([key]) => {
      if (!key.endsWith('-other') || responseIds.has(key)) return true;
      const responseId = key.slice(0, -'-other'.length);
      if (!responseIdsWithOther.has(responseId)) return true;
      return isOtherSelected(values[responseId]);
    }),
  ) as StoredAnswer['answer'];
}

function responseValueKeysForHidden(responses: Response[], visibleIds: Set<string>) {
  return responses
    .filter((response) => !visibleIds.has(response.id))
    .flatMap(responseValueKeys);
}

/** Resolve dependencies before dependents, so hidden values cannot reveal another field.
 * Defaults are optional: persistence and replay must never invent answers.
 */
export function resolveResponseVisibility(
  responses: Response[],
  values: StoredAnswer['answer'],
  defaults: StoredAnswer['answer'] = {},
  correctAnswers: Answer[] = [],
  persistedScores: Record<string, number> = {},
  store: GlobalStoreValues = {},
) {
  const normalizedValues = normalizeResponseAnswerValues(values, responses);
  const scoringValues = normalizeResponseAnswerValues({ ...defaults, ...normalizedValues }, responses);
  const byId = new Map(responses.map((response) => [response.id, response]));
  const resolveOnce = (candidateVisibleIds: Set<string>) => {
    const answers = { ...normalizedValues };
    const scoringAnswers = { ...scoringValues };
    responses.filter((response) => !candidateVisibleIds.has(response.id)).forEach((response) => {
      responseValueKeys(response).forEach((key) => { delete scoringAnswers[key]; });
    });
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
        if (condition.globalVariable !== undefined) {
          visible = Object.hasOwn(store, condition.globalVariable) && compareResponseValues(store[condition.globalVariable], condition.value, condition.comparison);
        } else {
          const controller = byId.get(condition.responseId);
          visible = !!controller && visit(controller);
          const storedValue = answers[condition.responseId];
          const value = controller?.type === 'numerical' && typeof storedValue === 'string' && storedValue.trim() !== ''
            ? Number(storedValue) : storedValue;
          const answered = value !== undefined && value !== null && value !== ''
          && !(Array.isArray(value) && value.length === 0)
          && (controller?.type !== 'numerical' || (typeof value === 'number' && Number.isFinite(value)))
          && !(controller && usesStandaloneDontKnowField(controller) && answers[`${condition.responseId}-dontKnow`]);
          visible = visible && answered;
          if (visible) {
            if (condition.comparison === 'isCorrect') {
              const correctAnswer = correctAnswers.find((answer) => answer.id === condition.responseId);
              if (!correctAnswer && !controller?.path) {
                visible = false;
              } else {
                const persistedScore = persistedScores[condition.responseId];
                const scoringContext = { ...scoringAnswers };
                if (controller && usesStandaloneDontKnowField(controller)) {
                  const dontKnowKey = `${controller.id}-dontKnow`;
                  if (Object.hasOwn(normalizedValues, dontKnowKey)) scoringContext[dontKnowKey] = normalizedValues[dontKnowKey];
                }
                const score = persistedScore !== undefined && Number.isFinite(persistedScore) && persistedScore >= 0 && persistedScore <= 1
                  ? persistedScore
                  : scoreResponseAnswer(
                    value,
                    correctAnswer,
                    controller,
                    scoringContext,
                  );
                const isCorrect = isResponseScoreCorrect(score, correctAnswer?.correctnessThreshold);
                visible = isCorrect !== null && isCorrect === condition.value;
              }
            } else {
              visible = compareResponseValues(value, condition.value, condition.comparison, {
                ignoreArrayOrder: true,
              });
            }
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
  };

  // Re-evaluate scoring with only answers currently known to be visible. This lets
  // scorers use visible conditional responses while keeping order independent.
  let candidateVisibleIds = new Set(responses.map((response) => response.id));
  const visibilityHistory = [candidateVisibleIds];
  for (let attempt = 0; attempt <= responses.length; attempt += 1) {
    const result = resolveOnce(candidateVisibleIds);
    let stable = result.visibleIds.size === candidateVisibleIds.size;
    for (const id of result.visibleIds) {
      if (!candidateVisibleIds.has(id)) stable = false;
    }
    if (stable) return result;
    candidateVisibleIds = result.visibleIds;
    visibilityHistory.push(candidateVisibleIds);
  }

  // If scorers create a visibility cycle, hide the unstable responses conservatively.
  const stableVisibleIds = new Set(responses
    .map((response) => response.id)
    .filter((id) => visibilityHistory.every((visibleIds) => visibleIds.has(id))));
  const result = resolveOnce(stableVisibleIds);
  const conservativeVisibleIds = new Set([...result.visibleIds].filter((id) => stableVisibleIds.has(id)));
  responseValueKeysForHidden(responses, conservativeVisibleIds).forEach((key) => { delete result.answers[key]; });
  return { answers: result.answers, visibleIds: conservativeVisibleIds };
}

/** Exclude hidden responses while preserving correctness checks for legacy IDs absent from the config. */
export function getApplicableCorrectAnswers(
  responses: Response[],
  values: StoredAnswer['answer'],
  correctAnswers: Answer[] = [],
  persistedScores: Record<string, number> = {},
  store: GlobalStoreValues = {},
): Answer[] {
  const { visibleIds } = resolveResponseVisibility(responses, values, {}, correctAnswers, persistedScores, store);
  const byId = new Map(responses.map((response) => [response.id, response]));
  return correctAnswers.filter((answer) => !byId.get(answer.id)?.visibleIf || visibleIds.has(answer.id));
}
