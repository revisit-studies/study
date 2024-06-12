/* eslint-disable @typescript-eslint/no-explicit-any */

import { Loader, Stack } from '@mantine/core';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { from, escape } from 'arquero';
import ColumnTable from 'arquero/dist/types/table/column-table';
import { Registry, initializeTrrack } from '@trrack/core';

import * as d3 from 'd3';
import debounce from 'lodash.debounce';
import { Scatter } from './Scatter';
import { Bar } from './Bar';
import { StimulusParams } from '../../../store/types';
import { BrushParams, BrushState, SelectionType } from './types';

export function BrushPlot({ parameters, setAnswer }: StimulusParams<BrushParams>) {
  const [filteredTable, setFilteredTable] = useState<ColumnTable | null>(null);
  const [brushState, setBrushState] = useState<BrushState>({
    hasBrush: false, x1: 0, y1: 0, x2: 0, y2: 0, ids: [],
  });

  const [data, setData] = useState<any[] | null>(null);

  // load data
  useEffect(() => {
    d3.csv(`./data/${parameters.dataset}.csv`).then((_data) => {
      setData(_data);
    });
  }, [parameters]);

  const fullTable = useMemo(() => {
    if (data) {
      return from(data);
    }

    return null;
  }, [data]);

  // creating provenance tracking
  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const brush = reg.register('brush', (state, currBrush: BrushState) => {
      state.all = { brush: currBrush };
      return state;
    });

    const brushMove = reg.register('brushMove', (state, currBrush: BrushState) => {
      state.all = { brush: currBrush };
      return state;
    });

    const brushResize = reg.register('brushResize', (state, currBrush: BrushState) => {
      state.all = { brush: currBrush };
      return state;
    });

    const clearBrush = reg.register('brushClear', (state, currBrush: BrushState) => {
      state.all = { brush: currBrush };
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        all: {
          hasBrush: false, x1: null, x2: null, y1: null, y2: null, ids: [],
        },
      },
    });

    return {
      actions: {
        brush,
        brushMove,
        brushResize,
        clearBrush,
      },
      trrack: trrackInst,
    };
  }, []);

  const moveBrushCallback = useCallback((selType: SelectionType, state: BrushState) => {
    if (selType === 'drag') {
      trrack.apply('Move Brush', actions.brushMove(state));
    } else if (selType === 'handle') {
      trrack.apply('Brush', actions.brush(state));
    }
  }, [actions, trrack]);

  // debouncing the trrack callback
  const debouncedCallback = useMemo(() => debounce(moveBrushCallback, 100, { maxWait: 100 }), [moveBrushCallback]);

  // brush callback, updating state, finding the selected points, and pushing to trrack
  const brushedSpaceCallback = useCallback((sel: [[number | null, number | null], [number | null, number | null]], xScale: any, yScale: any, selType: SelectionType, ids?: string[]) => {
    if (!xScale || !yScale) {
      return;
    }

    const xMin = xScale.invert(sel[0][0] || brushState.x1);
    const xMax = xScale.invert(sel[1][0] || brushState.x2);

    const yMin = yScale.invert(sel[1][1] || brushState.y2);
    const yMax = yScale.invert(sel[0][1] || brushState.y1);

    let _filteredTable = null;
    if (selType === 'clear') {
      _filteredTable = fullTable;
    } else if (ids) {
      const idSet = new Set(ids);
      _filteredTable = fullTable!.filter(escape((d: any) => idSet.has(d[parameters.ids])));
    } else if (parameters.brushType === 'Axis Selection') {
      _filteredTable = fullTable!.filter(escape((d: any) => new Date(d[parameters.x]) >= new Date(xMin) && new Date(d[parameters.x]) <= new Date(xMax) && d[parameters.y] >= yMin && d[parameters.y] <= yMax));
    } else {
      _filteredTable = fullTable!.filter(escape((d: any) => d[parameters.x] >= xMin && d[parameters.x] <= xMax && d[parameters.y] >= yMin && d[parameters.y] <= yMax));
    }

    const newState = {
      x1: sel[0][0] || brushState?.x1 || 0, x2: sel[1][0] || brushState?.x2 || 0, y1: sel[0][1] || brushState?.y1 || 0, y2: sel[1][1] || brushState?.y2 || 0, hasBrush: selType !== 'clear', ids: selType !== 'clear' ? _filteredTable?.array('id') : [],
    };

    setBrushState(newState);

    if (selType === 'drag' || selType === 'handle') {
      debouncedCallback(selType, newState);
    } else if (selType === 'clear') {
      trrack.apply('Clear Brush', actions.clearBrush(newState));
    }

    setFilteredTable(_filteredTable);

    setAnswer({
      status: true,
      provenanceGraph: trrack.graph.backend,
      answers: {},
    });
  }, [brushState, fullTable, parameters, trrack, setAnswer, debouncedCallback, actions]);

  // Which table the bar chart uses, either the base or the filtered table if any selections
  const barsTable = useMemo(() => {
    if (filteredTable) {
      return filteredTable?.groupby(parameters.category).count();
    }
    if (fullTable) {
      return fullTable?.groupby(parameters.category).count();
    }
    return null;
  }, [filteredTable, fullTable, parameters.category]);

  const filteredCallback = useCallback((c: ColumnTable | null) => {
    setFilteredTable(c);
  }, []);

  return data ? (
    <Stack gap="xs">
      <Scatter brushedPoints={brushState?.ids} data={data} params={parameters} brushType={parameters.brushType} setBrushedSpace={brushedSpaceCallback} brushState={brushState} setFilteredTable={filteredCallback} />
      <Bar data={data} parameters={parameters} barsTable={barsTable} />
    </Stack>
  ) : <Loader />;
}

export default BrushPlot;
