export function Slices({
  arcs,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arcs: any[];
}) {
  return (
    <g>
      {arcs.map((arc, i) => (
        <path
          key={i}
          d={arc()}
          fill="transparent"
          stroke="currentColor"
        />
      ))}
    </g>
  );
}
