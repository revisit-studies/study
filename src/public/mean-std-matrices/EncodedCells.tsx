import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { originAccesor, destinationAccesor, meanAccesor } from './Accesors';
import { useMatrixContext } from './MatrixContext';
import { link } from './Interfaces';
import { useRenderEcondedCells } from './useRenderEncodeCells';

export function EncodedCells({ data }: { data: link[] }) {
  const {
    cellSize,

    encoding,
    isSnr,

    originScale,
    destinationScale,
  } = useMatrixContext();
  const ref = useRef<SVGGElement | null>(null);

  const renderEncodedCells = useRenderEcondedCells(data, encoding, isSnr, cellSize);

  const gCells = useMemo(
    () => d3
      .select(ref.current)
      .selectAll<SVGGElement, link>('.cell')
      .data<link>(data, (d) => originAccesor(d) + destinationAccesor(d) + meanAccesor(d) + d.std)
      .join(
        (enter) => enter
          .append('g')
          .attr('class', 'cell')
          .attr('transform', (d: link) => `translate(${originScale(originAccesor(d))}, ${destinationScale(destinationAccesor(d))})`),
        (update) => {
          update.selectAll('*').remove();
          return update.attr('transform', (d: link) => `translate(${originScale(originAccesor(d))}, ${destinationScale(destinationAccesor(d))})`);
        },
        (exit) => exit.remove(),
      ),
    [data, originScale, destinationScale, ref, encoding],
  );
  useEffect(() => {
    renderEncodedCells(gCells);
  }, [gCells, renderEncodedCells, encoding]);

  return <g ref={ref} />;
}
