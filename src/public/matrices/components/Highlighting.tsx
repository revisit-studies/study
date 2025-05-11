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

    orderingNode,

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
      {originHighlight && (
        <rect
          id="originHighlight"
          className="highlight"
          width={cellSize + HIGHLIGHT_STROKE_WIDTH}
          height={height + topMargin}
          y={-topMargin + HIGHLIGHT_STROKE_WIDTH / 2}
          x={originScale(originHighlight)! - HIGHLIGHT_STROKE_WIDTH / 2}
          visibility={originHighlight ? 'visible' : 'hidden'}
          style={{ strokeWidth: HIGHLIGHT_STROKE_WIDTH }}
        />
      )}

      {destinationHighlight && (
        <rect
          id="destinationHighlight"
          className="highlight"
          width={width + leftMargin}
          height={cellSize + HIGHLIGHT_STROKE_WIDTH}
          x={-leftMargin + HIGHLIGHT_STROKE_WIDTH / 2}
          y={destinationScale(destinationHighlight)! - HIGHLIGHT_STROKE_WIDTH / 2}
          visibility={destinationHighlight ? 'visible' : 'hidden'}
          style={{ strokeWidth: HIGHLIGHT_STROKE_WIDTH }}
        />
      )}

      {orderingNode && (
        <rect
          id="orderHighlight"
          className="highlight"
          width={cellSize + HIGHLIGHT_STROKE_WIDTH}
          height={height + topMargin}
          y={-topMargin + HIGHLIGHT_STROKE_WIDTH / 2}
          x={originScale(orderingNode)! - HIGHLIGHT_STROKE_WIDTH / 2}
          style={{ strokeWidth: HIGHLIGHT_STROKE_WIDTH }}
        />
      )}
    </>
  );
}
