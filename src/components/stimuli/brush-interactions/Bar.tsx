import { useResizeObserver } from '@mantine/hooks';
import { useMemo } from 'react';
import ColumnTable from 'arquero/dist/types/table/column-table';


import * as d3 from 'd3';
import { XAxisBar } from './XAxisBar';
import { YAxisBar } from './YAxisBar';
import { BrushParams } from './BrushPlot';
import { Loader, Tooltip } from '@mantine/core';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any


const margin = {
    top: 15,
    left: 100,
    right: 15,
    bottom: 50
};

export function Bar({ fullTable, barsTable, parameters, data } : {fullTable: ColumnTable | null, barsTable: ColumnTable | null, parameters: BrushParams, data: any[]}) {
    const [ ref, { height: originalHeight, width: originalWidth } ] = useResizeObserver();

    const width = useMemo(() => {
        return originalWidth - margin.left - margin.right;
    }, [originalWidth]);

    const height = useMemo(() => {
        return originalHeight - margin.top - margin.bottom;
    }, [originalHeight]);

    const colorScale = useMemo(() => {
        const categories = Array.from(new Set(data.map((car) => car[parameters.category])));
        return d3.scaleOrdinal(d3.schemeTableau10).domain(categories);
    }, [data, parameters.category]);

    const xScale = useMemo(() => {
        if(!barsTable) {
            return null;
        }
        return d3.scaleLinear([margin.left, width + margin.left]).domain([0, d3.max(barsTable.objects().map((obj: any) => obj.count)) as any]);
    }, [barsTable, width]);


    const yScale = useMemo(() => {
        if(!barsTable) {
            return null;
        }

        return d3.scaleBand([margin.top, height + margin.top]).domain(barsTable.array(parameters.category).sort()).paddingInner(0.1);
    }, [barsTable, height, parameters.category]);


    const rects = useMemo(() => {
        if(!xScale || !yScale || !colorScale || !barsTable) {
            return null;
        }

        return (barsTable.objects() as any[]).map((car: any, i) => {
            if(car[parameters.category] === null || car.count === null) {
                return null;
            }

            return <Tooltip.Floating key={i} label={car.count} withinPortal>
                <rect key={i} x={margin.left} y={yScale(car[parameters.category])} fill={colorScale(car[parameters.category])} height={yScale.bandwidth()} width={xScale(car.count) - margin.left}/>
                </Tooltip.Floating>;
        });
    }, [barsTable, colorScale, parameters.category, xScale, yScale]);


    return yScale && xScale ? (
        <svg ref={ref} style={{height: '200px', width: '500px'}}>
            <XAxisBar xScale={xScale} yRange={yScale.range() as [number, number]} vertPosition={height + margin.top} showLines={false} label={'Count'} ticks={xScale.ticks(5).map((value) => ({
                value: value.toString(),
                offset: xScale(value),
            }))}/>
            
            {yScale ? <YAxisBar yScale={yScale} horizontalPosition={margin.left} xRange={xScale.range() as [number, number]} label={parameters.category} ticks={colorScale.domain().map((country) => {
                return {
                    value: country,
                    offset: yScale(country)! + yScale.bandwidth() / 2,
                };
            })} /> : null }
            { rects }
        </svg>
    ) : <Loader/>;
}

export default Bar;