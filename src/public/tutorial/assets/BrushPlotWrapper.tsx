/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { BrushParams, BrushState } from '../../example-brush-interactions/assets/types';
import { BrushPlot } from '../../example-brush-interactions/assets/BrushPlot';

export default function BrushPlotWrapper({ state, params, onStateChange } : {state?: BrushState, params: BrushParams, onStateChange?: (b: BrushState) => void}) {
  return <BrushPlot parameters={params} setAnswer={() => null} provenanceState={state ? { all: state } as any : undefined} updateState={onStateChange || (() => null)} />;
}
