export const StackedBars = ({
  data,
  barWidth,
  yScale,
}: {
  data: any[];
  barWidth: number;
  yScale: any;
}) => {
  return (
    <g>
      {data.map((d, i) => (
        <rect
          key={i}
          x={barWidth / 2}
          y={yScale(d[0][1])}
          width={barWidth}
          height={yScale(d[0][0]) - yScale(d[0][1])}
          fill={"none"}
          stroke="currentColor"
        />
      ))}
    </g>
  );
};
