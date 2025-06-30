import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../../../store/types';

function getCompletedBerlinAnswers(answers: Record<string, { endTime: number; answer: Record<string, string> }>): string[] {
  return Object.keys(answers).filter((key) => {
    const answer = answers[key];
    return answer?.endTime > -1
           && (key.includes('berlin-num')
            || key.includes('q1-choir')
            || key.includes('q2a-dice')
            || key.includes('q2b-loaded')
            || key.includes('q3-poisonous'))
           && answer?.answer;
  });
}

export default function dynamic({ answers }: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  const completedAnswers = getCompletedBerlinAnswers(answers as Record<string, { endTime: number; answer: Record<string, string> }>);

  if (completedAnswers.length === 0) {
    return { component: '$berlin-num.components.q1-choir-probability' };
  }

  if (completedAnswers.length === 1) {
    const q1Answer = answers[completedAnswers[0]]?.answer?.['q1-choir-probability'];
    return {
      component: q1Answer === '25' ? '$berlin-num.components.q2b-loaded-dice' : '$berlin-num.components.q2a-dice-odd-numbers',
    };
  }

  if (completedAnswers.length === 2) {
    const q1Answer = answers[completedAnswers[0]]?.answer?.['q1-choir-probability'];

    if (q1Answer === '25') {
      const q2bAnswer = answers[completedAnswers[1]]?.answer?.['q2b-loaded-dice'];
      return { component: q2bAnswer === '20' ? null : '$berlin-num.components.q3-poisonous-mushrooms' };
    }
  }

  return { component: null };
}
