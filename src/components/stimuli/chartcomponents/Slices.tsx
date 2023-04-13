import { useDispatch } from "react-redux";
import { saveInteraction } from "../../../store";

export const Slices = ({
  stimulusID,
  arcs,
}: {
  stimulusID: string;
  arcs: any[];
}) => {
  const dispatch = useDispatch();

  const handleMouseEnter = (d: any) => {
    dispatch(
      saveInteraction({
        id: stimulusID,
        action: "mouseEnter",
        objectID: d,
      })
    );
  };

  const handleMouseLeave = (d: any) => {
    dispatch(
      saveInteraction({
        id: stimulusID,
        action: "mouseLeave",
        objectID: d,
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
          onMouseEnter={() => handleMouseEnter(i)}
          onMouseLeave={() => handleMouseLeave(i)}
        />
      ))}
    </g>
  );
};
