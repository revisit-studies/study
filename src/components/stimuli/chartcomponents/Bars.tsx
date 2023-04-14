import { ScaleBand, ScaleLinear } from "d3";
import { useDispatch } from "react-redux";
import { saveInteraction } from "../../../store";

export const Bars = ({
  stimulusID,
  data,
  xScale,
  yScale,
  height,
}: {
  stimulusID: string,
  data: any;
  yScale: ScaleLinear<number, number>;
  xScale: ScaleBand<string>;
  height: number;
}) => {
  const dispatch = useDispatch();
  
  const handleMouseEnter = (d:any) => {
    dispatch(saveInteraction({ id: stimulusID, action: "mouseEnter", objectID: d.name }));
  }

  const handleMouseLeave = (d:any) => {
    dispatch(saveInteraction({ id: stimulusID, action: "mouseLeave", objectID: d.name }));
  }

  return (
    <g>
      {data.map((d: any, i: number) => (
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
