import * as d3 from 'd3';
import { useCallback } from 'react';
import { lab } from 'd3-color';
import { EncodingType } from '../utils/Enums';
import { Link } from '../utils/Interfaces';
import { meanAccessor, snrAccessor, stdAccessor } from '../utils/Accessors';

const barMeanColor = '#7b3294';
const barStdColor = '#008837';

function contrastGray(color: string, contrast: number): string {
  const { l } = lab(color);
  const invL = 100 - l;
  const scaledL = 100 - contrast + (invL * contrast) / 100;
  return lab(scaledL, 0, 0).formatHex();
}

export function createMarkScale(nSteps: number, cellSize: number) {
  const stepSize = cellSize / (nSteps + 1);
  return Array.from({ length: nSteps }, (_, i) => stepSize * (i + 1));
}

export function createLinearScale(steps: number, min = 0, max = 45): number[] {
  const stepSize = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => min + stepSize * i);
}

export function useCellRenderer(
  encoding: string,
  markContrast: number,
  isSnr: boolean,
  meanScale: d3.ScaleQuantize<string | number, never>,
  devScale: d3.ScaleQuantize<string | number, never> | (() => number),
  cellSize: number,
) {
  const renderEncodedCells = useCallback(
    (
      gCells: d3.Selection<SVGGElement, Link, SVGGElement | null, unknown>,
      showMean: boolean = true,
      showDev: boolean = true,
    ) => {
      // gCells.selectAll('*').remove();

      const devAccesor = isSnr ? snrAccessor : stdAccessor;

      function addBaseRect(fill: string | ((d: Link) => string | number) = 'black') {
        gCells.append('rect').attr('fill', fill).attr('width', cellSize).attr('height', cellSize);
      }

      function markColor(d: Link) {
        const meanColor = meanScale(meanAccessor(d));
        return contrastGray(meanColor as string, markContrast);
      }

      switch (encoding) {
        case EncodingType.BarChart: {
          const proportion = 0.5;
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
              .attr('fill', barMeanColor)
              .attr('width', size * proportion)
              .attr('height', (d: Link) => +meanScale(meanAccessor(d)))
              .attr('y', (d: Link) => cellSize - +meanScale(meanAccessor(d)))
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
              .attr('fill', barStdColor)
              .attr('width', size * (1 - proportion))
              .attr('height', (d: Link) => +devScale(devAccesor(d)))
              .attr('x', (cellSize - size) / 2 + size * proportion)
              .attr('y', (d: Link) => cellSize - +devScale(devAccesor(d)));
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
        case EncodingType.Bivariate: {
          gCells
            .append('rect')
            .attr('fill', 'white')
            .attr('width', cellSize)
            .attr('height', cellSize);
          gCells
            .append('rect')
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('fill', (d: Link) => meanScale(meanAccessor(d)))
            .attr('opacity', (d: Link) => devScale(devAccesor(d)));

          break;
        }
        case EncodingType.MarkAngle45:
        case EncodingType.MarkAngle45_90:
        case EncodingType.MarkAngle90: {
          const markWidth = cellSize * 0.8;
          const markHeight = cellSize * 0.2;
          const center = cellSize / 2;
          const offsetX = (cellSize - markWidth) / 2;
          const offsetY = (cellSize - markHeight) / 2;

          function addRotationMark(fill: string | ((d: Link) => string) = '#CCCCCC') {
            gCells
              .append('rect')
              .attr('fill', fill)
              .attr('width', markWidth)
              .attr('height', markHeight)
              .attr('x', offsetX)
              .attr('y', offsetY)
              .attr('transform', (d: Link) => {
                const angle = -devScale(devAccesor(d));
                return `rotate(${angle}, ${center}, ${center})`;
              });
          }

          if (showMean && showDev) {
            addBaseRect((d: Link) => meanScale(meanAccessor(d)));
            addRotationMark(markColor);
          } else if (showMean) {
            addBaseRect((d: Link) => meanScale(meanAccessor(d)));
          } else if (showDev) {
            addBaseRect();
            addRotationMark();
          }

          break;
        }

        case EncodingType.ColorAngle45:
        case EncodingType.ColorAngle90: {
          const markWidth = cellSize * 0.8;
          const markHeight = cellSize * 0.6;
          const center = cellSize / 2;
          const offsetX = (cellSize - markWidth) / 2;
          const offsetY = (cellSize - markHeight) / 2;

          function addRotationMark(
            fill: string | ((d: Link) => string | number) = 'black',
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
              .attr('transform', (d: Link) => {
                const angle = -devScale(devAccesor(d));
                return `rotate(${angle}, ${center}, ${center})`;
              });
          }

          if (showMean && showDev) {
            addRotationMark((d: Link) => meanScale(meanAccessor(d)));
          } else if (showMean) {
            addRotationMark((d: Link) => meanScale(meanAccessor(d)), true);
          } else if (showDev) {
            addRotationMark('black', true);
          }

          break;
        }
        case EncodingType.MarkSize: {
          function addMark(fill: string | ((d: Link) => string) = '#CCCCCC') {
            gCells
              .append('rect')
              .attr('fill', fill)
              .attr('width', (d: Link) => +devScale(devAccesor(d)))
              .attr('height', (d: Link) => +devScale(devAccesor(d)))
              .attr('x', (d: Link) => (cellSize - +devScale(devAccesor(d))) / 2)
              .attr('y', (d: Link) => (cellSize - +devScale(devAccesor(d))) / 2);
          }

          if (showMean && showDev) {
            addBaseRect((d: Link) => meanScale(meanAccessor(d)));
            addMark(markColor);
          } else if (showMean) {
            addBaseRect((d: Link) => meanScale(meanAccessor(d)));
          } else if (showDev) {
            addBaseRect();
            addMark();
          }

          break;
        }
        case EncodingType.CellSize: {
          if (showMean && showDev) {
            gCells
              .append('rect')
              .attr('fill', (d: Link) => meanScale(meanAccessor(d)))
              .attr('width', (d: Link) => devScale(devAccesor(d)))
              .attr('height', (d: Link) => devScale(devAccesor(d)))
              .attr('x', (d: Link) => (cellSize - +devScale(devAccesor(d))) / 2)
              .attr('y', (d: Link) => (cellSize - +devScale(devAccesor(d))) / 2);
          } else if (showMean) {
            gCells
              .append('rect')
              .attr('fill', (d: Link) => meanScale(meanAccessor(d)))
              .attr('width', cellSize)
              .attr('height', cellSize);
          } else if (showDev) {
            gCells
              .append('rect')
              .attr('fill', 'black')
              .attr('width', (d: Link) => devScale(devAccesor(d)))
              .attr('height', (d: Link) => devScale(devAccesor(d)))
              .attr('x', (d: Link) => (cellSize - +devScale(devAccesor(d))) / 2)
              .attr('y', (d: Link) => (cellSize - +devScale(devAccesor(d))) / 2);
          }
          break;
        }

        default: {
          gCells
            .append('rect')
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('fill', (d: Link) => meanScale(meanAccessor(d)));
          break;
        }
      }
    },
    [meanScale, devScale, cellSize, isSnr, encoding, markContrast],
  );

  return renderEncodedCells;
}
