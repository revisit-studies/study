import * as d3 from "d3";
import { useMemo } from "react";

export const OrdinalAxisHWithDotMarks = ({
  domain = ["A", "B", "C", "D", "E"],
  range = [10, 100],
  withTick = true,
  tickLen = 5,
  tickFilter = (t:any[]) => t,
}) => {
  const ticks = useMemo(() => {
    const xScale = d3.scaleBand().domain(domain).range(range).padding(0.2);
    return tickFilter(
      domain.map((value) => ({
        value,
        xOffset: (xScale(value) || 0) + xScale.bandwidth() / 2 - 5,
      })),
    );
  }, [domain.join("-"), range.join("-")]);
  return (
    <g>
      <path
        d={["M", range[0], tickLen, "v", -tickLen, "H", range[1], "v", tickLen].join(" ")}
        fill="none"
        stroke="currentColor"
      />
      {withTick &&
        ticks.map(({ value, xOffset }: any) => (
          <g key={value} transform={`translate(${xOffset}, 10)`}>
            <circle key={value} r={2} cx={0} cy={0}>
              {value}
            </circle>
          </g>
        ))}
    </g>
  );
};
