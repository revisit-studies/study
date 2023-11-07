
import {Button, Group, Loader, SegmentedControl, Stack} from '@mantine/core';
import { StimulusParams } from '../../../store/types';
import Bar from './Bar';
import Scatter from './Scatter';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {from} from 'arquero';
import ColumnTable from 'arquero/dist/types/table/column-table';
import { Registry, initializeTrrack } from '@trrack/core';
import { useLocation } from 'react-router-dom';

import * as d3 from 'd3';

export interface BrushState {
    hasBrush: boolean;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  }

export interface BrushParams {brushType: BrushNames, dataset: string, x: string, y: string, category: string, ids: string, dataType?: 'date'}

export type BrushNames = 'Rectangular Selection' | 'Axis Selection' | 'Slider Selection' | 'Paintbrush Selection'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BrushPlot({ parameters, trialId, setAnswer }: StimulusParams<BrushParams>) {
    const [filteredTable, setFilteredTable] = useState<ColumnTable | null>(null);
    const [brushedSpace, setBrushedSpace] = useState<[[number, number], [number, number]] | null>(null);

    const [isEraser, setIsEraser] = useState<boolean>(false);

    const [data, setData] = useState<any[] | null>(null);

    useEffect(() => {
        d3.csv(`./data/${parameters.dataset}.csv`).then((data) => {
            setData(data);
        });
    }, [parameters]);

    const id = useLocation().pathname;
    
    const brushedSpaceCallback = useCallback((sel: [[number | null, number | null], [number | null, number | null]]) => {
        if(!brushedSpace) {
            setBrushedSpace(sel as any);
            return;
        }
        
        setBrushedSpace([[sel[0][0] || brushedSpace[0][0], sel[0][1] || brushedSpace[0][1]], [sel[1][0] || brushedSpace[1][0], sel[1][1] || brushedSpace[1][1]]]);
    }, [brushedSpace]);

    const selectedIds = useMemo(() => {
        return filteredTable?.array('id') || [];
    }, [filteredTable]);

    const brushState = useMemo(() => {
        return {
            hasBrush: brushedSpace ? true : false,
            x1: brushedSpace ? brushedSpace[0][0] : 0,
            x2: brushedSpace ? brushedSpace[1][0] : 0,
            y1: brushedSpace ? brushedSpace[0][1] : 0,
            y2: brushedSpace ? brushedSpace[1][1] : 0,
        };
    }, [brushedSpace]);

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

    const brushCallback = useCallback((sel: [[number, number], [number, number]], type: string) => {
        // if(sel === null) {
        //     trrack.apply('Clear Brush', actions.brushMove({hasBrush: false, x1: 0, x2: 0, y1: 0, y2: 0}));
        // }
        // else if(type === 'drag') {
        //     trrack.apply('Move Brush', actions.brushMove({hasBrush: true, x1: sel[0][0], x2: sel[1][0], y1: sel [0][1], y2: sel[1][1]}));
        // }
        // else if(type === 'handle') {
        //     trrack.apply('Brush', actions.brush({hasBrush: true, x1: sel[0][0], x2: sel[1][0], y1: sel [0][1], y2: sel[1][1]}));
        // }

        setAnswer({
            trialId: id,
            status: true,
            provenanceGraph: trrack.graph.backend,
            answers: {}
          });
    }, [actions, id, setAnswer, trrack]);
    
    const fullTable = useMemo(() => {
        if(data) {
            return from(data);
        }
        
        return null;
    }, [data]);

    const barsTable = useMemo(() => {
        return filteredTable ? filteredTable.groupby(parameters.category).count() : fullTable ? fullTable.groupby(parameters.category).count() : null;
    }, [filteredTable, fullTable, parameters.category]);

    const filteredCallback = useCallback((c: ColumnTable | null) => {
        setFilteredTable(c);
    }, []);

    return data ? (
        <Stack spacing="xs">
            <Scatter brushedPoints={selectedIds} data={data} params={parameters} filteredTable={filteredTable} onBrush={brushCallback} brushType={parameters.brushType}  setBrushedSpace={brushedSpaceCallback} brushState={brushState} fullTable={fullTable} setFilteredTable={filteredCallback}/>
            <Bar data={data} parameters={parameters} fullTable={filteredTable ? filteredTable : fullTable} barsTable={barsTable}/>
        </Stack>
  ) : <Loader/>;
}

export default BrushPlot;