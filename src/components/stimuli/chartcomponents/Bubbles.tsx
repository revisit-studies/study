import { useDispatch } from "react-redux";
import { saveInteraction } from "../../../store";

export const Bubbles = ({
  data,
  stimulusID,
}: {
  data: any[];
  stimulusID: string;
}) => {
  const dispatch = useDispatch();

  const handleMouseEnter = (d: any) => {
    dispatch(
      saveInteraction({
        id: stimulusID,
        action: "mouseEnter",
        objectID: d.name,
      })
    );
  };

  const handleMouseLeave = (d: any) => {
    dispatch(
      saveInteraction({
        id: stimulusID,
        action: "mouseLeave",
        objectID: d.name,
      })
    );
  };

  return (
    <g>
      {data.map(({ bubble: d, data }, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill="transparent"
          stroke="currentColor"
          onMouseEnter={() => handleMouseEnter(data)}
          onMouseLeave={() => handleMouseLeave(data)}
        />
      ))}
    </g>
  );
};
