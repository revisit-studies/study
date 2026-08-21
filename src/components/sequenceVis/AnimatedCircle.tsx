import { animated, easings, useSpring } from '@react-spring/web';
import type { SpringValue } from '@react-spring/web';
import type { ComponentType } from 'react';

type AnimatedCircleProps = {
  cx: SpringValue<number>;
  cy: SpringValue<number>;
  r: SpringValue<number>;
  fill: SpringValue<string>;
};

const SpringCircle = animated.circle as unknown as ComponentType<AnimatedCircleProps>;

export function AnimatedCircle({
  cx, cy, r, fill, id,
} : {cx: number, cy: number, r: number, fill: string, id: string}) {
  const spring = useSpring({
    cx, cy, r, fill, config: { duration: 1000, easing: easings.easeInOutCirc },
  });

  return (
    <g id={id}>
      <SpringCircle {...spring} />
    </g>
  );
}
