import { useEffect, useState } from 'react';
import * as d3 from 'd3';

import ColumnTable from 'arquero/dist/types/table/column-table';

import {escape} from 'arquero';
import { BrushParams } from './BrushPlot';

const BRUSH_SIZE = 15;

export function Paintbrush(
    {   xScale, 
        yScale, 
        setFilteredTable, 
        table, 
        filteredTable,
        params,
        data,
        isSelect = true
    } : 
    {   
        data: any[]
        xScale: d3.ScaleLinear<number, number>, 
        yScale: d3.ScaleLinear<number, number>, 
        setFilteredTable: (c: ColumnTable | null) => void, 
        filteredTable: ColumnTable | null, 
        table: ColumnTable | null,
        params: BrushParams,
        isSelect?: boolean
}) {
    const [brushPosition, setBrushPosition] = useState<number[]>([0, 0]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBrushing, setIsBrushing] = useState<boolean>(false);

    useEffect(() => {
        if(filteredTable === null && selectedIds.length !== 0) {
            setSelectedIds([]);
        } 
    }, [filteredTable, selectedIds.length]);

    useEffect(() => {
        const svg = d3.select<SVGGElement, any>('#scatterSvgBrushStudy');

        if(svg) {
            const svgPos = svg.node()!.getBoundingClientRect();
            svg.on('mousemove', (e: React.MouseEvent) => {

                const pos = [e.clientX - svgPos.x, e.clientY - svgPos.y];
                setBrushPosition(pos);

                if(isBrushing) {
                    const selected = data.filter((car) => Math.abs(xScale(car[params.x]) - pos[0]) < BRUSH_SIZE && Math.abs(yScale(car[params.y]) - pos[1]) < BRUSH_SIZE);

                    if(e.ctrlKey || e.metaKey || !isSelect) {
                        const set = new Set(selectedIds);
                        selected.forEach((sel) => {
                            if(set.has(sel[params.ids])) {
                                set.delete(sel[params.ids]);
                            }
                        });
                        console.log(Array.from(set));
                        setSelectedIds(Array.from(set));
                    }
                    else {
                        console.log(selected);
                        setSelectedIds(Array.from(new Set([...selectedIds, ...selected.map((car) => car[params.ids])])));
                    }
                }
            });
 
            svg.on('mousedown', (e) => {
                setIsBrushing(true);
                e.stopPropagation();
                e.preventDefault();
            });

            svg.on('mouseup', (e) => {
                setIsBrushing(false);
            });
        }

    }, [data, isBrushing, isSelect, params.ids, params.x, params.y, selectedIds, xScale, yScale]);

    useEffect(() => {
        if(selectedIds.length === 0 || !table) {
            setFilteredTable(null);
            return;
        }

        const idSet = new Set(selectedIds);

        const newTable = table.filter(escape((d: any) => {
            return idSet.has(d[params.ids]);
        }));

        setFilteredTable(newTable);
    }, [params.ids, selectedIds, setFilteredTable, table]);
    
    return (
        <circle style={{cursor: isBrushing ? 'pointer' : 'default'}} r={BRUSH_SIZE} fill={'darkgray'} opacity={.5} cx={brushPosition[0]} cy={brushPosition[1]}></circle>
    );
}
