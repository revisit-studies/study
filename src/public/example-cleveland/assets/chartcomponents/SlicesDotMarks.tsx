// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SlicesDotMarks({ positions }: { positions: any[] }) {
  return (
    <g>
      {positions.map((arc, i) => (
        <g key={i} transform={`translate(${arc.centroid()})`}>
          <circle key={i} r={2} cx={0} cy={0} />
        </g>
      ))}
    </g>
  );
}
