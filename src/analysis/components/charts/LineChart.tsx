import React, { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { LineChartData, LineChartProps } from '../../types';
import useChartDimensions from '../hooks/useChartDimension';
import { TimeAxisX } from '../chartcomponents/TimeAxisX';
import { AxisY } from '../chartcomponents/AxisY';

const chartSettings = {
  marginLeft: 10,
  marginRight: 10,
  marginTop: 10,
  marginBottom: 0,
};

function LineChart(props: LineChartProps) {
  const [ref, dms] = useChartDimensions(chartSettings);
  const pathRef = useRef<SVGPathElement>(null);

  const { data } = props;
  const xScale = useMemo(() => (
    d3.scaleTime()
      .domain([new Date(data[0].time), new Date(data[data.length - 1].time)])
      .range([0, dms.boundedWidth])
  ), [dms.boundedWidth, data]);

  const yScale = useMemo(() => (
    d3.scaleLinear()
      .domain([0, data[data.length - 1].value])
      .range([dms.boundedHeight, dms.marginTop || 0])
  ), [dms.boundedHeight, data]);

  const lineGenerator = d3.line<LineChartData>()
    .x((d) => xScale(d.time))
    .y((d) => yScale(d.value));
  // .curve(d3.curveBasis);

  const interpolation = (dataset : LineChartData[]) => {
    if (dataset.length < 2) return dataset;

    const interpolatedData = [];
    interpolatedData.push(dataset[0]);
    for (let i = 1; i < dataset.length; i += 1) {
      interpolatedData.push({ time: dataset[i].time, value: dataset[i - 1].value });
      interpolatedData.push({ ...dataset[i] });
    }
    return interpolatedData;
  };

  const lines = lineGenerator(interpolation(data)) || '';

  const animated = () => {
    if (pathRef.current) {
      const path = d3.select(pathRef.current);
      const length = path.node()?.getTotalLength() || 0;

      path.attr('stroke-dasharray', `${length} ${length}`)
        .attr('stroke-dashoffset', length)
        .transition()
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0)
        .duration(500);
    }
  };

  useEffect(() => {
    animated();
  }, [pathRef.current, data]);

  return (
    <div>
      <h4>Completion CDF</h4>
      <div
        className="Chart_wrapper"
        ref={ref}
        style={{ height: '200px' }}
      >
        <svg width={dms.width} height={dms.height}>
          <g transform={`translate(${[
            dms.marginLeft,
            dms.marginTop,
          ].join(',')})`}
          >
            {/* <rect */}
            {/*    width={dms.boundedWidth} */}
            {/*    height={dms.boundedHeight} */}
            {/*    fill="lavender" */}
            {/* /> */}
            <g transform={`translate(${[
              dms.marginLeft,
              0,
            ].join(',')})`}
            >
              <path
                ref={pathRef}
                d={lines}
                fill="none"
                stroke="steelblue"
                strokeWidth={2}
              />

            </g>

            <g transform={`translate(${[
              dms.marginLeft,
              dms.boundedHeight,
            ].join(',')})`}
            >
              <TimeAxisX
                domain={xScale.domain()}
                range={xScale.range()}
              />
            </g>

            <g transform={`translate(${[
              -10,
              0,
            ].join(',')})`}
            >
              <AxisY
                domain={yScale.domain()}
                range={yScale.range()}
              />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

export default LineChart;
