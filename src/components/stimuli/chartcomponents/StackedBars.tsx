import { useDispatch } from "react-redux";
import { saveInteraction } from "../../../store";

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
  const dispatch = useDispatch();

  const handleMouseEnter = (d: any) => {
    dispatch(
      saveInteraction({
        id: stimulusID,
        action: "mouseEnter",
        objectID: d.key,
      })
    );
  };

  const handleMouseLeave = (d: any) => {
    dispatch(
      saveInteraction({
        id: stimulusID,
        action: "mouseLeave",
        objectID: d.key,
      })
    );
  };

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
