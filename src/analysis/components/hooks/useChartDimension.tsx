import {
  RefObject, useEffect, useRef, useState,
} from 'react';

interface Dimensions {
    marginTop: number,
    marginBottom: number,
    marginRight: number,
    marginLeft: number,
    height?: number,
    width?: number,
}

interface BoundedDimensions extends Dimensions {
    boundedHeight: number,
    boundedWidth: number,
}
const { ResizeObserver } = window;

const combineChartDimensions = (dimensions : Dimensions) => {
  const parsedDimensions = {
    ...dimensions,
    marginTop: dimensions.marginTop || 10,
    marginRight: dimensions.marginRight || 10,
    marginBottom: dimensions.marginBottom || 40,
    marginLeft: dimensions.marginLeft || 10,
  };

  return {
    ...parsedDimensions,
    boundedHeight: Math.max(
      parsedDimensions.height!
            - parsedDimensions.marginTop
            - parsedDimensions.marginBottom,
      0,
    ),
    boundedWidth: Math.max(
      parsedDimensions.width!
            - parsedDimensions.marginLeft
            - parsedDimensions.marginRight,
      0,
    ),
  };
};
const useChartDimensions = (dimensionsprop: Dimensions): [RefObject<HTMLDivElement>, BoundedDimensions] => {
  const ref = useRef<HTMLDivElement>(null);
  const dimensions = combineChartDimensions(dimensionsprop);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(
    () => {
      if (!ref.current) return;
      const element = ref.current;
      const resizeObserver = new ResizeObserver(
        (entries) => {
          if (!Array.isArray(entries)) return;
          if (!entries.length) return;
          const entry = entries[0];
          if (width !== entry.contentRect.width) setWidth(entry.contentRect.width);
          if (height !== entry.contentRect.height) setHeight(entry.contentRect.height);
        },
      );
      resizeObserver.observe(element);
      // eslint-disable-next-line consistent-return
      return () => resizeObserver.unobserve(element);
    },
    [],
  );

  const newSettings = combineChartDimensions({
    ...dimensions,
    width: dimensions.width || width,
    height: dimensions.height || height,
  });
  return [ref, newSettings];
};

export default useChartDimensions;
