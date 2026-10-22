import { StimulusParams } from '../../../store/types';
import Comparison from './Comparison';

type PracticeParameters = {
  r1Training: number;
  r2Training: number;
  vis: 'pcp' | 'scatter';
};

export default function Practice({ parameters, setAnswer }: StimulusParams<PracticeParameters>) {
  const { r1Training: valueA, r2Training: valueB } = parameters;

  return (
    <Comparison
      datasetA={`training/dataset_${valueA}_size_100.csv`}
      datasetB={`training/dataset_${valueB}_size_100.csv`}
      onResponse={(_, correct) => setAnswer({ status: true, answers: { training: correct } })}
      showCorrelations
      title="Training Task"
      valueA={valueA}
      valueB={valueB}
      vis={parameters.vis}
    />
  );
}
