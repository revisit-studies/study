export const Bubbles = ({
  data,
  trialId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  trialId: string;
}) => {
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
