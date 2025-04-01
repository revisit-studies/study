import { useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { useMatrixContext } from './MatrixContext';

export function Highlighting() {
  const {
    margin,
    size,
    cellSize,
    originHighlight,
    originScale,
    destinationHighlight,
    destinationScale,

    actions,
    trrack,
  } = useMatrixContext();

  const { topMargin, leftMargin } = useMemo(
    () => ({ topMargin: margin.top, leftMargin: margin.left }),
    [margin],
  );

  const { width, height } = useMemo(() => ({ width: size, height: size }), [size]);

  useEffect(() => {
    trrack?.apply('Highlight', actions.setOriginHighlight(originHighlight));
  }, [originHighlight]);

  useEffect(() => {
    d3.selectAll('.highlightLine').raise(); // Asegura que las líneas estén al frente
  }, [originHighlight, destinationHighlight]);

  return (
    <>
      {originHighlight && (
        <rect
          width={cellSize}
          height={height + topMargin}
          x={originScale(originHighlight)}
          y={-topMargin}
          fill="blue"
          fillOpacity={0.5}
        />
      )}

      {destinationHighlight && (
        <rect
          width={width + leftMargin}
          height={cellSize}
          x={-leftMargin}
          y={destinationScale(destinationHighlight)}
          fill="blue"
          fillOpacity={0.5}
        />
      )}

      {originHighlight && (
        <>
          <line
            className="highlightLine"
            x1={originScale(originHighlight)!}
            y1={-topMargin}
            x2={originScale(originHighlight)! + cellSize}
            y2={-topMargin}
            stroke="black"
            strokeWidth={4}
          />
          <line
            className="highlightLine"
            x1={originScale(originHighlight)!}
            y1={height}
            x2={originScale(originHighlight)! + cellSize}
            y2={height}
            stroke="black"
            strokeWidth={2}
          />
          <line
            className="highlightLine"
            x1={originScale(originHighlight)!}
            y1={-topMargin}
            x2={originScale(originHighlight)!}
            y2={height}
            stroke="black"
            strokeWidth={2}
          />
          <line
            className="highlightLine"
            x1={originScale(originHighlight)! + cellSize}
            y1={-topMargin}
            x2={originScale(originHighlight)! + cellSize}
            y2={height}
            stroke="black"
            strokeWidth={2}
          />
        </>
      )}

      {destinationHighlight && (
        <>
          <line
            className="highlightLine"
            x1={-leftMargin}
            y1={destinationScale(destinationHighlight)!}
            x2={width}
            y2={destinationScale(destinationHighlight)!}
            stroke="black"
            strokeWidth={2}
          />
          <line
            className="highlightLine"
            x1={-leftMargin}
            y1={destinationScale(destinationHighlight)! + cellSize}
            x2={width}
            y2={destinationScale(destinationHighlight)! + cellSize}
            stroke="black"
            strokeWidth={2}
          />
          <line
            className="highlightLine"
            x1={-leftMargin}
            y1={destinationScale(destinationHighlight)!}
            x2={-leftMargin}
            y2={destinationScale(destinationHighlight)! + cellSize}
            stroke="black"
            strokeWidth={4}
          />
          <line
            className="highlightLine"
            x1={width}
            y1={destinationScale(destinationHighlight)!}
            x2={width}
            y2={destinationScale(destinationHighlight)! + cellSize}
            stroke="black"
            strokeWidth={2}
          />
        </>
      )}
    </>
  );
}
