export const Bubbles = ({ data }: { data: any[] }) => {
  return (
    <g>
      {data.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={"none"}
          stroke="currentColor"
        />
      ))}
    </g>
  );
};
