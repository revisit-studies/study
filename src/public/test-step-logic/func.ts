import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../store/types';

export default function func({ answers, customParameters } : JumpFunctionParameters<{name: string}>) : JumpFunctionReturnVal {
  const topAnswerLength = Object.keys(answers)
    .filter((answer) => answer.startsWith(`${customParameters.name}`))
    .length;

  if (topAnswerLength > 5) {
    return { component: null };
  }

  return { component: 'reactComponent', parameters: { n: topAnswerLength || 0 } };
}
