import type { IndividualComponent, Response, StoredAnswer } from '../parser/types';
import type { CheckAnswerState } from '../store/types';
import {
  answerSnapshotMatches, getSavedScoresForAnswer, hasResponseScorer, hasSavedScores, isRequiredResponseUngraded, isResponseAnswered, isResponseAnsweredForScoring, isResponseScoreCorrect, scoreResponseAnswerWithStatus,
} from './correctAnswer';
import { getApplicableCorrectAnswers, resolveResponseVisibility } from './responseVisibility';

export function componentAnswersAreCorrect(
  componentUserAnswers: StoredAnswer['answer'],
  componentCorrectAnswers: IndividualComponent['correctAnswer'],
  responses?: Response[],
  checkAnswer?: CheckAnswerState,
): boolean | null {
  let allCorrect: boolean = true;
  let hasUnknownScore = false;
  const responsesById = new Map((responses || []).map((response) => [response.id, response]));
  const persistedScores = getSavedScoresForAnswer(checkAnswer, componentUserAnswers);
  const savedScoreIds = new Set(Object.keys(checkAnswer?.scores ?? {}));
  const staleScoreIds = answerSnapshotMatches(checkAnswer, componentUserAnswers) ? new Set<string>() : savedScoreIds;

  const applicableAnswers = getApplicableCorrectAnswers(responses ?? [], componentUserAnswers, componentCorrectAnswers, persistedScores);
  const expectedIds = new Set(applicableAnswers.map((answer) => answer.id));
  const { visibleIds } = resolveResponseVisibility(
    responses ?? [],
    componentUserAnswers,
    {},
    componentCorrectAnswers,
    persistedScores,
  );
  const idsToScore = new Set([
    ...applicableAnswers
      .filter((answer) => {
        const response = responsesById.get(answer.id);
        return isResponseAnsweredForScoring(response, componentUserAnswers[answer.id], componentUserAnswers) || response?.required !== false;
      })
      .map(({ id }) => id),
    ...(responses ?? [])
      .filter((response) => visibleIds.has(response.id)
        && !expectedIds.has(response.id)
        && (hasResponseScorer(response) || !!response.path || savedScoreIds.has(response.id))
        && isResponseAnswered(componentUserAnswers[response.id]))
      .map(({ id }) => id),
    ...[...savedScoreIds].filter((responseId) => !responsesById.has(responseId)),
  ]);
  let gradedCount = 0;
  let hasUnscoredResponse = applicableAnswers.some((answer) => responsesById.get(answer.id)?.required === false
    && !isResponseAnswered(componentUserAnswers[answer.id]))
    || (responses ?? []).some((response) => visibleIds.has(response.id)
      && !expectedIds.has(response.id)
      && isRequiredResponseUngraded(response, componentUserAnswers[response.id], componentUserAnswers));
  const hasRequiredUnscoredResponse = (responses ?? []).some((response) => visibleIds.has(response.id)
    && !expectedIds.has(response.id)
    && isRequiredResponseUngraded(response, componentUserAnswers[response.id], componentUserAnswers));

  idsToScore.forEach((responseId) => {
    const userAnswer = componentUserAnswers[responseId];
    const response = responsesById.get(responseId);
    const correctAnswer = applicableAnswers.find((answer) => answer.id === responseId);
    const persistedScore = persistedScores?.[responseId];
    const hasStaleScore = staleScoreIds.has(responseId);
    const scoringResult = persistedScore === undefined
      ? scoreResponseAnswerWithStatus(userAnswer, correctAnswer, response, componentUserAnswers)
      : {
        score: Number.isFinite(persistedScore) && persistedScore >= 0 && persistedScore <= 1 ? persistedScore : null,
        error: false,
      };
    const { score } = scoringResult;
    if (score === null) {
      if (scoringResult.error) {
        hasUnknownScore = true;
      } else if (!correctAnswer && response?.required !== false && hasResponseScorer(response) && !hasStaleScore) {
        hasUnknownScore = true;
      } else if (!correctAnswer && !!response?.path && !hasStaleScore) {
        hasUnscoredResponse = true;
      } else {
        hasUnknownScore = true;
      }
    } else {
      gradedCount += 1;
      if (!isResponseAnsweredForScoring(response, userAnswer, componentUserAnswers)
        || !isResponseScoreCorrect(score, correctAnswer?.correctnessThreshold)) allCorrect = false;
    }
  });

  if (staleScoreIds.size > 0 && [...staleScoreIds].some((id) => !idsToScore.has(id))) {
    hasUnknownScore = true;
  }
  if (allCorrect && (hasUnknownScore || hasRequiredUnscoredResponse || (gradedCount === 0 && hasUnscoredResponse))) {
    return null;
  }
  return allCorrect;
}

export type ComponentAnswerStatus = 'correct' | 'incorrect' | 'unknown';

export function getComponentAnswerStatus(
  componentAnswer: StoredAnswer | undefined,
  componentCorrectAnswers: IndividualComponent['correctAnswer'],
  responses?: Response[],
): ComponentAnswerStatus | null {
  if (
    !componentAnswer
    || componentAnswer.endTime < 0
    || Object.keys(componentAnswer.answer).length === 0
  ) {
    return null;
  }

  const hasScores = hasSavedScores(componentAnswer.checkAnswer);
  if (!componentCorrectAnswers?.length && !responses?.some(hasResponseScorer) && !hasScores) {
    return 'unknown';
  }

  const correct = componentAnswersAreCorrect(
    componentAnswer.answer,
    componentCorrectAnswers,
    responses,
    componentAnswer.checkAnswer,
  );
  return correct === null ? 'unknown' : correct ? 'correct' : 'incorrect';
}
