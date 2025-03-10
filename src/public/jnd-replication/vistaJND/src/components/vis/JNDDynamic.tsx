// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { variance } from 'jstat';
import seedrandom from 'seedrandom';
import { JumpFunctionParameters, JumpFunctionReturnVal, StoredAnswer } from '../../../../../../store/types';

export default function func({
  answers, customParameters,
}: JumpFunctionParameters<{r1: number, r2: number, above: boolean, counter: number, name: string, index: number, shouldNegate?: boolean}>): JumpFunctionReturnVal {
  let { r1, r2, above } = customParameters;
  const { name, index } = customParameters;
  const shouldNegate = customParameters.shouldNegate || false;
  let higherFirst = seedrandom(Date.now().toString())() > 0.5;
  const roundToTwo = (num: number) => parseFloat((Math.round(num * 100) / 100).toString());

  let counter = 0;
  let isAttentionCheck = false;

  const findLatestTrial = (trialAnswers: Record<string, StoredAnswer>, position: number) => {
    const trialKeys = Object.keys(trialAnswers)
      .filter((key) => key.startsWith(`${name}_${index}_trial_`))
      .map((key) => ({
        key,
        number: parseInt(key.split('_').pop()!, 10),
      }))
      .filter((entry) => !Number.isNaN(entry.number))
      .sort((a, b) => b.number - a.number);

    return trialKeys.length > position ? trialKeys[position].key : null;
  };

  const findLatestRealTrial = (trialAnswers: Record<string, StoredAnswer>, position: number) => {
    const trialKeys = Object.keys(trialAnswers)
      .filter((key) => key.startsWith(`${name}_${index}_trial_`))
      .map((key) => ({
        key,
        number: parseInt(key.split('_').pop()!, 10),
        isAttentionCheck: trialAnswers[key]?.parameters?.isAttentionCheck || false,
      }))
      .filter((entry) => !Number.isNaN(entry.number) && !entry.isAttentionCheck) // Ignoring attention checks here
      .sort((a, b) => b.number - a.number);

    return trialKeys.length > position ? trialKeys[position].key : null;
  };

  const latestTrialKey = findLatestTrial(answers, 0);
  if (latestTrialKey && answers[latestTrialKey]?.parameters) {
    ({
      r1, r2, above, counter, isAttentionCheck,
    } = answers[latestTrialKey].parameters);
  }

  const latestRealTrialKey = findLatestRealTrial(answers, 0);
  let lastRealAnswer = null;
  let lastRealTrialParams = null;

  if (latestRealTrialKey && answers[latestRealTrialKey]?.parameters) {
    lastRealTrialParams = answers[latestRealTrialKey].parameters;
  }

  if (latestRealTrialKey && answers[latestRealTrialKey]?.answer) {
    lastRealAnswer = answers[latestRealTrialKey].answer.scatterSelections;
  }

  const lastAnswerName = findLatestTrial(answers, 1);
  const lastAnswer = lastAnswerName ? answers[lastAnswerName].answer.scatterSelections : null;

  if (counter > 0 && counter % 10 === 0 && counter < 50) { /// Attention check block
    isAttentionCheck = true;
    higherFirst = true;

    if (lastRealAnswer === 1) {
      r1 = 0.01;
      r2 = 1.0;
      above = true;
    } else {
      r1 = 1.0;
      r2 = 0.01;
      above = false;
    }
  } else {
    isAttentionCheck = false;

    if (lastRealTrialParams) {
      r1 = lastRealTrialParams.r1;
      r2 = lastRealTrialParams.r2;
      above = lastRealTrialParams.above;
    }

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
    }
  }

  counter += 1;

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

      const avg1 = group1.reduce((sum, val) => sum + val, 0) / group1.length;
      const avg2 = group2.reduce((sum, val) => sum + val, 0) / group2.length;
      const avg3 = group3.reduce((sum, val) => sum + val, 0) / group3.length;

      const varAvgSub = variance([avg1, avg2, avg3]);

      const avgVarSub = (var1 + var2 + var3) / 3;

      const fscore = varAvgSub / avgVarSub;

      if (fscore < 0.25) {
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
      r1, r2, above, counter, shouldNegate, higherFirst, isAttentionCheck,
    },
  };
}
