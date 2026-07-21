import { useCallback, useState } from 'react';
import BrushPlotWrapper from './BrushPlotWrapper';
import { StimulusParams } from '../../../store/types';
import { BrushParams, BrushState } from '../../example-brush-interactions/assets/types';

type BrushProvenanceState = { all: { brush: BrushState } };

export default function ReactExample({
  parameters, setAnswer, provenanceState, useTrrack,
}: StimulusParams<BrushParams, BrushProvenanceState>) {
  const [brushState, setBrushState] = useState<BrushState>();

  const onStateChange = useCallback((b: BrushState) => {
    setBrushState(b);

    setAnswer({
      answers: {},
      status: true,
    });
  }, [setAnswer]);

  return (
    <BrushPlotWrapper params={parameters} state={provenanceState?.all.brush ?? brushState} onStateChange={onStateChange} answers={{}} useTrrack={useTrrack} />
  );
}
