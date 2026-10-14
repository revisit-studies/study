import type { IndividualComponent, Response, StoredAnswer } from '../parser/types';
import { getResponseFunctionModule, scoreResponseAnswer } from './correctAnswer';
import { getApplicableCorrectAnswers } from './responseVisibility';

export function componentAnswersAreCorrect(
  componentUserAnswers: StoredAnswer['answer'],
  componentCorrectAnswers: IndividualComponent['correctAnswer'],
  responses?: Response[],
) {
  let allCorrect = true;
  const responsesById = new Map((responses || []).map((response) => [response.id, response]));

  getApplicableCorrectAnswers(responses ?? [], componentUserAnswers, componentCorrectAnswers).forEach((correctAnswer) => {
    const userAnswer = componentUserAnswers[correctAnswer.id];
    const response = responsesById.get(correctAnswer.id);

    if (
      userAnswer === undefined
      || scoreResponseAnswer(userAnswer, correctAnswer, response, componentUserAnswers) !== 1
    ) {
      allCorrect = false;
    }
  });

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

  if (!componentCorrectAnswers?.length) {
    return 'unknown';
  }

  const missingResponseModule = responses?.some((response) => response.type !== 'custom'
    && response.path
    && componentCorrectAnswers.some((answer) => answer.id === response.id)
    && !getResponseFunctionModule(response.path));
  if (missingResponseModule) {
    return 'unknown';
  }

  return componentAnswersAreCorrect(
    componentAnswer.answer,
    componentCorrectAnswers,
    responses,
  ) ? 'correct' : 'incorrect';
}
