import { JumpFunctionParameters, JumpFunctionReturnVal } from '../../../store/types';
// @ts-ignore
import { getVLATnextqid } from './utils';

export default function Dynamic({ answers }: JumpFunctionParameters<never>): JumpFunctionReturnVal {
  const taskid = 'vlatResp';

  const topAnswerLength = Object.entries(answers)
    .filter(([key, _]) => key.startsWith('dynamicBlock'))
    .filter(([_, value]) => value.endTime > -1)
    .length;

  getVLATnextqid([10], [0]);

  if (topAnswerLength === 27) {
    return { component: null };
  }

  return {
    component: 'VlatTrial',
    parameters: {
      activeQuestionIdx: 10,
    },
    correctAnswer: [{ id: taskid, answer: 'A' }],
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
