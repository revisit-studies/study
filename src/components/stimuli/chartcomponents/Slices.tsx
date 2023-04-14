import { useHoverInteraction } from "../hooks/useHoverInteraction";

export const Slices = ({
  stimulusID,
  arcs,
  data,
}: {
  stimulusID: string;
  arcs: any[];
  data: any[];
}) => {
  const { handleMouseEnter, handleMouseLeave } =
    useHoverInteraction(stimulusID);

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
