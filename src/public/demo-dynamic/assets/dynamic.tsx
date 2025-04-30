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
    .filter((value) => value.endTime > -1 && value.componentName === 'HSLColorCodes');

  const lastAnswer = validAnswers[validAnswers.length - 1];

  let message = 'The answer difficulty will change based on your last answer';
  let color = 'blue';

  if (lastAnswer) {
    const isCorrect = (lastAnswer.answer.buttonResponse === 'Left' && lastAnswer.parameters.left > lastAnswer.parameters.right)
                      || (lastAnswer.answer.buttonResponse === 'Right' && lastAnswer.parameters.right > lastAnswer.parameters.left)
                      || (lastAnswer.answer.buttonResponse === 'Same' && lastAnswer.parameters.left === lastAnswer.parameters.right);

    // If the last answer was correct, show difficulty increased
    if (isCorrect) {
      message = 'Difficulty increased';
      color = 'green';
      // If the correct answer was 'Same', finish the dynamic block
      if (lastAnswer.answer.buttonResponse === 'Same' && lastAnswer.parameters.left === lastAnswer.parameters.right) {
        return { component: null };
      }
    } else {
      // If the last answer was incorrect, show difficulty decreased
      message = 'Difficulty decreased';
      color = 'red';
    }
  }

  // Adjust left square's saturation value based on the last answer
  // Correct answers increase saturation by 10 (max 100), wrong answers decrease it by 10 (min 0)
  const leftValue = validAnswers.reduce((leftVal, answer) => {
    const isCorrect = ((answer.answer.buttonResponse === 'Left' && answer.parameters.left > answer.parameters.right)
                      || (answer.answer.buttonResponse === 'Right' && answer.parameters.right > answer.parameters.left)
                      || (answer.answer.buttonResponse === 'Same' && answer.parameters.left === answer.parameters.right));
    return isCorrect ? Math.min(100, leftVal + 10) : Math.max(0, leftVal - 10);
  }, 30);

  // Adjust right square's saturation value based on the last answer
  // Correct answers decrease saturation by 10 (min 0), wrong answers increase it by 10 (max 100)
  const rightValue = validAnswers.reduce((rightVal, answer) => {
    const isCorrect = ((answer.answer.buttonResponse === 'Right' && answer.parameters.right > answer.parameters.left)
                      || (answer.answer.buttonResponse === 'Left' && answer.parameters.left > answer.parameters.right)
                      || (answer.answer.buttonResponse === 'Same' && answer.parameters.left === answer.parameters.right));
    return isCorrect ? Math.max(0, rightVal - 10) : Math.min(100, rightVal + 10);
  }, 70);

  return {
    component: 'HSLColorCodes',
    parameters: {
      left: leftValue,
      right: rightValue,
      message,
      color,
    },
    correctAnswer: [{ id: 'buttonResponse', answer: leftValue === rightValue ? 'Same' : (leftValue > rightValue ? 'Left' : 'Right') }],
  };
}
