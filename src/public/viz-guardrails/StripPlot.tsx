/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { from, escape } from 'arquero';
import { useMemo } from 'react';
import * as d3 from 'd3';
import { ChartParams } from './DataExplorer';

const margin = {
  top: 30,
  left: 60,
  right: 80,
  bottom: 50,
};

export function StripPlot({
  data,
  selection,
  parameters,
  dataname,
} : {
    data: unknown[];
    selection: string[];
    parameters: ChartParams;
    dataname: string;
}) {
  const width = 60;
  const height = 400;

  const allData = useMemo(() => {
    const tempData = data.map((d: any) => ({ ...d, value: +d[parameters.y_var] }));
    return from(tempData);
  }, [data, parameters]);

  const selectedDataRange = useMemo(() => {
    const extent = d3.extent(allData.filter(escape((d: any) => selection.includes(d[parameters.cat_var]))).array('value')) as [unknown, unknown] as [number, number];
    return (dataname === 'clean_stocks') ? extent : [0, extent[1]];
  }, [allData, selection, parameters, dataname]);

  const yScale = useMemo(() => d3.scaleLinear([margin.top, height - margin.bottom]).domain(d3.extent(allData.array('value') as number[]).reverse() as unknown as [number, number]), [allData, height]);

  const textFormat = dataname === 'clean_stocks' ? d3.format('.0%') : d3.format(',.0f');

  return selection?.length === 0 ? null : (
    <svg style={{ height: '400px', width: '60px', overflow: 'visible' }}>
      {/* <YAxis yScale={yScale} horizontalPosition={275} xRange={[0, 0]}/> */}
      {/* <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} strokeWidth={1} stroke={'black'}></line> */}
      <rect y={yScale(selectedDataRange[1])} height={yScale(selectedDataRange[0]) - yScale(selectedDataRange[1])} x={margin.left - 10} width={10} opacity={0.1} fill="black" />
      <text
        style={{
          fontSize: 10, dominantBaseline: 'middle', textAnchor: 'middle', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
        x={25}
        y={margin.top - 5}
      >
        {textFormat(yScale.domain()[0])}
      </text>
      <text
        style={{
          fontSize: 10, dominantBaseline: 'middle', textAnchor: 'middle', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
        x={25}
        y={height - margin.bottom + 8}
      >
        {textFormat(yScale.domain()[1])}
      </text>
      <text style={{ fontSize: 10, dominantBaseline: 'middle', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} x={margin.left - 5} y={yScale(selectedDataRange[0])}>{textFormat(selectedDataRange[0])}</text>
      <text style={{ fontSize: 10, dominantBaseline: 'middle', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} x={margin.left - 5} y={yScale(selectedDataRange[1])}>{textFormat(selectedDataRange[1])}</text>

      {data.map((d: any) => <rect key="strip" opacity={0.2} fill={+d[parameters.y_var] > 0 ? 'steelblue' : 'firebrick'} x={0} width={50} y={yScale(+d[parameters.y_var])} height={1} />)}
      <line strokeWidth={2} stroke="black" style={{ fontSize: 10, dominantBaseline: 'middle' }} x1={0} x2={50} y1={yScale(selectedDataRange[0])} y2={yScale(selectedDataRange[0])} />
      <line strokeWidth={2} stroke="black" x1={0} x2={50} y1={yScale(selectedDataRange[1])} y2={yScale(selectedDataRange[1])} />
      <line strokeWidth={2} stroke="black" x1={0} x2={0} y1={yScale(selectedDataRange[1])} y2={yScale(selectedDataRange[0])} />
      <line strokeWidth={2} stroke="black" x1={50} x2={50} y1={yScale(selectedDataRange[1])} y2={yScale(selectedDataRange[0])} />

      <path fill="black" opacity="0.1" d={`M${margin.left}, ${yScale(selectedDataRange[1])} L ${width + 20 + 33}, ${margin.top} L ${width + 20 + 33}, ${height - margin.bottom} L ${margin.left}, ${yScale(selectedDataRange[0])}`} />
    </svg>
  );
}
