import { animated, easings, useSpring } from '@react-spring/web';
import type { SpringValue } from '@react-spring/web';
import type { ComponentType } from 'react';

type AnimatedRectProps = {
  x: SpringValue<number>;
  y: SpringValue<number>;
  fill: SpringValue<string>;
  height: SpringValue<number>;
  width: SpringValue<number>;
};

const SpringRect = animated.rect as unknown as ComponentType<AnimatedRectProps>;

export function AnimatedRect({
  x, y, fill, height, width,
} : {x: number, y: number, fill: string, height: number, width: number}) {
  const spring = useSpring({
    x, y, fill, height, width, config: { duration: 1000, easing: easings.easeInOutCirc },
  });

  return <SpringRect {...spring} />;
}
