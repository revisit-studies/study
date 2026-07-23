import { StimulusParams } from '../../../store/types';

export default function Summary({
  answers,
  parameters,
}: StimulusParams<{ inc: 'base' | 'inc' }>) {
  const correct = Object.values(answers).filter((answer) => (
    answer.answer.taskid === 'test' && answer.answer.correct === true
  )).length;
  const bonus = Math.round(correct * 5) / 100;

  return (
    <div className="chart-wrapper">
      <p>
        You have completed all the trials! You correctly answered <b>{correct}/65</b> trials.
      </p>
      {parameters.inc === 'inc' && <p>This translates to a bonus of ${bonus}.</p>}
      <p>Please answer the following questions about your experience.</p>
    </div>
  );
}
