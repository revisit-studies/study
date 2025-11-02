import { JumpFunctionParameters, JumpFunctionReturnVal, StoredAnswer } from '../../../../../store/types';

const findLatestTrial = (allDynamicAnswers: StoredAnswer[]) => {
  const trials = allDynamicAnswers
    .sort((a, b) => parseInt(a.trialOrder.split('_').at(-1) || '0', 10) - parseInt(b.trialOrder.split('_').at(-1) || '0', 10));

  return trials.at(-1)!;
};

export default function func({ answers }: JumpFunctionParameters<{ r1: number, r2: number, counter: number }>): JumpFunctionReturnVal {
  const allDynamicAnswers = Object.values(answers)
    .filter((answer) => answer.componentName === 'trial');

  // First trial
  if (allDynamicAnswers.length === 0) {
    return {
      component: 'trial',
      parameters: {
        r1: 0.1,
        r2: 0.9,
      },
      correctAnswer: [{ id: 'buttonsResponse', answer: 'right' }],
    };
  }

  if (allDynamicAnswers.length === 9) {
    return { component: null };
  }

  const latestTrial = findLatestTrial(allDynamicAnswers);

  const right = latestTrial.parameters.r2 === 0.9;

  const approachingValue = right ? latestTrial.parameters.r1 + 0.1 : latestTrial.parameters.r2 + 0.1;

  const r1 = right ? 0.9 : approachingValue;
  const r2 = right ? approachingValue : 0.9;

  return {
    component: 'trial',
    parameters: {
      r1,
      r2,
    },
    correctAnswer: [{ id: 'buttonsResponse', answer: right ? 'left' : 'right' }],
  };
}
