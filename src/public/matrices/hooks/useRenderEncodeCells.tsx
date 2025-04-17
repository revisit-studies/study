import * as d3 from 'd3';
import { useCallback } from 'react';
import { Encoding } from '../utils/Enums';
import { link } from '../utils/Interfaces';
import { meanAccesor, snrAccesor, stdAccesor } from '../utils/Accesors';

// Utility functions
/* function createSizeScale(nSteps: number, cellSize: number) {
  const stepSize = cellSize / nSteps;
  return Array.from({ length: nSteps }, (_, i) => stepSize * (i + 1)).reverse();
} */

/* const markColor = '#ff6e4a'; */
const markColor = 'white';

export function createMarkScale(nSteps: number, cellSize: number) {
  const stepSize = cellSize / (nSteps + 1);
  return Array.from({ length: nSteps }, (_, i) => stepSize * (i + 1));
}

export function createLinearScale(steps: number, min = 0, max = 45): number[] {
  const stepSize = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => min + stepSize * i);
}

export function useRenderEcondedCells(
  meanScale: d3.ScaleQuantize<string | number, never>,
  devScale: d3.ScaleQuantize<string | number, never> | (() => number),
  cellSize: number,
  isSnr: boolean,
) {
  const renderEncodedCells = useCallback(
    (
      gCells: d3.Selection<SVGGElement, link, SVGGElement | null, unknown>,
      encoding: string,
      showMean: boolean = true,
      showDev: boolean = true,
    ) => {
      // gCells.selectAll('*').remove();

      const devAccesor = isSnr ? snrAccesor : stdAccesor;

      function addBaseRect(fill: string | ((d: link) => string | number) = 'black') {
        gCells.append('rect').attr('fill', fill).attr('width', cellSize).attr('height', cellSize);
      }

      switch (encoding) {
        case Encoding.bars: {
          const proportion = 0.6;
          const cellProportion = 0.8;
          const size = cellSize * cellProportion;

          function addMeanBar(showBorder: boolean = false) {
            if (showBorder) {
              gCells
                .append('rect')
                .attr('fill', 'transparent')
                .attr('width', cellSize)
                .attr('height', cellSize)
                .attr('stroke', 'black')
                .attr('stroke-width', 1.5);
            }

            gCells
              .append('rect')
              .attr('fill', '#1f77b4')
              .attr('width', size * proportion)
              .attr('height', (d: link) => +meanScale(meanAccesor(d)))
              .attr('y', (d: link) => cellSize - +meanScale(meanAccesor(d)))
              .attr('x', (cellSize - size) / 2);
          }

          function addStdBar(showBorder: boolean = false) {
            if (showBorder) {
              gCells
                .append('rect')
                .attr('fill', 'transparent')
                .attr('width', cellSize)
                .attr('height', cellSize)
                .attr('stroke', 'black')
                .attr('stroke-width', 1.5);
            }
            gCells
              .append('rect')
              .attr('fill', '#ff7f0e')
              .attr('width', size * (1 - proportion))
              .attr('height', (d: link) => +devScale(devAccesor(d)))
              .attr('x', (cellSize - size) / 2 + size * proportion)
              .attr('y', (d: link) => cellSize - +devScale(devAccesor(d)));
          }

          if (showMean && showDev) {
            addMeanBar();
            addStdBar();
          } else if (showMean) {
            addMeanBar(true);
          } else if (showDev) {
            addStdBar(true);
          }

          break;
        }
        case Encoding.light: {
          gCells
            .append('rect')
            .attr('fill', 'white')
            .attr('width', cellSize)
            .attr('height', cellSize);
          gCells
            .append('rect')
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('fill', (d: link) => meanScale(meanAccesor(d)))
            .attr('opacity', (d: link) => devScale(devAccesor(d)));

          break;
        }
        case Encoding.rotation: {
          const markWidth = cellSize * 0.8;
          const markHeight = cellSize * 0.2;
          const center = cellSize / 2;
          const offsetX = (cellSize - markWidth) / 2;
          const offsetY = (cellSize - markHeight) / 2;

          function addRotationMark() {
            gCells
              .append('rect')
              .attr('fill', markColor)
              .attr('width', markWidth)
              .attr('height', markHeight)
              .attr('x', offsetX)
              .attr('y', offsetY)
              .attr('transform', (d: link) => {
                const angle = -devScale(devAccesor(d));
                return `rotate(${angle}, ${center}, ${center})`;
              });
          }

          if (showMean && showDev) {
            addBaseRect((d: link) => meanScale(meanAccesor(d)));
            addRotationMark();
          } else if (showMean) {
            addBaseRect((d: link) => meanScale(meanAccesor(d)));
          } else if (showDev) {
            addBaseRect();
            addRotationMark();
          }

          break;
        }
        case Encoding.colorRotation: {
          const markWidth = cellSize * 0.8;
          const markHeight = cellSize * 0.6;
          const center = cellSize / 2;
          const offsetX = (cellSize - markWidth) / 2;
          const offsetY = (cellSize - markHeight) / 2;

          function addRotationMark(
            fill: string | ((d: link) => string | number) = 'black',
            showBorder: boolean = false,
          ) {
            if (showBorder) {
              gCells
                .append('rect')
                .attr('fill', 'transparent')
                .attr('width', cellSize)
                .attr('height', cellSize)
                .attr('stroke', 'black')
                .attr('stroke-width', 1.5);
            }

            gCells
              .append('rect')
              .attr('fill', fill)
              .attr('width', markWidth)
              .attr('height', markHeight)
              .attr('x', offsetX)
              .attr('y', offsetY)
              .attr('transform', (d: link) => {
                const angle = -devScale(devAccesor(d));
                return `rotate(${angle}, ${center}, ${center})`;
              });
          }

          if (showMean && showDev) {
            addRotationMark((d: link) => meanScale(meanAccesor(d)));
          } else if (showMean) {
            addRotationMark((d: link) => meanScale(meanAccesor(d)), true);
          } else if (showDev) {
            addRotationMark('black', true);
          }

          break;
        }
        case Encoding.mark: {
          function addMark() {
            gCells
              .append('rect')
              .attr('fill', markColor)
              .attr('width', (d: link) => +devScale(devAccesor(d)))
              .attr('height', (d: link) => +devScale(devAccesor(d)))
              .attr('x', (d: link) => (cellSize - +devScale(devAccesor(d))) / 2)
              .attr('y', (d: link) => (cellSize - +devScale(devAccesor(d))) / 2);
          }

          if (showMean && showDev) {
            addBaseRect((d: link) => meanScale(meanAccesor(d)));
            addMark();
          } else if (showMean) {
            addBaseRect((d: link) => meanScale(meanAccesor(d)));
          } else if (showDev) {
            addBaseRect();
            addMark();
          }

          break;
        }
        case Encoding.size: {
          if (showMean && showDev) {
            gCells
              .append('rect')
              .attr('fill', (d: link) => meanScale(meanAccesor(d)))
              .attr('width', (d: link) => devScale(devAccesor(d)))
              .attr('height', (d: link) => devScale(devAccesor(d)))
              .attr('x', (d: link) => (cellSize - +devScale(devAccesor(d))) / 2)
              .attr('y', (d: link) => (cellSize - +devScale(devAccesor(d))) / 2);
          } else if (showMean) {
            gCells
              .append('rect')
              .attr('fill', (d: link) => meanScale(meanAccesor(d)))
              .attr('width', cellSize)
              .attr('height', cellSize);
          } else if (showDev) {
            gCells
              .append('rect')
              .attr('fill', 'black')
              .attr('width', (d: link) => devScale(devAccesor(d)))
              .attr('height', (d: link) => devScale(devAccesor(d)))
              .attr('x', (d: link) => (cellSize - +devScale(devAccesor(d))) / 2)
              .attr('y', (d: link) => (cellSize - +devScale(devAccesor(d))) / 2);
          }
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
    [meanScale, devScale, cellSize, isSnr],
  );

  return renderEncodedCells;
}
