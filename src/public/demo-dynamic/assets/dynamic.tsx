import { JumpFunctionParameters, JumpFunctionReturnVal, StoredAnswer } from '../../../store/types';

export default function dynamic({ answers, currentStep, currentBlock }: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  // Check the length of the answers array
  const filteredAnswers = Object.entries(answers)
    .filter(([key, value]) => key.startsWith(`${currentBlock}_${currentStep}`) && value.endTime > -1);

  // If answer length reaches 10, return null to exit dynamic block
  if (filteredAnswers.length === 10) {
    return { component: null };
  }

  const checkCorrectness = (answer: StoredAnswer) => (answer.answer.buttonResponse === 'Left' && answer.parameters.left > answer.parameters.right)
    || (answer.answer.buttonResponse === 'Right' && answer.parameters.right > answer.parameters.left)
    || (answer.answer.buttonResponse === 'Same' && answer.parameters.left === answer.parameters.right);

  const lastAnswer = filteredAnswers[filteredAnswers.length - 1]?.[1];
  let message = 'The answer difficulty will change based on your last answer';
  let color = 'blue';

  const isCorrect = lastAnswer && checkCorrectness(lastAnswer);

  if (lastAnswer) {
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

  // Get the last answer's values if they exist
  const lastLeftValue = lastAnswer?.parameters.left ?? 30;
  const lastRightValue = lastAnswer?.parameters.right ?? 70;

  // Adjust left square's saturation value based on the last answer
  // Correct answers increase saturation by 10 (max 100), wrong answers decrease it by 10 (min 0)
  const leftValue = lastAnswer ? (isCorrect ? Math.min(100, lastLeftValue + 10) : Math.max(0, lastLeftValue - 10)) : lastLeftValue;

  // Adjust right square's saturation value based on the last answer
  // Correct answers decrease saturation by 10 (min 0), wrong answers increase it by 10 (max 100)
  const rightValue = lastAnswer ? (isCorrect ? Math.max(0, lastRightValue - 10) : Math.min(100, lastRightValue + 10)) : lastRightValue;

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
