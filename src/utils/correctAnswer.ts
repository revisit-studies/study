import { isEqual } from 'lodash';
import { Answer, IndividualComponent, StoredAnswer } from '../parser/types';

export function responseAnswerIsCorrect(responseUserAnswer: StoredAnswer['answer'][string], responseCorrectAnswer: Answer['answer']) {
  return isEqual(responseUserAnswer, responseCorrectAnswer);
}

export function componentAnswersAreCorrect(componentUserAnswers: StoredAnswer['answer'], componentCorrectAnswers: IndividualComponent['correctAnswer']) {
  let allCorrect = true;

  (componentCorrectAnswers || []).forEach((correctAnswer) => {
    const userAnswer = componentUserAnswers[correctAnswer.id];
    if (userAnswer === undefined || !responseAnswerIsCorrect(userAnswer, correctAnswer.answer)) {
      allCorrect = false;
    }
  });

  return allCorrect;
}
