/* eslint-disable @typescript-eslint/no-explicit-any */

import { useResizeObserver } from '@mantine/hooks';
import { useEffect, useMemo, useState } from 'react';
import ColumnTable from 'arquero/dist/types/table/column-table';
import * as d3 from 'd3';
import {
  Button, Group, RangeSlider, SegmentedControl, Stack, Text,
} from '@mantine/core';
import { XAxisBar } from './XAxisBar';
import { YAxis } from './YAxis';
import { Paintbrush } from './Paintbrush';
import { BrushNames, BrushParams, BrushState } from './types';

const margin = {
  top: 15,
  left: 100,
  right: 15,
  bottom: 70,
};

export function Scatter({
  setFilteredTable,
  brushState,
  setBrushedSpace,
  brushType,
  params,
  data,
  brushedPoints,
}:
    {
        brushedPoints: string[],
        data: any[],
        params: BrushParams,
        setFilteredTable: (c: ColumnTable | null) => void,
        brushState: BrushState,
        setBrushedSpace: (brush: [[number | null, number | null], [number | null, number | null]], xScale: any, yScale: any, selType: 'drag' | 'handle' | 'clear' | null, ids?: string[]) => void,
        brushType: BrushNames
    }) {
  const [ref, { height: originalHeight, width: originalWidth }] = useResizeObserver();

  const [brushXRef] = useResizeObserver();
  const [brushYRef] = useResizeObserver();

  const [isPaintbrushSelect, setIsPaintbrushSelect] = useState<boolean>(true);

  const width = useMemo(() => originalWidth - margin.left - margin.right, [originalWidth]);

  const height = useMemo(() => originalHeight - margin.top - margin.bottom, [originalHeight]);

  const colorScale = useMemo(() => {
    const cats = Array.from(new Set(data.map((d) => d[params.category])));
    return d3.scaleOrdinal(d3.schemeTableau10).domain(cats);
  }, [data, params.category]);

  const {
    xMin, yMin, xMax, yMax,
  } = useMemo(() => {
    const xData: number[] = data.map((d) => +d[params.x]).filter((val) => val !== null) as number[];
    const [_xMin, _xMax] = d3.extent(xData) as [number, number];

    const yData: number[] = data.map((d) => +d[params.y]).filter((val) => val !== null) as number[];
    const [_yMin, _yMax] = d3.extent(yData) as [number, number];

    return {
      xMin: _xMin,
      xMax: _xMax,
      yMin: _yMin,
      yMax: _yMax,
    };
  }, [data, params.x, params.y]);

  const xScale = useMemo(() => {
    const range = xMax - xMin;
    if (width <= 0) {
      return null;
    }

    if (params.dataType === 'date') {
      return d3.scaleTime([margin.left, width + margin.left]).domain([new Date('2014-12-20'), new Date('2016-01-10')]);
    }

    return d3.scaleLinear([margin.left, width + margin.left]).domain([xMin - range / 10, xMax + range / 10]).nice();
  }, [params.dataType, width, xMax, xMin]);

  const yScale = useMemo(() => {
    const range = yMax - yMin;

    if (height <= 0) {
      return null;
    }

    return d3.scaleLinear([height + margin.top, margin.top]).domain([yMin - range / 10, yMax + range / 10]).nice();
  }, [height, yMax, yMin]);

  // create brushes
  const clearCallback = useMemo(() => {
    if (!xScale || !yScale) {
      return () => null;
    }

    if (brushType === 'Axis Selection') {
      const brushX = d3.brushX().extent([[margin.left, margin.top + height - 5], [margin.left + width, margin.top + height + 5]]).on('brush end', (e) => {
        if (e.sourceEvent !== undefined) {
          setBrushedSpace([[e.selection[0], null], [e.selection[1], null]], xScale, yScale, e.mode);
        }
      });

      const brushY = d3.brushY().extent([[margin.left - 5, margin.top], [margin.left + 5, margin.top + height]]).on('brush end', (e) => {
        if (e.sourceEvent !== undefined) {
          setBrushedSpace([[null, e.selection[0]], [null, e.selection[1]]], xScale, yScale, e.mode);
        }
      });

      if (brushXRef.current && brushYRef.current) {
        d3.select(brushYRef.current).call(brushY);
        d3.select(brushXRef.current).call(brushX);

        if (!brushState.hasBrush) {
          d3.select(brushYRef.current).call(brushY.move, [yScale(yMax), yScale(yMin)]);
          d3.select(brushXRef.current).call(brushX.move, [xScale(new Date('2015-01-02')), xScale(new Date('2015-12-31'))]);
          setBrushedSpace([[xScale(new Date('2015-01-02')), yScale(yMax)], [xScale(new Date('2015-12-31')), yScale(yMin)]], xScale, yScale, 'drag');
        }
      }

      return () => {
        d3.select(brushYRef.current).call(brushY.move, [yScale(yMax), yScale(yMin)]);
        d3.select(brushXRef.current).call(brushX.move, [xScale(new Date('2015-01-02')), xScale(new Date('2015-12-31'))]);
        setBrushedSpace([[xScale(new Date('2015-01-02')), yScale(yMax)], [xScale(new Date('2015-12-31')), yScale(yMin)]], xScale, yScale, 'clear');
      };
    }
    if (brushType === 'Rectangular Selection') {
      const brush = d3.brush().extent([[margin.left, margin.top], [margin.left + width, margin.top + height]]).on('brush', (e) => {
        if (e.sourceEvent !== undefined) {
          setBrushedSpace([[e.selection[0][0], e.selection[0][1]], [e.selection[1][0], e.selection[1][1]]], xScale, yScale, e.mode);
        }
      }).on('end', (currData) => {
        if (currData.selection === null && currData.sourceEvent !== undefined) {
          d3.select(ref.current).call(brush.move, null);
          setFilteredTable(null);
        }
      });

      d3.select(ref.current).call(brush);

      return () => {
        d3.select(ref.current).call(brush.move, null);
        setBrushedSpace([[null, null], [null, null]], xScale, yScale, 'clear');
      };
    }
    if (brushType === 'Slider Selection') {
      if (!brushState.hasBrush) {
        setBrushedSpace([[xScale(xMin), yScale(yMax)], [xScale(xMax), yScale(yMin)]], xScale, yScale, null);
      }

      return () => setBrushedSpace([[xScale(xMin), yScale(yMax)], [xScale(xMax), yScale(yMin)]], xScale, yScale, 'clear');
    }
    if (brushType === 'Paintbrush Selection') {
      return () => setBrushedSpace([[xScale(xMin), yScale(yMax)], [xScale(xMax), yScale(yMin)]], xScale, yScale, 'clear', []);
    }

    return () => null;
  }, [brushState.hasBrush, brushType, brushXRef, brushYRef, height, ref, setBrushedSpace, setFilteredTable, width, xMax, xMin, xScale, yMax, yMin, yScale]);

  const brushedSet = useMemo(() => (brushedPoints.length === 0 ? null : new Set(brushedPoints)), [brushedPoints]);

  const circles = useMemo(() => {
    if (!xScale || !yScale) {
      return null;
    }

    return data.map((d, i) => {
      if (d[params.x] === null || d[params.y] === null) {
        return null;
      }

      const xVal = params.dataType === 'date' ? xScale(new Date(d[params.x])) : xScale(d[params.x]);

      return <circle key={i} opacity={brushedSet && !brushedSet.has(d[params.ids]) ? 0.3 : 1} r={3} fill={brushedSet && !brushedSet.has(d[params.ids]) ? 'lightgray' : colorScale(d[params.category])} cx={xVal} cy={yScale(d[params.y])} />;
    });
  }, [brushedSet, colorScale, data, params.category, params.dataType, params.ids, params.x, params.y, xScale, yScale]);

  useEffect(() => {
    if (brushType === 'Axis Selection') {
      d3.selectAll('.handle').style('fill', 'darkgrey');
    }
  }, [brushState, brushType]);

  return (
    <Stack>
      <Group>
        <Button
          ml={60}
          size="compact-sm"
          style={{ width: '130px' }}
          disabled={brushedPoints.length === 0}
          onClick={() => {
            setFilteredTable(null);
            clearCallback?.();
          }}
        >
          Clear Selection
        </Button>
        { params.brushType === 'Paintbrush Selection'
          ? (
            <SegmentedControl
              defaultChecked
              value={isPaintbrushSelect ? 'Select' : 'De-Select'}
              onChange={(val) => setIsPaintbrushSelect(val === 'Select')}
              data={[
                { label: 'Select', value: 'Select' },
                { label: 'De-Select', value: 'De-Select', disabled: brushedPoints.length === 0 },
              ]}
            />
          ) : null}
      </Group>
      <Group style={{ width: '100%', height: '100%' }} wrap="nowrap">

        <svg id="scatterSvgBrushStudy" ref={ref} style={{ height: '500px', width: params.brushType === 'Axis Selection' ? '800px' : '530px', fontFamily: 'BlinkMacSystemFont, -apple-system, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif' }}>

          {xScale && yScale ? (
            <g>
              <YAxis yScale={yScale} label={params.y} horizontalPosition={margin.left} xRange={xScale.range()} />
              <XAxisBar
                xScale={xScale}
                yRange={yScale.range() as [number, number]}
                isDate={params.dataType === 'date'}
                vertPosition={height + margin.top}
                label={params.x}
                ticks={xScale.ticks(params.brushType === 'Axis Selection' ? 12 : 5).map((value) => ({
                  value: value.toString(),
                  offset: xScale(value),
                }))}
              />
            </g>
          ) : null}
          {circles}
          <g id="brushXRef" ref={brushXRef} />
          <g id="brushYRef" ref={brushYRef} />
          {xScale && yScale && brushType === 'Paintbrush Selection' ? <Paintbrush brushState={brushState} setBrushedSpace={setBrushedSpace} params={params} data={data} isSelect={isPaintbrushSelect} xScale={xScale as any} yScale={yScale} /> : null}
        </svg>
        {brushType === 'Slider Selection' && xScale && yScale
          ? (
            <Stack style={{ flexGrow: 1 }} gap={50}>
              <Stack gap={0}>
                <Text>{params.x}</Text>
                <RangeSlider
                  minRange={1}
                  label={null}
                  min={xScale.domain()[0] as any}
                  max={xScale.domain()[1] as any}
                  labelAlwaysOn={false}
                  onChange={(value) => {
                    setBrushedSpace([[xScale(value[0]), brushState.y1], [xScale(value[1]), brushState.y2]], xScale, yScale, 'drag');
                  }}
                  style={{ width: '300px' }}
                  marks={
                                xScale.ticks(5).map((t) => ({
                                  value: t,
                                  label: t,
                                })) as any
                            }
                  value={[xScale.invert(brushState.x1), xScale.invert(brushState.x2)] as any}
                />
              </Stack>
              <Stack gap={0}>
                <Text>{params.y}</Text>
                <RangeSlider
                  minRange={1}
                  label={null}
                  min={yScale.domain()[0]}
                  max={yScale.domain()[1]}
                  onChange={(value) => {
                    setBrushedSpace([[brushState.x1, yScale(value[1])], [brushState.x2, yScale(value[0])]], xScale, yScale, 'drag');
                  }}
                  style={{ width: '300px' }}
                  marks={
                                yScale.ticks(5).map((t) => ({
                                  value: t,
                                  label: t,
                                }))
}
                  value={[yScale.invert(brushState.y2), yScale.invert(brushState.y1)]}
                />
              </Stack>
            </Stack>
          ) : null}
      </Group>
    </Stack>
  );
}

export default Scatter;
