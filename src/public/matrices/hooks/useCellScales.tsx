import { useMemo } from 'react';
import * as d3 from 'd3';
import { createLinearScale, createMarkScale } from './useRenderEncodeCells';
import { ColorScheme, Encoding } from '../utils/Enums';

function getColorScale(colorScale: string, nMeans: number) {
  const range = createLinearScale(nMeans, 0, 1);
  let meanColorScheme;
  switch (colorScale) {
    case ColorScheme.viridis:
      meanColorScheme = range.map((t) => d3.interpolateViridis(t)).reverse();
      break;
    case ColorScheme.cividis:
      meanColorScheme = range.map((t) => d3.interpolateCividis(t)).reverse();
      break;
    case ColorScheme.warm:
      meanColorScheme = range.map((t) => d3.interpolateWarm(t)).reverse();
      break;
    case ColorScheme.cool:
      meanColorScheme = range.map((t) => d3.interpolateCool(t)).reverse();
      break;
    case ColorScheme.plasma:
      meanColorScheme = range.map((t) => d3.interpolatePlasma(t)).reverse();
      break;
    case ColorScheme.inferno:
      meanColorScheme = range.map((t) => d3.interpolateInferno(t)).reverse();
      break;
    case ColorScheme.turbo:
      meanColorScheme = range.map((t) => d3.interpolateTurbo(t)).reverse();
      break;
    case ColorScheme.blues:
      meanColorScheme = range.map((t) => d3.interpolateBlues(t));
      break;
    case ColorScheme.oranges:
      meanColorScheme = range.map((t) => d3.interpolateOranges(t));
      break;
    default:
      meanColorScheme = range.map((t) => d3.interpolateYlOrRd(t));
      break;
  }

  return meanColorScheme;
}

export function useCellScales(
  encoding: string,
  colorScale: string,
  cellSize: number,
  meanMin: number,
  meanMax: number,
  devMin: number,
  devMax: number,
  isSnr: boolean,
  nMeans: number,
  nDevs: number,
) {
  const meanScale = useMemo(() => {
    const barsScheme = createLinearScale(5, cellSize * 0.2, cellSize * 0.9);
    const colorScheme = getColorScale(colorScale, nMeans);
    const scheme = encoding === Encoding.bars ? barsScheme : colorScheme;
    return d3.scaleQuantize<number | string>().domain([meanMin, meanMax]).range(scheme).nice();
  }, [meanMin, meanMax, nMeans, colorScale, encoding, cellSize]);

  const devScale = useMemo(() => {
    let steps = [1];
    switch (encoding) {
      case Encoding.bars: {
        steps = createLinearScale(nDevs, cellSize * 0.2, cellSize * 0.9);
        if (isSnr) steps = steps.reverse();
        break;
      }
      case Encoding.light: {
        steps = createLinearScale(nDevs, 0.2, 1).reverse();
        break;
      }
      case Encoding.rotation: {
        steps = createLinearScale(nDevs);
        break;
      }
      case Encoding.colorRotation: {
        steps = createLinearScale(nDevs);
        break;
      }
      case Encoding.mark: {
        steps = createMarkScale(nDevs, cellSize * 0.8);
        break;
      }
      case Encoding.size: {
        steps = createLinearScale(nDevs, cellSize * 0.3, cellSize).reverse();
        break;
      }
      default:
    }

    return d3.scaleQuantize<number | string>().domain([devMin, devMax]).range(steps).nice();
  }, [devMin, devMax, nDevs, encoding, cellSize, isSnr]);

  return { meanScale, devScale };
}
