import { useCallback, useMemo, useState } from 'react';
import { Registry } from '@trrack/core';
import BrushPlotWrapper from './BrushPlotWrapper';
import { StimulusParams } from '../../../store/types';
import { BrushParams, BrushState } from '../../example-brush-interactions/assets/types';
import { useRevisitTrrack } from '../../../store/hooks/useRevisitTrrack';

export default function ReactExample({ parameters, setAnswer, provenanceState }: StimulusParams<BrushParams, BrushState>) {
  const [brushState, setBrushState] = useState<BrushState>();

  // creating provenance tracking
  const { actions, registry } = useMemo(() => {
    const reg = Registry.create();

    const brush = reg.register('brush', (state, currBrush: BrushState) => {
      state.brush = currBrush;
      return state;
    });

    return {
      actions: {
        brush,
      },
      registry: reg,
    };
  }, []);
  const trrack = useRevisitTrrack({
    registry,
    initialState: {
      brush: {
        hasBrush: false, x1: null, x2: null, y1: null, y2: null, ids: [],
      },
    },
  });

  const onStateChange = useCallback((b: BrushState) => {
    setBrushState(b);
    trrack.apply('Brush', actions.brush(b));

    setAnswer({
      answers: {},
      status: true,
    });
  }, [actions, setAnswer, trrack]);

  return (
    <BrushPlotWrapper params={parameters} state={provenanceState || brushState} onStateChange={onStateChange} answers={{}} />
  );
}
