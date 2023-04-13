import { useDispatch } from "react-redux";
import { saveInteraction } from "../../../store";

export const Slices = ({
  stimulusID,
  arcs,
  data,
}: {
  stimulusID: string;
  arcs: any[];
  data: any[];
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
      {arcs.map((arc, i) => (
        <path
          key={i}
          d={arc()}
          fill="transparent"
          stroke="currentColor"
          onMouseEnter={() => handleMouseEnter(data[i])}
          onMouseLeave={() => handleMouseLeave(data[i])}
        />
      ))}
    </g>
  );
};
