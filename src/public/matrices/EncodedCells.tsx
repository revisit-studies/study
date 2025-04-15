import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  originAccesor, destinationAccesor, meanAccesor, stdAccesor,
} from './utils/Accesors';
import { useMatrixContext } from './utils/MatrixContext';
import { link } from './utils/Interfaces';
import { useRenderEcondedCells } from './hooks/useRenderEncodeCells';

export function EncodedCells({ data }: { data: link[] }) {
  const {
    cellSize, encoding, isSnr, meanScale, devScale, originScale, destinationScale,
  } = useMatrixContext();

  const ref = useRef<SVGGElement | null>(null);
  const cellRenderer = useRenderEcondedCells(meanScale, devScale, cellSize, isSnr);

  useEffect(() => {
    if (!ref.current) return;

    const filteredData = data.filter((d) => d.origin >= d.destination);
    filteredData.forEach((d) => {
      if (d.destination !== d.origin) {
        const item = { ...d };
        item.origin = d.destination;
        item.destination = d.origin;
        filteredData.push(item);
      }
    });

    const g = d3
      .select(ref.current)
      .selectAll<SVGGElement, link>('.cell')
      .data(
        filteredData,
        (d) => originAccesor(d) + destinationAccesor(d) + meanAccesor(d) + stdAccesor(d),
      )
      .join(
        (enter) => enter
          .append('g')
          .attr('class', 'cell')
          .attr(
            'transform',
            (d: link) => `translate(${originScale(originAccesor(d))}, ${destinationScale(
              destinationAccesor(d),
            )})`,
          ),
        (update) => {
          update.selectAll('*').remove();
          return update.attr(
            'transform',
            (d: link) => `translate(${originScale(originAccesor(d))}, ${destinationScale(
              destinationAccesor(d),
            )})`,
          );
        },
        (exit) => exit.remove(),
      );

    cellRenderer(g, encoding);
  }, [data, originScale, destinationScale, cellRenderer, ref, encoding]);

  return <g ref={ref} />;
}
