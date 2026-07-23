import { useMemo } from 'react';
import { useNextStep } from '../../../store/hooks/useNextStep';
import { StimulusParams } from '../../../store/types';
import Comparison from './Comparison';

type TestParameters = {
  taskid: 'test';
  delta: number;
  r1: number;
  vis: 'pcp' | 'scatter';
};

type AttentionParameters = {
  taskid: 'attention';
  attentionIndex: number;
  r1: number;
  r2: number;
  vis: 'pcp' | 'scatter';
};

export default function Task({
  answers,
  parameters,
  setAnswer,
}: StimulusParams<TestParameters | AttentionParameters>) {
  const { goToNextStep } = useNextStep();
  const values = useMemo(() => {
    const r2 = parameters.taskid === 'test'
      ? Number((parameters.r1 + parameters.delta).toFixed(2))
      : parameters.r2;
    return Math.random() < 0.5 ? [parameters.r1, r2] : [r2, parameters.r1];
  }, [parameters]);
  const [valueA, valueB] = values;

  const completedTests = Object.values(answers).filter((answer) => answer.answer.taskid === 'test');
  const totalCorrect = completedTests.filter((answer) => answer.answer.correct === true).length;
  const trialIndex = completedTests.length + 1;
  const datasetFolder = parameters.taskid === 'test' ? 'test' : 'attention';
  const attentionSuffix = parameters.taskid === 'attention' ? `-${parameters.attentionIndex}` : '';

  const respond = (response: 1 | 2, correct: boolean) => {
    setAnswer({
      status: true,
      answers: {
        test: true,
        taskid: parameters.taskid,
        trial: parameters.taskid === 'test' ? trialIndex : parameters.attentionIndex,
        r1: parameters.r1,
        r2: parameters.taskid === 'test'
          ? Number((parameters.r1 + parameters.delta).toFixed(2))
          : parameters.r2,
        response,
        answer: valueA > valueB ? 1 : 2,
        correct,
        total: totalCorrect + (parameters.taskid === 'test' && correct ? 1 : 0),
      },
    });
    window.setTimeout(goToNextStep, 1000);
  };

  return (
    <Comparison
      datasetA={`${datasetFolder}/dataset_${valueA}${attentionSuffix}_size_100.csv`}
      datasetB={`${datasetFolder}/dataset_${valueB}${attentionSuffix}_size_100.csv`}
      onResponse={respond}
      progress={parameters.taskid === 'test' && trialIndex > 1
        ? `You've correctly answered ${totalCorrect} question(s) so far.`
        : undefined}
      title={parameters.taskid === 'test' ? `Trial number: ${trialIndex}/65` : 'Attention check'}
      valueA={valueA}
      valueB={valueB}
      vis={parameters.vis}
    />
  );
}
