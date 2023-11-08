export const Slices = ({
  trialId,
  arcs,
  data,
}: {
  trialId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arcs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
}) => {
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
