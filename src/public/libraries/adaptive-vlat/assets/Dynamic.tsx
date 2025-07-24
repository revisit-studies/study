import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../../../store/types';
// @ts-ignore
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
  // console.log(nxtidx,'nxtidx');
  // console.log(correctOption,'correctOption');

  if (topAnswer.length === 27) {
    return { component: null };
  }
  // console.log(correctOption)

  return {
    component: 'vlat-trial',
    parameters: {
      activeQuestionIdx: nxtidx,
      qidx: qid.length,
      score,
    },
    correctAnswer: [{ id: taskid, answer: String.fromCharCode(65 + correctOption) }],
  };
}

// call remote API if Async is implemented
// const getNextQuestion = async () => {
//     // Default options are marked with *
//     let formData = new FormData();
//     formData.append('qid', JSON.stringify([10]));
//     formData.append('correct', JSON.stringify([0]));
//     const response = await fetch(nextQuestionURL, {
//         method: 'POST',
//         headers: {
//             'Access-Control-Allow-Origin' : '*',
//             'Access-Control-Allow-Methods':'GET,PUT,POST,DELETE,PATCH,OPTIONS',
//         },
//         mode: 'cors',
//         cache: 'no-cache',
//         body: formData
//     });
//     return await response.json();
// }
// const resp = await getNextQuestion()
// console.log(resp, 'resp')

// loadPyodide({
//     indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
// }).then((pyodide) => {
//     pyodide.runPythonAsync('print("Hello from Python!")').then(() => {
//         return {
//             component: 'VlatTrial',
//             parameters: {
//                 activeQuestionIdx: 11,
//             },
//             correctAnswer: [{ id: taskid, answer: 'A' }],
//         };
//     })
// })
