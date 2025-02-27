// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { variance, ftest } from 'jstat';
import { JumpFunctionParameters, JumpFunctionReturnVal, StoredAnswer } from '../../../../../../store/types';

export default function func({
  answers, customParameters,
}: JumpFunctionParameters<{r1: number, r2: number, above: boolean, counter: number, name: string, index: number}>): JumpFunctionReturnVal {
  let { r1, r2, above } = customParameters;
  const { name, index } = customParameters;
  let counter = 0;
  const findLatestTrial = (trialAnswers: Record<string, StoredAnswer>, position: number) => {
    const trialKeys = Object.keys(trialAnswers)
      .filter((key) => key.startsWith(`${name}`))
      .map((key) => ({ key, number: parseInt(key.split('_').pop()!, 10) }))
      .filter((entry) => !Number.isNaN(entry.number))
      .sort((a, b) => b.number - a.number);

    return trialKeys.length > position ? trialKeys[position].key : null;
  };

  const latestTrialKey = findLatestTrial(answers, 0);
  if (latestTrialKey && answers[latestTrialKey]?.parameters) {
    ({
      r1, r2, above, counter,
    } = answers[latestTrialKey].parameters);
  }
  // console.log('r1 r2 above counter', r1, r2, above, counter);
  const roundToTwo = (num: number) => parseFloat((Math.round(num * 100) / 100).toString());

  const lastAnswerName = findLatestTrial(answers, 1);
  const lastAnswer = lastAnswerName ? answers[lastAnswerName].answer.scatterSelections : null;

  if (lastAnswer) {
    const correctAnswer = above ? 2 : 1;
    const lastAnswerCorrect = lastAnswer === correctAnswer;

    if (above && lastAnswerCorrect) {
      r2 = roundToTwo(Math.max(r2 - 0.01, 0.01));
    } else if (above && !lastAnswerCorrect) {
      r2 = roundToTwo(Math.min(r2 + 0.03, 1));
    } else if (!above && lastAnswerCorrect) {
      r2 = roundToTwo(Math.max(r2 + 0.01, 0.01));
    } else if (!above && !lastAnswerCorrect) {
      r2 = roundToTwo(Math.max(r2 - 0.03, 0.01));
    }

    counter += 1;
  }

  if (above && r2 <= r1) { // Tie breaking
    r2 = roundToTwo(r1 + 0.02); // Force r2 above r1
  } else if (!above && r2 >= r1) {
    r2 = roundToTwo(r1 - 0.02); // Force r2 below r1
  }

  // **Check Convergence with F-test**
  if (counter >= 24) {
    const differences: number[] = [];

    for (let i = counter - 24; i < counter; i += 1) {
      const trialKey = `${name}_${index}_trial_${i}`;
      if (answers[trialKey]?.parameters) {
        const trialR1 = answers[trialKey].parameters.r1;
        const trialR2 = answers[trialKey].parameters.r2;
        differences.push(Math.abs(trialR2 - trialR1));
      }
    }

    if (differences.length === 24) {
      const group1 = differences.slice(0, 8);
      const group2 = differences.slice(8, 16);
      const group3 = differences.slice(16, 24);

      const var1 = variance(group1);
      const var2 = variance(group2);
      const var3 = variance(group3);

      const p12 = 1 - ftest(var1 / var2, group1.length - 1, group2.length - 1);
      const p23 = 1 - ftest(var2 / var3, group2.length - 1, group3.length - 1);
      const p13 = 1 - ftest(var1 / var3, group1.length - 1, group3.length - 1);

      if (p12 > 0.1 && p23 > 0.1 && p13 > 0.1) {
        return { component: null };
      }
    }
  }

  if (counter >= 50) {
    return { component: null };
  }

  return {
    component: 'trial',
    parameters: {
      r1, r2, above, counter,
    },
  };
}
