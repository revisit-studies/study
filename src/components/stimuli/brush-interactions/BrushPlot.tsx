
import {Button, Group, Loader, SegmentedControl, Stack} from '@mantine/core';
import { StimulusParams } from '../../../store/types';
import Bar from './Bar';
import Scatter from './Scatter';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {from, escape} from 'arquero';
import ColumnTable from 'arquero/dist/types/table/column-table';
import { Registry, initializeTrrack } from '@trrack/core';
import { useLocation } from 'react-router-dom';

import * as d3 from 'd3';
import { debounce } from 'lodash';

export interface BrushState {
    hasBrush: boolean;
    x1: number;
    x2: number;
    y1: number;
    y2: number;

    ids: string[];
  }

export type SelectionType = 'drag' | 'handle' | 'clear' | null

export interface BrushParams {brushType: BrushNames, dataset: string, x: string, y: string, category: string, ids: string, dataType?: 'date'}

export type BrushNames = 'Rectangular Selection' | 'Axis Selection' | 'Slider Selection' | 'Paintbrush Selection'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BrushPlot({ parameters, trialId, setAnswer }: StimulusParams<BrushParams>) {
    const [filteredTable, setFilteredTable] = useState<ColumnTable | null>(null);
    const [brushState, setBrushState] = useState<BrushState>({hasBrush: false, x1: 0, y1: 0, x2: 0, y2: 0, ids: []});

    const [data, setData] = useState<any[] | null>(null);

    // load data
    useEffect(() => {
        d3.csv(`./data/${parameters.dataset}.csv`).then((data) => {
            setData(data);
        });
    }, [parameters]);

    const fullTable = useMemo(() => {
        if(data) {
            return from(data);
        }
        
        return null;
    }, [data]);

    //get trial id
    const id = useLocation().pathname;

    // creating provenance tracking
    const { actions, trrack } = useMemo(() => {
        const reg = Registry.create();
    
        const brush = reg.register('brush', (state, brush: BrushState) => {
            state = {...brush};
            return state;
        });

        const brushMove = reg.register('brushMove', (state, brush: BrushState) => {
            state = {...brush};
            return state;
        });

        const brushResize = reg.register('brushResize', (state, brush: BrushState) => {
            state = {...brush};
            return state;
        });

        const clearBrush = reg.register('brushClear', (state, brush: BrushState) => {
            state = {...brush};
            return state;
        });
    
        const trrackInst = initializeTrrack({registry: reg, initialState: {hasBrush: false, x1: null, x2: null, y1: null, y2: null} });
    
        return {
            actions: {
              brush,
              brushMove,
              brushResize,
              clearBrush,
            },
            trrack: trrackInst
        };
    }, []);

    const moveBrushCallback = useCallback((selType: SelectionType, state: BrushState) => {
        if(selType === 'drag') {
            trrack.apply('Move Brush', actions.brushMove(state));
        }
        else if(selType === 'handle') {
            trrack.apply('Brush', actions.brush(state));
        }
    }, [actions, trrack]);

    //debouncing the trrack callback
    const debouncedCallback = useMemo(() => {
        return debounce(moveBrushCallback, 100, {maxWait: 100});
    }, [moveBrushCallback]);

    // brush callback, updating state, finding the selected points, and pushing to trrack
    const brushedSpaceCallback = useCallback((sel: [[number | null, number | null], [number | null, number | null]], xScale: any, yScale: any, selType: SelectionType, ids?: string[]) => {
        if(!xScale || !yScale) {
            return;
        }

        const xMin = xScale.invert(sel[0][0] || brushState.x1);
        const xMax = xScale.invert(sel[1][0] || brushState.x2);

        const yMin = yScale.invert(sel[1][1] || brushState.y2);
        const yMax = yScale.invert(sel[0][1] || brushState.y1);


        let filteredTable = null;
        if(selType === 'clear') {
            filteredTable = fullTable;
        }
        else if(ids) {
            const idSet = new Set(ids);
            filteredTable = fullTable!.filter(escape((d: any) => {
                return idSet.has(d[parameters.ids]);
            }));
        }
        else if(parameters.brushType === 'Axis Selection') {
            filteredTable = fullTable!.filter(escape((d: any) => {
                return new Date(d[parameters.x]) >= new Date(xMin) && new Date(d[parameters.x]) <= new Date(xMax) && d[parameters.y] >= yMin && d[parameters.y] <= yMax;
            }));
        }
        else {
            filteredTable = fullTable!.filter(escape((d: any) => {
                return d[parameters.x] >= xMin && d[parameters.x] <= xMax && d[parameters.y] >= yMin && d[parameters.y] <= yMax;
            }));
        }
        
        const newState = {x1: sel[0][0] || brushState?.x1 || 0, x2: sel[1][0] || brushState?.x2 || 0, y1: sel[0][1] || brushState?.y1 || 0, y2: sel[1][1] || brushState?.y2 || 0, hasBrush: selType !== 'clear', ids: selType !== 'clear' ? filteredTable?.array('id') : []};

        setBrushState(newState);

        if(selType === 'drag' || selType === 'handle') {
            debouncedCallback(selType, newState);

            console.log(Object.keys(trrack.graph.backend.nodes).length);
        }
        else if(selType === 'clear') {
            trrack.apply('Clear Brush', actions.clearBrush(newState));
        }

        setFilteredTable(filteredTable);

        setAnswer({
            trialId: id,
            status: true,
            provenanceGraph: trrack.graph.backend,
            answers: {}
          });
    }, [brushState, fullTable, parameters, trrack, id, setAnswer, debouncedCallback, actions]);

    // Which table the bar chart uses, either the base or the filtered table if any selections
    const barsTable = useMemo(() => {
        return filteredTable ? filteredTable.groupby(parameters.category).count() : fullTable ? fullTable.groupby(parameters.category).count() : null;
    }, [filteredTable, fullTable, parameters.category]);

    const filteredCallback = useCallback((c: ColumnTable | null) => {
        setFilteredTable(c);
    }, []);

    return data ? (
        <Stack spacing="xs">
            <Scatter brushedPoints={brushState?.ids} data={data} params={parameters} filteredTable={filteredTable} brushType={parameters.brushType}  setBrushedSpace={brushedSpaceCallback} brushState={brushState} fullTable={fullTable} setFilteredTable={filteredCallback}/>
            <Bar data={data} parameters={parameters} fullTable={filteredTable ? filteredTable : fullTable} barsTable={barsTable}/>
        </Stack>
  ) : <Loader/>;
}

export default BrushPlot;