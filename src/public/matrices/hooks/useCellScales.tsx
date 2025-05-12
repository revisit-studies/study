import { useMemo } from 'react';
import * as d3 from 'd3';
import { createLinearScale, createMarkScale } from './useRenderEncodeCells';
import { ColorScheme, EncodingType } from '../utils/Enums';

function getColorScale(colorScale: string, nMeans: number) {
  const range = createLinearScale(nMeans, 0, 1);
  let meanColorScheme;
  switch (colorScale) {
    case ColorScheme.Viridis:
      meanColorScheme = range.map((t) => d3.interpolateViridis(t)).reverse();
      break;
    case ColorScheme.Cividis:
      meanColorScheme = range.map((t) => d3.interpolateCividis(t)).reverse();
      break;
    case ColorScheme.Warm:
      meanColorScheme = range.map((t) => d3.interpolateWarm(t)).reverse();
      break;
    case ColorScheme.Cool:
      meanColorScheme = range.map((t) => d3.interpolateCool(t)).reverse();
      break;
    case ColorScheme.Plasma:
      meanColorScheme = range.map((t) => d3.interpolatePlasma(t)).reverse();
      break;
    case ColorScheme.Inferno:
      meanColorScheme = range.map((t) => d3.interpolateInferno(t)).reverse();
      break;
    case ColorScheme.Turbo:
      meanColorScheme = range.map((t) => d3.interpolateTurbo(t)).reverse();
      break;
    case ColorScheme.Blues:
      meanColorScheme = range.map((t) => d3.interpolateBlues(t));
      break;
    case ColorScheme.Oranges:
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
    const scheme = encoding === EncodingType.Bars ? barsScheme : colorScheme;
    return d3.scaleQuantize<number | string>().domain([meanMin, meanMax]).range(scheme);
  }, [meanMin, meanMax, nMeans, colorScale, encoding, cellSize]);

  const devScale = useMemo(() => {
    let steps = [1];
    switch (encoding) {
      case EncodingType.Bars: {
        steps = createLinearScale(nDevs, cellSize * 0.2, cellSize * 0.9);
        if (isSnr) steps = steps.reverse();
        break;
      }
      case EncodingType.Bivariate: {
        steps = createLinearScale(nDevs, 0.2, 1).reverse();
        break;
      }
      case EncodingType.ColoredRotation45:
      case EncodingType.MarkRotation45: {
        steps = createLinearScale(nDevs);
        break;
      }
      case EncodingType.ColoredRotation90:
      case EncodingType.MarkRotation90: {
        steps = createLinearScale(nDevs, 0, 90);
        break;
      }

      case EncodingType.Mark: {
        steps = createMarkScale(nDevs, cellSize * 0.8);
        break;
      }
      case EncodingType.Size: {
        steps = createLinearScale(nDevs, cellSize * 0.3, cellSize).reverse();
        break;
      }
      default:
    }

    return d3.scaleQuantize<number | string>().domain([devMin, devMax]).range(steps);
  }, [devMin, devMax, nDevs, encoding, cellSize, isSnr]);

  return { meanScale, devScale };
}
