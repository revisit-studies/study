import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../../store/types';

export default function dynamic({ answers }: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  // Check the length of the answers array. If it's 10, return null to exit dynamic block
  const topAnswerLength = Object.entries(answers)
    .filter(([key, _]) => key.startsWith('dynamicBlock'))
    .filter(([_, value]) => value.endTime > -1)
    .length;

  if (topAnswerLength === 10) {
    return { component: null };
  }

  // Look at the last answer, if it was correct, make the next question harder by setting a value for left and right
  // If it was wrong, make the next question easier by setting a value for left and right
  const validAnswers = Object.values(answers)
    .filter((value) => value.endTime > -1);

  let message = 'The answer difficulty will change based on your last answer';
  let color = 'blue';

  const lastAnswer = validAnswers[validAnswers.length - 1];

  if (!lastAnswer || !lastAnswer.answer || !lastAnswer.answer.buttonResponse) {
    message = 'The answer difficulty will change based on your last answer';
    color = 'blue';
  } else if (lastAnswer.answer.buttonResponse === 'Right') {
    message = 'Difficulty increased';
    color = 'green';
  } else {
    message = 'Difficulty decreased';
    color = 'red';
  }

  const leftValue = validAnswers.reduce((leftVal, answer) => {
    if (answer.answer.buttonResponse === 'Right') {
      return Math.min(50, leftVal + 5);
    }
    return Math.max(0, leftVal - 5);
  }, 0);

  const rightValue = validAnswers.reduce((rightVal, answer) => {
    if (answer.answer.buttonResponse === 'Right') {
      return Math.max(50, rightVal - 5);
    }
    return Math.min(100, rightVal + 5);
  }, 100);

  return {
    component: 'HSLColorCodes',
    parameters: {
      left: leftValue,
      right: rightValue,
      message,
      color,
    },
    correctAnswer: [{ id: 'buttonResponse', answer: 'Right' }],
  };
}
