import * as d3 from "d3";
import { useMemo } from "react";

export const NumericAxisV = ({
  domain = [0, 100],
  range = [10, 100],
  withTick = true,
  tickLen = 5,
  tickFilter = (t:any) => t,
}) => {
  const ticks = useMemo(() => {
    const yScale = d3.scaleLinear().domain(domain).range(range);
    const height = range[1] - range[0];
    const pixelsPerTick = 30;
    const numberOfTicksTarget = Math.max(1, Math.floor(height / pixelsPerTick));
    return tickFilter(
      yScale.ticks(numberOfTicksTarget).map((value) => ({
        value,
        xOffset: yScale(value),
      })),
    );
  }, [domain.join("-"), range.join("-")]);
  return (
    <g>
      <path
        d={["M", 0, range[0], "h", tickLen, "V", range[1], "h", -tickLen].join(" ")}
        fill="none"
        stroke="currentColor"
      />

      {withTick &&
        ticks.map(({ value, xOffset }: {value: any, xOffset: any}) => (
          <g key={value} transform={`translate(0,${xOffset})`}>
            <line x2={`${tickLen}`} stroke="currentColor" />
            <text
              key={value}
              style={{
                fontSize: "10px",
                textAnchor: "middle",
                transform: "translateX(-10px)",
              }}
            >
              {value}
            </text>
          </g>
        ))}
    </g>
  );
};
