import { useCallback, useMemo } from 'react';
import d3 from 'd3';
import { link } from './Interfaces';
import { meanAccesor, snrAccesor, stdAccesor } from './Accesors';

// Utility functions
/* function createSizeScale(nSteps: number, cellSize: number) {
  const stepSize = cellSize / nSteps;
  return Array.from({ length: nSteps }, (_, i) => stepSize * (i + 1)).reverse();
} */

function createMarkScale(nSteps: number, cellSize: number) {
  const stepSize = cellSize / (nSteps + 1);
  return Array.from({ length: nSteps }, (_, i) => stepSize * (i + 1));
}

function createLinearScale(steps: number, min = 0, max = 45) {
  const stepSize = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => min + stepSize * i);
}

export function useRenderEcondedCells(data: link[], encoding: string | null, isSnr: boolean | null, cellSize: number) {
  const devAccesor = isSnr ? snrAccesor : stdAccesor;

  const { meanMin, meanMax } = useMemo(() => {
    const means = data.map(meanAccesor);
    return { meanMin: Math.min(...means), meanMax: Math.max(...means) };
  }, [data]);

  const { devMin, devMax } = useMemo(() => {
    const devs = data.map(devAccesor);
    return { devMin: Math.min(...devs), devMax: Math.max(...devs) };
  }, [data]);

  const meanScale = useMemo(() => {
    const range = createLinearScale(5, 0, 1);
    const scheme = range.map((t) => d3.interpolateViridis(t)).reverse();
    return d3.scaleQuantize<string>().domain([meanMin, meanMax]).range(scheme);
  }, [meanMin, meanMax]);

  const getDeviationScale = useCallback(
    (devSteps: number[]) => d3.scaleQuantize<number>().domain([devMin, devMax]).range(devSteps),
    [devMin, devMax],
  );

  const renderEncodedCells = useCallback(
    (gCells: d3.Selection<SVGGElement, link, SVGGElement | null, unknown>) => {
      gCells.selectAll('*').remove();
      let steps: number[];
      let devScale: (value: number) => number;

      switch (encoding) {
        case 'bars': {
          const proportion = 0.6;
          const cellProportion = 0.8;
          const meanSteps = createLinearScale(5, cellSize * 0.2, cellSize * 0.9);
          let devSteps = createLinearScale(5, cellSize * 0.2, cellSize * 0.9);
          const size = cellSize * cellProportion;

          const barMeanScale = d3.scaleQuantize().domain([meanMin, meanMax]).range(meanSteps);

          if (isSnr) devSteps = devSteps.reverse();

          const barsDevScale = d3.scaleQuantize().domain([devMin, devMax]).range(devSteps);

          gCells.append('rect').attr('fill', 'transparent').attr('width', size).attr('height', size);

          gCells
            .append('rect')
            .attr('fill', '#1f77b4')
            .attr('width', size * proportion)
            .attr('height', (d: link) => barMeanScale(meanAccesor(d)))
            .attr('y', (d: link) => cellSize - barMeanScale(meanAccesor(d)))
            .attr('x', (cellSize - size) / 2);

          gCells
            .append('rect')
            .attr('fill', '#ff7f0e')
            .attr('width', size * (1 - proportion))
            .attr('height', (d: link) => barsDevScale(devAccesor(d)))
            .attr('x', size * proportion + (cellSize - size) / 2)
            .attr('y', (d: link) => cellSize - barsDevScale(devAccesor(d)));

          break;
        }
        case 'light': {
          steps = createLinearScale(5, 0.2, 1).reverse();
          devScale = getDeviationScale(steps);

          gCells.append('rect').attr('fill', 'white').attr('width', cellSize).attr('height', cellSize);

          gCells
            .append('rect')
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('fill', (d: link) => meanScale(meanAccesor(d)))
            .attr('opacity', (d: link) => devScale(devAccesor(d)));

          break;
        }
        case 'rotation': {
          steps = createLinearScale(5);
          devScale = getDeviationScale(steps);

          const markWidth = cellSize * 0.8;
          const markHeight = cellSize * 0.2;
          const center = cellSize / 2;
          const offsetX = (cellSize - markWidth) / 2;
          const offsetY = (cellSize - markHeight) / 2;

          gCells
            .append('rect')
            .attr('class', 'mark')
            .attr('fill', (d: link) => meanScale(meanAccesor(d)))
            .attr('width', cellSize)
            .attr('height', cellSize);

          gCells
            .append('rect')
            .attr('class', 'rotationMark')
            .attr('fill', 'black')
            .attr('width', markWidth)
            .attr('height', markHeight)
            .attr('x', offsetX)
            .attr('y', offsetY)
            .attr('transform', (d: link) => {
              const angle = -devScale(devAccesor(d));
              return `rotate(${angle}, ${center}, ${center})`;
            });

          break;
        }
        case 'mark': {
          steps = createMarkScale(5, cellSize * 0.8);
          devScale = getDeviationScale(steps);

          gCells
            .append('rect')
            .attr('class', 'mark')
            .attr('fill', (d: link) => meanScale(meanAccesor(d)))
            .attr('width', cellSize)
            .attr('height', cellSize);

          gCells
            .append('rect')
            .attr('fill', 'black')
            .attr('width', (d: link) => devScale(devAccesor(d)))
            .attr('height', (d: link) => devScale(devAccesor(d)))
            .attr('x', (d: link) => (cellSize - devScale(devAccesor(d))) / 2)
            .attr('y', (d: link) => (cellSize - devScale(devAccesor(d))) / 2);

          break;
        }
        case 'size': {
          steps = createMarkScale(5, cellSize);
          devScale = getDeviationScale(steps);

          gCells
            .append('rect')
            .attr('class', 'mark')
            .attr('fill', (d: link) => meanScale(meanAccesor(d)))
            .attr('width', (d: link) => devScale(devAccesor(d)))
            .attr('height', (d: link) => devScale(devAccesor(d)))
            .attr('x', (d: link) => (cellSize - devScale(devAccesor(d))) / 2)
            .attr('y', (d: link) => (cellSize - devScale(devAccesor(d))) / 2);
          break;
        }

        default: {
          gCells
            .append('rect')
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('fill', (d: link) => meanScale(meanAccesor(d)));
          break;
        }
      }
    },
    [encoding, meanScale, getDeviationScale, cellSize, isSnr],
  );

  return renderEncodedCells;
}
