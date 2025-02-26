/* eslint-disable prefer-const */
import { JumpFunctionParameters, JumpFunctionReturnVal, StoredAnswer } from '../../../../../../store/types';

export default function func({
  answers, customParameters,
} : JumpFunctionParameters<{r1: number, r2: number, above: boolean, counter: number, name: string}>) : JumpFunctionReturnVal {
  let {
    r1, r2, above, counter,
  } = customParameters;

  const roundToTwo = (num: number) => parseFloat((Math.round(num * 100) / 100).toString());
  // console.log('inside func');
  if (Array.isArray(answers.scatterSelections) && answers.scatterSelections.length > 0) {
    const scatterSelections = answers.scatterSelections as StoredAnswer[];
    const lastSelection = scatterSelections[scatterSelections.length - 1];

    const correctAnswer = above ? 2 : 1;
    const lastAnswerCorrect = Number(lastSelection.answer) === correctAnswer;

    // console.log(`Last Answer: ${lastSelection.answer}, Expected: ${correctAnswer}, Correct: ${lastAnswerCorrect}`);

    if (above && lastAnswerCorrect) {
      if (r2 - r1 <= 0.01) {
        counter = 50;
      } else {
        r2 = roundToTwo(Math.max(r2 - 0.01, 0.01));
      }
    } else if (above && !lastAnswerCorrect) {
      r2 = roundToTwo(Math.min(r2 + 0.03, 1));
    } else if (!above && lastAnswerCorrect) {
      if (r1 - r2 <= 0.01) {
        counter = 50;
      } else {
        r2 = roundToTwo(Math.max(r2 + 0.01, 0.01));
      }
    } else if (!above && !lastAnswerCorrect) {
      r2 = roundToTwo(Math.max(r2 - 0.03, 0.01));
    }

    counter += 1;
  }

  // console.log(`Updated r1: ${r1}, Updated r2: ${r2}, Counter: ${counter}`);

  return {
    component: 'trial',
    parameters: {
      r1, r2, above, counter,
    },
  };
}
