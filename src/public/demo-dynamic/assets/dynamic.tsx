import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../../store/types';

export default function dynamic({ answers }: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  // Check the length of the answers array
  const topAnswerLength = Object.entries(answers)
    .filter(([key, _]) => key.startsWith('dynamicBlock'))
    .filter(([_, value]) => value.endTime > -1)
    .length;

  // If answer length reaches 10, return null to exit dynamic block
  if (topAnswerLength === 10) {
    return { component: null };
  }

  // Look at the last answer to adjust next question's difficulty by setting a value for left and right
  const validAnswers = Object.values(answers)
    .filter((value) => value.endTime > -1);
  const lastAnswer = validAnswers[validAnswers.length - 1];

  let message = 'The answer difficulty will change based on your last answer';
  let color = 'blue';

  if (lastAnswer.answer.buttonResponse === 'Right') {
    // If the last answer was correct, show difficulty increased
    message = 'Difficulty increased';
    color = 'green';
  } else if (lastAnswer.answer.buttonResponse === 'Left') {
    // If the last answer was incorrect, show difficulty decreased
    message = 'Difficulty decreased';
    color = 'red';
  }

  // Adjust left square's saturation value based on the last answer
  // Correct answers increase saturation by 5 (max 50), wrong answers decrease it by 5 (min 0)
  const leftValue = validAnswers.reduce((leftVal, answer) => {
    if (answer.answer.buttonResponse === 'Right') {
      return Math.min(50, leftVal + 5);
    }
    return Math.max(0, leftVal - 5);
  }, 0);

  // Adjust right square's saturation value based on the last answer
  // Correct answers decrease saturation by 5 (min 50), wrong answers increase it by 5 (max 100)
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
