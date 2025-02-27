import { JumpFunctionParameters, JumpFunctionReturnVal, StoredAnswer } from '../../../../../../store/types';

export default function func({
  answers, customParameters,
} : JumpFunctionParameters<{r1: number, r2: number, above: boolean, counter: number, name: string}>) : JumpFunctionReturnVal {
  let {
    r1, r2, above,
  } = customParameters;
  let counter = 0;
  const findLatestTrial = (trialAnswers: Record<string, StoredAnswer>) => {
    const trialKeys = Object.keys(trialAnswers)
      .filter((key) => key.startsWith('scatter1_12_trial_'))
      .map((key) => ({ key, number: parseInt(key.split('_').pop()!, 10) }))

      .filter((entry) => !Number.isNaN(entry.number))
      .sort((a, b) => b.number - a.number);

    return trialKeys.length > 0 ? trialKeys[0].key : null;
  };
  console.log('last trial', findLatestTrial(answers));
  const latestTrialKey = findLatestTrial(answers);
  if (latestTrialKey && answers[latestTrialKey]?.parameters) {
    ({
      r1, r2, above, counter,
    } = answers[latestTrialKey].parameters);
  }
  // if (answers.scatter1_12_trial_0?.answer && Object.keys(answers.scatter1_12_trial_0?.answer).length !== 0) {
  //   ({ counter } = answers.scatter1_12_trial_0.parameters);
  //   const trialKey = `scatter1_12_trial_${customParameters.counter}`;
  //   if (answers[trialKey]?.parameters) {
  //     ({
  //       r1, r2, above, counter,
  //     } = answers.scatter1_12_trial_1.parameters);
  //   }
  // }

  const roundToTwo = (num: number) => parseFloat((Math.round(num * 100) / 100).toString());
  console.log('counter', counter);
  const lastAnswer = answers[`scatter1_12_trial_${counter}`]?.answer?.scatterSelections;
  console.log('inside func');
  console.log('last answer', lastAnswer);
  console.log('all answers', answers);
  console.log('parameters r1, r2, above', r1, r2, above);
  if (answers?.scatter1_12_trial_1?.answer) {
    if (Object.keys(answers.scatter1_12_trial_1.answer).length === 0) {
      console.log('Answer is an empty object');
    } else {
      console.log('Answer is not an empty object');
    }
  }
  // check if answers?.scatter1_12_trial_1?.answer this answer is not a empty object
  // if it is not empty then we can
  // console.log('Scatter Selections:', answers?.scatter1_12_trial_0?.answer?.scatterSelections);
  // console.log('parameters:', customParameters);
  if (lastAnswer) {
    // const scatterSelections = answers.scatterSelections as StoredAnswer[];
    // const lastSelection = scatterSelections[scatterSelections.length - 1];
    // console.log(answers.scatterSelections);

    const correctAnswer = above ? 2 : 1;
    const lastAnswerCorrect = lastAnswer === correctAnswer;

    console.log(`Last Answer: ${lastAnswer}, Expected: ${correctAnswer}, Correct: ${lastAnswerCorrect}`);

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
    console.log(`Updated r1: ${r1}, Updated r2: ${r2}, Counter: ${counter}`);
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
