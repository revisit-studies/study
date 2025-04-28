export function Bubbles({
  data,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
}) {
  return (
    <g>
      {data.map(({ bubble: d }, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill="transparent"
          stroke="currentColor"
        />
      ))}
    </g>
  );
}
