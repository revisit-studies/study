import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../store/types';

export default function func({ components, answers } : JumpFunctionParameters) : JumpFunctionReturnVal {
  const topAnswerLength = Math.max(...Object.keys(answers).filter((answer) => answer.startsWith('loopingBlock_1_')).map((answer) => +(answer.split('_')[3])));

  if (topAnswerLength > 5) {
    return { component: null };
  }
  return { component: 'reactComponent', parameters: { n: topAnswerLength } };
}
