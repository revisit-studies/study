import { ClusterMark } from '../utils/Interfaces';
import { useMatrixContext } from '../utils/MatrixContext';

const margin = 2;

export function ClusterMarks({ marks, size }: { marks: ClusterMark[] | null; size: number }) {
  const { originScale, destinationScale, cellSize } = useMatrixContext();

  return marks?.map((d, i) => (
    <>
      <rect
        key={i}
        x={originScale(d.origin)!}
        y={destinationScale(d.destination)! - 35}
        width={25}
        height={30}
        fill="white"
      />
      <text
        className="cluster-label"
        color="#ff6e4a"
        x={originScale(d.origin)!}
        y={destinationScale(d.destination)! - 10}
      >
        {d.option}
      </text>
      <rect
        className="mark"
        key={i}
        x={originScale(d.origin)! - margin}
        y={destinationScale(d.destination)! - margin}
        width={size * cellSize + margin * 2}
        height={size * cellSize + margin * 2}
      />
    </>
  ));
}

export function LinkMarks({ marks, size }: { marks: string[][] | null; size: number }) {
  const { originScale, destinationScale, cellSize } = useMatrixContext();

  return marks?.map((d, i) => (
    <rect
      className="mark"
      key={i}
      x={originScale(d[0])! - margin}
      y={destinationScale(d[1])! - margin}
      width={size * cellSize + margin * 2}
      height={size * cellSize + margin * 2}
    />
  ));
}
