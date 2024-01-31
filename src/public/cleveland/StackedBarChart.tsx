import * as d3 from 'd3';
import { DotMarks } from './chartcomponents/DotMarks';
import { NumericAxisH } from './chartcomponents/NumericAxisH';
import { NumericAxisV } from './chartcomponents/NumericAxisV';
import { StackedBars } from './chartcomponents/StackedBars';
import { useChartDimensions } from './hooks/useChartDimensions';

const chartSettings = {
  marginBottom: 40,
  marginLeft: 40,
  marginTop: 15,
  marginRight: 15,
  height: 400,
  width: 400,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StackedBarChart({ parameters }: { parameters: any }) {
  const tickLength = 6;
  const [ref, dms] = useChartDimensions(chartSettings);

  const xScale = d3
    .scaleBand()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .domain(parameters.data.map((d: { name: any }) => d.name))
    .range([0, dms.boundedWidth])
    .padding(0.2);
  const yScale = d3.scaleLinear().domain([100, 0]).range([0, dms.boundedWidth]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yAxisTickFilter = (ticks: any[]) => ticks.filter((t, i) => i === 0 || i === ticks.length - 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xAxisTickFilter = (ticks: any[]) => ticks.filter((t, i) => parameters.selectedIndices.includes(i));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createSeries = (seriesData: any[]) => {
    const dataArr = seriesData.map((d) => +d.value);
    const sumOfData = dataArr.reduce((curSum, val) => Number(curSum) + Number(val));
    const dividend = sumOfData / 100;
    const obj1: { [key: string]: number } = {};
    dataArr.forEach((d, i) => {
      obj1[String.fromCharCode(i + 65)] = d / dividend;
    });
    const dataset = [obj1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return d3.stack().keys(parameters.data.map((d: { name: any }) => d.name))(
      dataset,
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMarkPositions = (data: any[], selected: any[], X: number) => {
    const markData = data.filter((d, i) => selected.includes(i));
    return markData.map((d) => ({
      x: X,
      y: yScale(d[0][1]) + 0.5 * (yScale(d[0][0]) - yScale(d[0][1])),
    }));
  };

  const series = createSeries(parameters.data);
  const barWidth = Math.min(dms.width, dms.height) / 2 - 20;
  const markPositions = createMarkPositions(
    series,
    parameters.selectedIndices,
    barWidth,
  );

  return (
    <div className="Chart__wrapper" ref={ref} style={{ height: '400' }}>
      <svg width={dms.width} height={dms.height}>
        <g
          transform={`translate(${[dms.marginLeft, dms.marginTop].join(',')})`}
        >
          <g
            transform={`translate(${[tickLength, dms.boundedHeight].join(
              ',',
            )})`}
          >
            <NumericAxisH
              domain={xScale.domain()}
              range={xScale.range()}
              withTick
              tickLen={0}
              tickFilter={xAxisTickFilter}
            />
          </g>
          <g transform="translate(0, 0)">
            <NumericAxisV
              domain={yScale.domain()}
              range={yScale.range()}
              withTick
              tickLen={tickLength}
              tickFilter={yAxisTickFilter}
            />
          </g>
          <g transform="translate(0, 0)">
            <StackedBars data={series} barWidth={barWidth} yScale={yScale} />
            <DotMarks positions={markPositions} />
          </g>
        </g>
      </svg>
    </div>
  );
}

export default StackedBarChart;
