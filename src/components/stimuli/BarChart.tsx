import { useChartDimensions } from './hooks/useChartDimensions';
import * as d3 from 'd3';
import { Bars } from './chartcomponents/Bars';
import { NumericAxisV } from './chartcomponents/NumericAxisV';
import { OrdinalAxisHWithDotMarks } from './chartcomponents/OrdinalAxisHWithDotMarks';

const chartSettings = {
  marginBottom: 40,
  marginLeft: 40,
  marginTop: 15,
  marginRight: 15,
  width: 400,
  height: 400,
};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const BarChart = ({ parameters, stimulusID }: { parameters: any, stimulusID: string }) => {
  const tickLength = 6;
  const [ref, dms] = useChartDimensions(chartSettings);

  const xScale = d3
    .scaleBand()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .domain(parameters.data.map((d: { name: any }) => d.name))
    .range([0, dms.boundedWidth])
    .padding(0.2);

  const yScale = d3
    .scaleLinear()
    .domain([100, 0])
    .range([0, dms.boundedHeight]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yAxisTickFilter = (ticks: any[]) => {
    return ticks.filter((t, i) => i === 0 || i === ticks.length - 1);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xAxisTickFilter = (ticks: any[]) => {
    return ticks.filter((t, i) => parameters.selectedIndices.includes(i));
  };

  return (
    <div className="Chart__wrapper" ref={ref} style={{ height: 400 }}>
      <svg width={dms.width} height={dms.height}>
        <g
          transform={`translate(${[dms.marginLeft, dms.marginTop].join(',')})`}
        >
          <g
            transform={`translate(${[tickLength, dms.boundedHeight].join(
              ','
            )})`}
          >
            <OrdinalAxisHWithDotMarks
              domain={xScale.domain()}
              range={xScale.range()}
              withTick={true}
              tickLen={0}
              tickFilter={xAxisTickFilter}
            />
          </g>
          <g transform={`translate(${[0, 0].join(',')})`}>
            <NumericAxisV
              domain={yScale.domain()}
              range={yScale.range()}
              withTick={true}
              tickLen={tickLength}
              tickFilter={yAxisTickFilter}
            />
          </g>
          <g transform={`translate(${[0, 0].join(',')})`}>
            <Bars
              data={parameters.data}
              stimulusID={stimulusID}
              xScale={xScale}
              yScale={yScale}
              height={dms.boundedHeight}
            />
          </g>
        </g>
      </svg>
    </div>
  );
};

export default BarChart;
