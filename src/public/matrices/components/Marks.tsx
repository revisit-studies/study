import { HIGHLIGHT_STROKE_WIDTH } from '../utils/Constants';
import { ClusterMark } from '../utils/Interfaces';
import { useMatrixContext } from '../utils/MatrixContext';

const markStrokeWidth = HIGHLIGHT_STROKE_WIDTH + 1;

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
        x={originScale(d.origin)! - markStrokeWidth / 2}
        y={destinationScale(d.destination)! - markStrokeWidth / 2}
        width={size * cellSize + markStrokeWidth}
        height={size * cellSize + markStrokeWidth}
        strokeWidth={markStrokeWidth}
      />
    </>
  ));
}

export function LinkMarks({ marks }: { marks: string[][] | null }) {
  const { originScale, destinationScale, cellSize } = useMatrixContext();

  return marks?.map((d, i) => (
    <rect
      className="mark"
      key={i}
      x={originScale(d[0])! - markStrokeWidth / 2}
      y={destinationScale(d[1])! - markStrokeWidth / 2}
      width={cellSize + markStrokeWidth}
      height={cellSize + markStrokeWidth}
      strokeWidth={markStrokeWidth}
    />
  ));
}
