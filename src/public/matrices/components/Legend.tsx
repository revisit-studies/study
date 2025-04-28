import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Stack, Text } from '@mantine/core';

import { meanAccesor, stdAccesor } from '../utils/Accesors';
import { useMatrixContext } from '../utils/MatrixContext';
import { link } from '../utils/Interfaces';
import { Encoding } from '../utils/Enums';

import { useRenderEcondedCells } from '../hooks/useRenderEncodeCells';
import { useCellScales } from '../hooks/useCellScales';

const margin = 75;
const meanText = 'Price Ranges:';
const devText = 'Price Deviation Ranges:';

export function Legend() {
  const {
    encoding, isSnr, colorScale, meanMin, meanMax, nMeans, devMin, devMax, nDevs, cellSize,
  } = useMatrixContext();
  /* const legendCellSize = (window.innerWidth * 0.28 - margin * (Math.max(nDevs, nMeans) - 1)) / Math.max(nDevs, nMeans); */
  const legendCellSize = cellSize;
  const meanRef = useRef<SVGGElement | null>(null);
  const devRef = useRef<SVGGElement | null>(null);

  const { meanScale, devScale } = useCellScales(
    encoding,
    colorScale,
    legendCellSize,
    meanMin,
    meanMax,
    devMin,
    devMax,
    isSnr,
    nMeans,
    nDevs,
  );

  const cellRenderer = useRenderEcondedCells(meanScale, devScale, legendCellSize, isSnr);

  const makeLegendData = useCallback(
    (scale: d3.ScaleQuantize<number | string, never>, isMean: boolean): link[] => scale.range().map((color) => {
      const [min, max] = scale.invertExtent(color);
      return {
        mean: isMean ? (min + max) / 2 : 0,
        std: !isMean ? (min + max) / 2 : 0,
        origin: '',
        destination: '',
      };
    }),
    [],
  );

  const drawLegend = useCallback(
    (
      ref: React.RefObject<SVGGElement | null>,
      legendData: link[],
      scale: d3.ScaleQuantize<number | string, never>,
      showMean: boolean,
      showDev: boolean,
    ) => {
      const g = ref.current;
      if (!g) return;

      const group = d3.select(g);
      group.selectAll('*').remove();

      const cells = group
        .selectAll<SVGGElement, link>('.cell')
        .data(legendData, (d) => meanAccesor(d) + stdAccesor(d))
        .enter()
        .append('g')
        .attr('class', 'cell')
        .attr('transform', (_, i) => `translate(${(legendCellSize + margin) * i}, 0)`);

      cells
        .append('text')
        .attr('transform', `translate(${legendCellSize / 2}, ${legendCellSize + 20})`)
        .attr('text-anchor', 'middle')
        .text((_, i) => {
          const [min, max] = scale.invertExtent(scale.range()[i]);
          return `$${min.toFixed(0)} - $${+max.toFixed(0) - 0.01}`;
        });

      cellRenderer(group.selectAll('.cell'), encoding, showMean, showDev);
    },
    [legendCellSize, encoding, cellRenderer],
  );

  const makeLightnessLegendData = useCallback(
    (
      mScale: d3.ScaleQuantize<number | string, never>,
      dScale: d3.ScaleQuantize<number | string, never>,
    ): link[] => {
      const data: link[] = [];
      mScale.range().forEach((mExtent, i) => {
        const [mMin, mMax] = meanScale.invertExtent(mExtent);
        dScale.range().forEach((dExtent, j) => {
          const [dMin, dMax] = devScale.invertExtent(dExtent);

          const item = {
            mean: (mMin + mMax) / 2,
            std: (dMin + dMax) / 2,
            origin: `${i}`,
            destination: `${j}`,
          };

          data.push(item);
        });
      });
      return data;
    },

    [meanScale, devScale],
  );

  const drawLightnessLegend = useCallback(
    (
      ref: React.RefObject<SVGGElement | null>,
      legendData: link[],
      mScale: d3.ScaleQuantize<number | string, never>,
      dScale: d3.ScaleQuantize<number | string, never>,
      showMean: boolean,
      showDev: boolean,
    ) => {
      const g = ref.current;
      if (!g) return;

      const group = d3.select(g);
      group.selectAll('*').remove();

      group
        .selectAll<SVGGElement, link>('.cell')
        .data(legendData, (d) => meanAccesor(d) + stdAccesor(d) + encoding)
        .join('g')
        .attr('class', 'cell')
        .attr(
          'transform',
          (d) => `translate(${(legendCellSize + margin / 2) * +d.origin}, ${
            legendCellSize * +d.destination + margin
          })`,
        );

      group
        .selectAll<SVGGElement, link>('.meanLabel')
        .data(mScale.range())
        .join('text')
        .attr(
          'transform',
          (d, i) => `translate(${(legendCellSize + margin / 2) * i + legendCellSize * 0.5}, ${margin / 2})`,
        )
        .attr('text-anchor', 'middle')
        .text((d) => {
          const [min, max] = mScale.invertExtent(d);
          return `$${min.toFixed(0)} - $${max.toFixed(0)}`;
        });

      group
        .selectAll<SVGGElement, link>('.devLabel')
        .data(dScale.range())
        .join('text')
        .attr(
          'transform',
          (d, i) => `translate(${mScale.range().length * (legendCellSize + margin / 2)},${
            legendCellSize * i + margin + legendCellSize / 2
          })`,
        )
        .attr('text-anchor', 'start')
        .text((d) => {
          const [min, max] = dScale.invertExtent(d);
          return `$${min.toFixed(0)} - $${max.toFixed(0)}`;
        });

      cellRenderer(group.selectAll('.cell'), encoding, showMean, showDev);
    },
    [legendCellSize, cellRenderer, encoding],
  );

  useEffect(() => {
    if (meanRef.current && encoding !== Encoding.light) {
      const meanLegend = makeLegendData(meanScale, true);
      drawLegend(meanRef, meanLegend, meanScale, true, false);
    }
  }, [meanScale, encoding, drawLegend, makeLegendData]);

  useEffect(() => {
    if (devRef.current && encoding !== Encoding.light) {
      const devLegend = makeLegendData(devScale, false);
      drawLegend(devRef, devLegend, devScale, false, true);
    }
  }, [devScale, encoding, drawLegend, makeLegendData]);

  useEffect(() => {
    if (meanRef.current && encoding === Encoding.light) {
      const data = makeLightnessLegendData(meanScale, devScale);
      drawLightnessLegend(meanRef, data, meanScale, devScale, true, true);
    }
  }, [encoding, meanScale, devScale, drawLightnessLegend, makeLightnessLegendData]);

  return (
    <Stack gap="5vh">
      <div>
        <Text size="xl" fw={700}>
          {meanText}
        </Text>
        <svg
          height={encoding !== Encoding.light ? legendCellSize : '40vh'}
          width="0vw"
          style={{ overflow: 'visible', background: 'green' }}
        >
          <g ref={meanRef} />
        </svg>
      </div>

      {devScale.range().length > 1 && encoding !== Encoding.light && (
        <div>
          <Text size="xl" fw={700}>
            {devText}
          </Text>
          <svg height={legendCellSize} width="0vw" style={{ overflow: 'visible' }}>
            <g ref={devRef} />
          </svg>
        </div>
      )}
    </Stack>
  );
}
