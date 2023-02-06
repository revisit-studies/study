import { ScaleBand, ScaleLinear } from "d3";

export const Bars = ({
  data,
  xScale,
  yScale,
  height,
}: {
  data: any;
  yScale: ScaleLinear<number, number>;
  xScale: ScaleBand<string>;
  height: number;
}) => {
  return (
    <g>
      {data.map((d: any, i: number) => (
        <rect
          key={i}
          x={xScale(d.name)}
          y={yScale(d.value)}
          width={xScale.bandwidth()}
          height={height - yScale(d.value)}
          fill={"none"}
          stroke="currentColor"
        />
      ))}
    </g>
  );
};
