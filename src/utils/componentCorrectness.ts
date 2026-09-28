import type { IndividualComponent, Response, StoredAnswer } from '../parser/types';
import { responseAnswerIsCorrect, shouldIgnoreArrayOrder } from './correctAnswer';
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
      || !responseAnswerIsCorrect(
        userAnswer,
        correctAnswer.answer,
        correctAnswer.acceptableLow,
        correctAnswer.acceptableHigh,
        { ignoreArrayOrder: shouldIgnoreArrayOrder(response) },
      )
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

  return componentAnswersAreCorrect(
    componentAnswer.answer,
    componentCorrectAnswers,
    responses,
  ) ? 'correct' : 'incorrect';
}
