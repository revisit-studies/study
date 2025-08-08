import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../../../store/types';
// @ts-expect-error
import { getVLATnextqid } from './utils';
import { VLATQuestions } from './vlatQ';

export default function Dynamic({ answers }: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  const taskid = 'vlatResp';

  const topAnswer = Object.entries(answers)
    .filter(([key, _]) => key.startsWith('dynamicBlock'))
    .filter(([_, value]) => value.endTime > -1);

  const qid : number[] = [];
  const correct : number[] = [];

  topAnswer.forEach((item) => {
    const qidx = item[1].parameters.activeQuestionIdx;
    const cor = item[1].answer[taskid] === item[1].correctAnswer[0].answer;
    qid.push(+qidx);
    correct.push(cor ? 1 : 0);
  });
  const [nxtidx, score] = getVLATnextqid(qid, correct);
  const correctOption = +VLATQuestions.filter((q) => q.originID === nxtidx)[0].trueAnswer;

  if (topAnswer.length === 27) {
    return { component: null };
  }

  return {
    component: '$adaptive-vlat.components.VlatTrial',
    parameters: {
      activeQuestionIdx: nxtidx,
      qidx: qid.length,
      score,
    },
    correctAnswer: [{ id: taskid, answer: String.fromCharCode(65 + correctOption) }],
  };
}
