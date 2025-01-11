export function DotMarks({
  positions,
}: {
  positions: { x: number; y: number }[];
}) {
  return (
    <g>
      {positions.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={2}
          fill="black"
          stroke="currentColor"
        />
      ))}
    </g>
  );
}
