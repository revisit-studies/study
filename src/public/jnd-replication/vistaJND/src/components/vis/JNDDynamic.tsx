// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { variance } from 'jstat';
import seedrandom from 'seedrandom';
import { JumpFunctionParameters, JumpFunctionReturnVal, StoredAnswer } from '../../../../../../store/types';

export default function func({
  answers, customParameters,
}: JumpFunctionParameters<{r1: number, r2: number, above: boolean, counter: number, name: string, shouldNegate?: boolean}>): JumpFunctionReturnVal {
  let { r1, r2, above } = customParameters;
  const { name } = customParameters;
  const shouldNegate = customParameters.shouldNegate || false;
  let higherFirst = seedrandom(Date.now().toString())() > 0.5;
  const roundToTwo = (num: number) => parseFloat((Math.round(num * 100) / 100).toString());

  let counter = 0;
  let isAttentionCheck = false;

  const findLatestTrial = (trialAnswers: Record<string, StoredAnswer>, position: number) => {
    const trialKeys = Object.keys(trialAnswers)
      .filter((key) => key.startsWith(`${name}`) && key.includes('trial'))
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
      .filter((key) => key.startsWith(`${name}`) && key.includes('trial'))
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
  const index = latestTrialKey && parseInt(latestTrialKey.split('_')[1], 10);
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
  const lastAnswerName = findLatestRealTrial(answers, 1);
  const lastAnswer = lastAnswerName && answers[lastAnswerName].answer.scatterSelections;

  let lastAnswerDirection = '';
  if (lastRealAnswer) {
    if (lastRealTrialParams && lastRealTrialParams.above) { /// above is true (r2 > r1) and answer is correct (r2)
      lastAnswerDirection = lastRealTrialParams && lastRealTrialParams.higherFirst ? 'right' : 'left'; // higher first means r1 is on the left
    } else { /// above is false (r1 > r2) and answer is correct (r1)
      lastAnswerDirection = lastRealTrialParams && lastRealTrialParams.higherFirst ? 'left' : 'right';
    }
  } else if (lastRealTrialParams && lastRealTrialParams.above) { // answer incorrect(r1) and above is true (r2 > r1), correct answer r2
    lastAnswerDirection = lastRealTrialParams && lastRealTrialParams.higherFirst ? 'left' : 'right';
  } else { // answer incorrect(r2) and above is false (r1 > r2), correct r1
    lastAnswerDirection = lastRealTrialParams && lastRealTrialParams.higherFirst ? 'right' : 'left';
  }

  if (counter > 0 && counter % 10 === 9 && counter < 50) { /// Attention check block
    isAttentionCheck = true;
    higherFirst = true;
    if (lastAnswerDirection === 'left') {
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
      ({ r1, r2, above } = lastRealTrialParams);
    }

    if (lastAnswer) { // Correct answer
      r2 = roundToTwo(above ? Math.max(r2 - 0.01, 0.01) : Math.max(r2 + 0.01, 0.01));
    } else { // Incorrect answer
      r2 = roundToTwo(above ? Math.min(r2 + 0.03, 1) : Math.max(r2 - 0.03, 0.01));
    }
  }

  if (above && r2 <= r1) { // Tie breaking
    r2 = roundToTwo(r1 + 0.02); // Force r2 above r1
  } else if (!above && r2 >= r1) {
    r2 = roundToTwo(r1 - 0.02); // Force r2 below r1
  }

  // **Check Convergence with F-test**
  if (counter >= 26) {
    const differences: number[] = [];

    for (let i = counter - 26; i < counter; i += 1) {
      const trialKey = `${name}_${index}_trial_${i}`;
      if (answers[trialKey]?.parameters && !answers[trialKey]?.parameters.isAttentionCheck) {
        const trialR1 = answers[trialKey].parameters.r1;
        const trialR2 = answers[trialKey].parameters.r2;
        differences.push(Math.abs(trialR2 - trialR1));
      }
    }
    if (differences.length === 23) { // injecting another trial when there are 3 attention check trials
      const key = `${name}_${index}_trial_${counter - 27}`;
      if (answers[key]?.parameters && !answers[key]?.parameters.isAttentionCheck) {
        const trialR1 = answers[key].parameters.r1;
        const trialR2 = answers[key].parameters.r2;
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

  if (counter > 50) {
    return { component: null };
  }

  counter += 1;

  return {
    component: 'trial',
    parameters: {
      r1, r2, above, counter, shouldNegate, higherFirst, isAttentionCheck,
    },
    correctAnswer: [{ id: 'scatterSelections', answer: true }],
  };
}
