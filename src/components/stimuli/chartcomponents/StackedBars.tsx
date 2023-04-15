import { useHoverInteraction } from "../hooks/useHoverInteraction";

export const StackedBars = ({
  data,
  barWidth,
  yScale,
  stimulusID,
}: {
  data: any[];
  barWidth: number;
  yScale: any;
  stimulusID: string;
}) => {
  const { handleMouseEnter, handleMouseLeave } =
    useHoverInteraction(stimulusID);

  return (
    <g>
      {data.map((d, i) => (
        <rect
          key={i}
          x={barWidth / 2}
          y={yScale(d[0][1])}
          width={barWidth}
          height={yScale(d[0][0]) - yScale(d[0][1])}
          fill="transparent"
          stroke="currentColor"
          onMouseEnter={() => handleMouseEnter(data)}
          onMouseLeave={() => handleMouseLeave(data)}
        />
      ))}
    </g>
  );
};
