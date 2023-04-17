import { ScaleBand, ScaleLinear } from 'd3';
import { useHoverInteraction } from '../hooks/useHoverInteraction';

export const Bars = ({
  stimulusID,
  data,
  xScale,
  yScale,
  height,
}: {
  stimulusID: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  yScale: ScaleLinear<number, number>;
  xScale: ScaleBand<string>;
  height: number;
}) => {
  const { handleMouseEnter, handleMouseLeave } =
    useHoverInteraction(stimulusID);

  return (
    <g>
      {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.map((d: any, i: number) => (
        <rect
          key={i}
          x={xScale(d.name)}
          y={yScale(d.value)}
          width={xScale.bandwidth()}
          height={height - yScale(d.value)}
          fill="transparent"
          onMouseEnter={() => handleMouseEnter(d)}
          onMouseLeave={() => handleMouseLeave(d)}
          stroke="currentColor"
        />
      ))}
    </g>
  );
};
