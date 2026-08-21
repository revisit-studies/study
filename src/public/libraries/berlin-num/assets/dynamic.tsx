import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../../../store/types';

export default function dynamic({ answers, currentStep, currentBlock }: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  const filteredAnswers = Object.entries(answers)
    .filter(([key, value]) => key.startsWith(`${currentBlock}_${currentStep}`) && value.endTime > -1);

  if (filteredAnswers.length === 0) {
    return { component: '$berlin-num.components.q1-choir-probability' };
  }

  if (filteredAnswers.length === 1) {
    const q1Answer = filteredAnswers[0][1]?.answer?.['q1-choir-probability'];
    return {
      // If q1 is correct, go to q2b. If q1 is incorrect, go to q2a.
      component: q1Answer === 25 ? '$berlin-num.components.q2b-loaded-dice' : '$berlin-num.components.q2a-dice-odd-numbers',
    };
  }

  if (filteredAnswers.length === 2) {
    const q1Answer = filteredAnswers[0][1]?.answer?.['q1-choir-probability'];

    if (q1Answer === 25) {
      const q2bAnswer = filteredAnswers[1][1]?.answer?.['q2b-loaded-dice'];
      // If q2b is correct, finish the dynamic block. If q2b is incorrect, go to q3.
      return { component: q2bAnswer === 20 ? null : '$berlin-num.components.q3-poisonous-mushrooms' };
    }
  }

  return { component: null };
}
