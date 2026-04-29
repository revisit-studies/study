import React, { useCallback, useMemo, useState } from 'react';
import { initializeTrrack, Registry } from '@trrack/core';
import BrushPlotWrapper from '../BrushPlotWrapper';
import { StimulusParams } from '../../../../store/types';
import { BrushParams, BrushState } from '../../../example-brush-interactions/assets/types';

export default function ReactExample({ parameters, setAnswer, provenanceState } : StimulusParams<BrushParams, BrushState>) {
  const [brushState, setBrushState] = useState<BrushState>();

  // creating provenance tracking
  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const brush = reg.register('brush', (state, currBrush: BrushState) => {
      state.brush = currBrush;
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        brush: {
          hasBrush: false, x1: null, x2: null, y1: null, y2: null, ids: [],
        },
      },
    });

    return {
      actions: {
        brush,
      },
      trrack: trrackInst,
    };
  }, []);

  const onStateChange = useCallback((b: BrushState) => {
    setBrushState(b);
    trrack.apply('Brush', actions.brush(b));

    setAnswer({
      answers: {},
      status: true,
      provenanceGraph: trrack.graph.backend,
    });
  }, [actions, setAnswer, trrack]);

  return (
    <BrushPlotWrapper params={parameters} state={provenanceState || brushState} onStateChange={onStateChange} answers={{}} />
  );
}
