import { isEqual } from 'lodash';
import { Answer, IndividualComponent, StoredAnswer } from '../parser/types';

export function responseAnswerIsCorrect(responseUserAnswer: StoredAnswer['answer'][string], responseCorrectAnswer: Answer['answer']) {
  if (Array.isArray(responseUserAnswer) && Array.isArray(responseCorrectAnswer)) {
    if (responseUserAnswer.length !== responseCorrectAnswer.length) return false;
    const sortedUserAnswer = [...responseUserAnswer].sort();
    const sortedCorrectAnswer = [...responseCorrectAnswer].sort();
    return isEqual(sortedUserAnswer, sortedCorrectAnswer);
  }

  // Handle numeric-string comparison for likert and slider responses
  if ((typeof responseUserAnswer === 'number' && typeof responseCorrectAnswer === 'string')
  || (typeof responseUserAnswer === 'string' && typeof responseCorrectAnswer === 'number')) {
    return String(responseUserAnswer) === String(responseCorrectAnswer);
  }

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
