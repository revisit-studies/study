import { useMemo } from 'react';
import * as d3 from 'd3';
import { useMatrixContext } from './MatrixContext';

export function invertScaleBand(scale: d3.ScaleBand<string>, value: number) {
  const domain = scale.domain();
  const range = scale.range();

  // Si el valor está fuera del rango, devolver null
  if (value < range[0] || value > range[1]) {
    return null;
  }

  const index = Math.floor((value - range[0]) / scale.step());
  return domain[index] ?? null;
}

export function Background() {
  const {
    size, originScale, destinationScale, setOriginHighlight, setDestinationHighlight,
  } = useMatrixContext();

  const { width, height } = useMemo(() => ({ width: size, height: size }), [size]);

  const onMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const [x, y] = d3.pointer(e);
    const origin = invertScaleBand(originScale, x);
    const destination = invertScaleBand(destinationScale, y);
    setOriginHighlight(!origin && destination ? destination : origin);
    setDestinationHighlight(!destination && origin ? origin : destination);
  };

  return <rect width={width} height={height} fill="red" opacity={0.1} onMouseMove={onMouseMove} />;
}
