import * as d3 from 'd3';
import { useMemo } from 'react';
import data from './data.json';
import { useChartDimensions } from './hooks/useChartDimensions';
import { NumericAxisV } from './chartcomponents/NumericAxisV';

type Props = {
  height?: number;
  width?: number;
  parameters?: { permuted?: boolean };
};

const chartSettings = {
  marginBottom: 40,
  marginLeft: 40,
  marginTop: 15,
  marginRight: 15,
  width: 1000,
  height: 400,
};

/** Fisher-Yates shuffle using Math.random(). */
function permute(arr: number[]) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const yAxisTickFilter = (ticks: { value: number; xOffset: number }[]) => ticks.filter((_t, i) => i === 0 || i === ticks.length - 1);

export default function LineChart({
  width = 1000,
  height = 400,
  parameters,
}: Props) {
  const permuted = parameters?.permuted ?? false;
  const { series, months } = data;
  const { daysPerMonth } = data.meta;

  const values = useMemo(() => {
    if (!permuted) return series.map((d) => d.value);

    const byMonth: number[][] = Array.from({ length: months.length }, () => []);
    series.forEach((d) => byMonth[d.month].push(d.value));
    return byMonth.flatMap((m) => permute(m));
  }, [permuted, series, months]);

  const min = Math.min(...values);
  const max = Math.max(...values);

  const [ref, dms] = useChartDimensions({ ...chartSettings, width, height });

  const tickLength = 6;

  const xScale = d3.scaleLinear().domain([0, values.length - 1]).range([0, dms.boundedWidth]);
  const yScale = d3.scaleLinear().domain([max, min]).range([0, dms.boundedHeight]);

  const linePath = useMemo(() => {
    const gen = d3.line<number>().x((_d, i) => xScale(i)).y((d) => yScale(d));
    return gen(values) || '';
  }, [values, xScale, yScale]);

  const monthDividers = months.slice(1).map((m) => xScale(m.startDay));

  return (
    <div className="Chart__wrapper" ref={ref} style={{ height, width: '100%' }}>
      <svg viewBox={`0 0 ${dms.width} ${dms.height}`} width="100%" height={dms.height} preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${dms.marginLeft},${dms.marginTop})`}>
          {/* Y-axis */}
          <g transform={`translate(${-tickLength}, 0)`}>
            <NumericAxisV
              domain={yScale.domain()}
              range={yScale.range()}
              withTick
              tickLen={tickLength}
              tickFilter={yAxisTickFilter}
            />
          </g>

          {/* X-axis baseline */}
          <line x1={0} y1={dms.boundedHeight} x2={dms.boundedWidth} y2={dms.boundedHeight} stroke="currentColor" />

          {/* Right border */}
          <line x1={dms.boundedWidth} y1={0} x2={dms.boundedWidth} y2={dms.boundedHeight} stroke="currentColor" />

          {/* Month dividers */}
          {monthDividers.map((x, i) => (
            <line key={i} x1={x} y1={0} x2={x} y2={dms.boundedHeight} stroke="black" strokeWidth={1} />
          ))}

          {/* Data line */}
          <path d={linePath} fill="none" stroke="steelblue" strokeWidth={1.5} />

          {/* Month labels */}
          <g transform={`translate(0,${dms.boundedHeight})`}>
            {months.map((m) => (
              <text
                key={m.monthIndex}
                x={xScale(m.startDay + daysPerMonth / 2)}
                y={20}
                textAnchor="middle"
                style={{ fontSize: '12px' }}
              >
                {m.name}
              </text>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
