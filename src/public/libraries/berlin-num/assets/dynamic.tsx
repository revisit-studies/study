import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../../../store/types';

export default function dynamic({
  answers, customParameters: _customParameters, currentStep: _currentStep, currentBlock: _currentBlock,
}: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  const answeredQuestions = Object.keys(answers).filter((key) => {
    const hasEndTime = answers[key].endTime > -1;
    const isBerlinQuestion = key.includes('berlin-num') || key.includes('q1-choir') || key.includes('q2a-dice') || key.includes('q2b-loaded') || key.includes('q3-poisonous');
    return hasEndTime && isBerlinQuestion;
  });

  if (answeredQuestions.length === 0) {
    return {
      component: '$berlin-num.components.q1-choir-probability',
    };
  }

  const lastAnswer = answers[answeredQuestions[answeredQuestions.length - 1]];

  if (!lastAnswer || !lastAnswer.answer) {
    return { component: null };
  }

  if (answeredQuestions.length === 1) {
    const lastQuestionAnswer = lastAnswer.answer['q1-choir-probability'];
    if (lastQuestionAnswer === undefined) {
      return { component: null };
    }

    const isQ1Correct = String(lastQuestionAnswer) === '25';

    if (isQ1Correct) {
      return { component: '$berlin-num.components.q2b-loaded-dice' };
    }
    return { component: '$berlin-num.components.q2a-dice-odd-numbers' };
  } if (answeredQuestions.length === 2) {
    const firstAnswer = answers[answeredQuestions[0]];
    if (!firstAnswer || !firstAnswer.answer) {
      return { component: null };
    }

    const wasQ1Correct = String(firstAnswer.answer['q1-choir-probability']) === '25';

    if (wasQ1Correct) {
      const lastQuestionAnswer = lastAnswer.answer['q2b-loaded-dice'];
      if (lastQuestionAnswer === undefined) {
        return { component: null };
      }

      if (String(lastQuestionAnswer) === '20') {
        return { component: null };
      }
      return { component: '$berlin-num.components.q3-poisonous-mushrooms' };
    }
    const lastQuestionAnswer = lastAnswer.answer['q2a-dice-odd-numbers'];
    if (lastQuestionAnswer === undefined) {
      return { component: null };
    }

    return { component: null };
  }

  if (answeredQuestions.length >= 3) {
    return { component: null };
  }

  return { component: null };
}
