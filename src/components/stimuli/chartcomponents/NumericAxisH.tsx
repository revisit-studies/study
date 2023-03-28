import * as d3 from "d3";
import { useMemo } from "react";

export const NumericAxisH = ({
  domain = [0, 100],
  range = [10, 100],
  withTick = true,
  tickLen = 5,
  tickFilter = (t: any) => t,
}: {
  domain: any[];
  range: any[];
  withTick: boolean;
  tickLen: number;
  tickFilter: (t: any) => any;
}) => {
  const ticks = useMemo(() => {
    const xScale = d3.scaleLinear().domain(domain).range(range);
    const width = range[1] - range[0];
    const pixelsPerTick = 30;
    const numberOfTicksTarget = Math.max(1, Math.floor(width / pixelsPerTick));
    return tickFilter(
      xScale.ticks(numberOfTicksTarget).map((value) => ({
        value,
        xOffset: xScale(value),
      }))
    );
  }, [domain.join("-"), range.join("-")]);
  return (
    <g>
      <path
        d={[
          "M",
          range[0],
          tickLen,
          "v",
          -tickLen,
          "H",
          range[1],
          "v",
          tickLen,
        ].join(" ")}
        fill="none"
        stroke="currentColor"
      />

      {withTick &&
        ticks.map(({ value, xOffset }: { value: string; xOffset: number }) => (
          <g key={value} transform={`translate(${xOffset}, 0)`}>
            <line y2={`${tickLen}`} stroke="currentColor" />
            <text
              key={value}
              style={{
                fontSize: "10px",
                textAnchor: "middle",
                transform: "translateY(20px)",
              }}
            >
              {value}
            </text>
          </g>
        ))}
    </g>
  );
};
