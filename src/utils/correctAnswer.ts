import { Answer, IndividualComponent, StoredAnswer } from '../parser/types';

// Helper function to check if two arrays have the same elements with the same counts
function arraysHaveSameElements<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false;

  const countMap = new Map<T, number>();
  arr1.forEach((item) => {
    countMap.set(item, (countMap.get(item) || 0) + 1);
  });

  for (const item of arr2) {
    if (!countMap.has(item)) return false;
    countMap.set(item, countMap.get(item)! - 1);
    if (countMap.get(item) === 0) countMap.delete(item);
  }

  return countMap.size === 0;
}

export function responseAnswerIsCorrect(responseUserAnswer: StoredAnswer['answer'][string], responseCorrectAnswer: Answer['answer']) {
  // Multiple choice
  if (Array.isArray(responseCorrectAnswer)) {
    if (!(Array.isArray(responseUserAnswer) && arraysHaveSameElements(responseUserAnswer, responseCorrectAnswer))) {
      return false;
    }
  } else {
    // single choice
    // eslint-disable-next-line no-lonely-if
    if (responseUserAnswer !== responseCorrectAnswer) {
      return false;
    }
  }

  return true;
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
