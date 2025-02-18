import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../store/types';

export default function func({
  answers, customParameters,
} : JumpFunctionParameters<{name: string}>) : JumpFunctionReturnVal {
  const topAnswerLength = Math.max(0, ...Object.keys(answers).filter((answer) => answer.startsWith(`${customParameters.name}`)).map((answer) => +(answer.split('_')[3])));

  if (topAnswerLength > 5) {
    return { component: null };
  }

  return { component: 'reactComponent', parameters: { n: topAnswerLength || 0 } };
}
