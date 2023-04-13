export const Slices = ({ arcs }: { arcs: any[] }) => {
  return (
    <g>
      {arcs.map((arc, i) => (
        <path key={i} d={arc()} fill="none" stroke="currentColor" />
      ))}
    </g>
  );
};
