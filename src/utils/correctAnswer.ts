import isEqual from 'lodash.isequal';
import { Answer, IndividualComponent, StoredAnswer } from '../parser/types';

export function responseAnswerIsCorrect(responseUserAnswer: StoredAnswer['answer'][string], responseCorrectAnswer: Answer['answer']) {
  // Handle numeric-string comparison for likert and slider responses
  if ((typeof responseUserAnswer === 'number' || typeof responseUserAnswer === 'string')
  && (typeof responseCorrectAnswer === 'string' || typeof responseCorrectAnswer === 'number')) {
    return String(responseUserAnswer) === String(responseCorrectAnswer);
  }

  // Ignore order for checkbox answers by sorting
  if (Array.isArray(responseUserAnswer) && Array.isArray(responseCorrectAnswer)) {
    if (responseUserAnswer.length !== responseCorrectAnswer.length) return false;
    const sortedUserAnswer = [...responseUserAnswer].sort();
    const sortedCorrectAnswer = [...responseCorrectAnswer].sort();
    return isEqual(sortedUserAnswer, sortedCorrectAnswer);
  }

  // Handle array of object (e.g. matrix-radio and matrix-checkbox)
  if (typeof responseUserAnswer === 'object') {
    const userAnswerArray = Object.values(responseUserAnswer);

    if (userAnswerArray.length !== responseCorrectAnswer.length) return false;

    // Check matrix-checkbox
    const isMatrixCheckbox = Array.isArray(responseCorrectAnswer[0]);
    if (isMatrixCheckbox) {
      return userAnswerArray.every((userVal, idx) => {
        const correctVal = responseCorrectAnswer[idx];
        if (!Array.isArray(correctVal)) return false;

        const userValArray = typeof userVal === 'string' ? (userVal === '' ? [] : userVal.split('|')) : [];
        if (userValArray.length !== correctVal.length) return false;

        const sortedUserAnswer = [...userValArray].sort();
        const sortedCorrectAnswer = [...correctVal].sort();
        return sortedUserAnswer.every((val, i) => val === sortedCorrectAnswer[i]);
      });
    }

    return userAnswerArray.every((val, idx) => String(val) === String(responseCorrectAnswer[idx]));
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
