import { JumpFunctionParameters, JumpFunctionReturnVal, StoredAnswer } from '../../../../../../store/types';

export default function func({
  answers, customParameters,
} : JumpFunctionParameters<{r1: number, r2: number, above: boolean, counter: number, name: string}>) : JumpFunctionReturnVal {
  let {
    r1, r2, above,
  } = customParameters;
  const { name } = customParameters;
  let counter = 0;
  const findLatestTrial = (trialAnswers: Record<string, StoredAnswer>) => {
    const trialKeys = Object.keys(trialAnswers)
      .filter((key) => key.startsWith('scatter1_12_trial_'))
      .map((key) => ({ key, number: parseInt(key.split('_').pop()!, 10) }))

      .filter((entry) => !Number.isNaN(entry.number))
      .sort((a, b) => b.number - a.number);

    return trialKeys.length > 0 ? trialKeys[0].key : null;
  };
  const latestTrialKey = findLatestTrial(answers);
  if (latestTrialKey && answers[latestTrialKey]?.parameters) {
    ({
      r1, r2, above, counter,
    } = answers[latestTrialKey].parameters);
  }

  const roundToTwo = (num: number) => parseFloat((Math.round(num * 100) / 100).toString());
  const lastAnswer = answers[`${name}_12_trial_${counter}`]?.answer?.scatterSelections;

  if (lastAnswer) {
    const correctAnswer = above ? 2 : 1;
    const lastAnswerCorrect = lastAnswer === correctAnswer;

    if (above && lastAnswerCorrect) {
      if (r2 - r1 <= 0.01) {
        counter = 10;
      } else {
        r2 = roundToTwo(Math.max(r2 - 0.01, 0.01));
      }
    } else if (above && !lastAnswerCorrect) {
      r2 = roundToTwo(Math.min(r2 + 0.03, 1));
    } else if (!above && lastAnswerCorrect) {
      if (r1 - r2 <= 0.01) {
        counter = 10;
      } else {
        r2 = roundToTwo(Math.max(r2 + 0.01, 0.01));
      }
    } else if (!above && !lastAnswerCorrect) {
      r2 = roundToTwo(Math.max(r2 - 0.03, 0.01));
    }

    counter += 1;
  }

  if (counter === 10) {
    return {
      component: null,
    };
  }

  return {
    component: 'trial',
    parameters: {
      r1, r2, above, counter,
    },
  };
}
