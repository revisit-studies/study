import { useCallback, useMemo } from 'react';
import * as d3 from 'd3';

import { useMatrixContext } from '../utils/MatrixContext';

export function invertScaleBand(scale: d3.ScaleBand<string>, value: number) {
  const domain = scale.domain();
  const range = scale.range();

  const index = Math.floor((value - range[0]) / scale.step());
  return domain[index];
}

export function Background() {
  const {
    size,
    originScale,
    destinationScale,
    setOriginHighlight,
    setDestinationHighlight,
    originHighlight,
    destinationHighlight,
    linkMarks,
    setLinkMarks,
    trrack,
    actions,
  } = useMatrixContext();

  const { width, height } = useMemo(() => ({ width: size, height: size }), [size]);

  const getIndices = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const [x, y] = d3.pointer(e);
      return {
        origin: invertScaleBand(originScale, x),
        destination: invertScaleBand(destinationScale, y),
      };
    },
    [originScale, destinationScale],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const { origin, destination } = getIndices(e);

      if (origin !== originHighlight) setOriginHighlight(origin);
      if (destination !== destinationHighlight) setDestinationHighlight(destination);
    },
    [getIndices, originHighlight, setOriginHighlight, destinationHighlight, setDestinationHighlight],
  );

  const onClick = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const { origin, destination } = getIndices(e);

      const item = linkMarks.find((d) => d[0] === origin && d[1] === destination);

      let newLinkMarks;
      if (!item) {
        newLinkMarks = [[origin, destination], ...linkMarks];
      } else {
        newLinkMarks = linkMarks.filter((d) => d[0] !== origin || d[1] !== destination);
      }
      setLinkMarks(newLinkMarks);
      trrack?.apply('Set Link Marks', actions?.setLinkMarks(newLinkMarks));
    },
    [getIndices, linkMarks, setLinkMarks, trrack, actions],
  );

  return (
    <rect
      width={width}
      height={height}
      fill="transparent"
      opacity={0}
      onClick={onClick}
      onMouseMove={onMouseMove}
    />
  );
}
