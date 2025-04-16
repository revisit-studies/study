import { useEffect, useMemo } from 'react';
import { useMatrixContext } from '../utils/MatrixContext';
import { HIGHLIGHT_STROKE_WIDTH } from '../utils/Constants';

export function Highlighting() {
  const {
    margin,
    size,
    cellSize,

    originScale,
    destinationScale,

    originHighlight,
    destinationHighlight,

    actions,
    trrack,
  } = useMatrixContext();

  const { topMargin, leftMargin } = useMemo(
    () => ({ topMargin: margin.top, leftMargin: margin.left }),
    [margin],
  );

  const { width, height } = useMemo(() => ({ width: size, height: size }), [size]);

  useEffect(() => {
    trrack?.apply('Highlight', actions?.setOriginHighlight(originHighlight));
  }, [originHighlight, trrack, actions]);

  useEffect(() => {
    trrack?.apply('Highlight', actions?.setDestinationHighlight(destinationHighlight));
  }, [destinationHighlight, trrack, actions]);

  return (
    <>
      <rect
        id="originHighlight"
        className="highlight"
        width={cellSize}
        height={height + topMargin}
        y={-topMargin + HIGHLIGHT_STROKE_WIDTH}
        x={originHighlight ? originScale(originHighlight) : 0}
        visibility={originHighlight ? 'visible' : 'hidden'}
        style={{ strokeWidth: HIGHLIGHT_STROKE_WIDTH }}
      />

      <rect
        id="destinationHighlight"
        className="highlight"
        width={width + leftMargin}
        height={cellSize}
        x={-leftMargin + +HIGHLIGHT_STROKE_WIDTH}
        y={destinationHighlight ? destinationScale(destinationHighlight) : 0}
        visibility={destinationHighlight ? 'visible' : 'hidden'}
        style={{ strokeWidth: HIGHLIGHT_STROKE_WIDTH }}
      />

      {/*  {originHighlight && (
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
      )} */}

      {/* {destinationHighlight && (
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
      )} */}
    </>
  );
}
