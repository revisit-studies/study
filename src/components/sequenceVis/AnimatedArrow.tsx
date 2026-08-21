import { animated, useSpring } from '@react-spring/web';
import type { SpringValue } from '@react-spring/web';
import type { ComponentType } from 'react';

type AnimatedLineProps = {
  x1: SpringValue<number>;
  x2: SpringValue<number>;
  y1: SpringValue<number>;
  y2: SpringValue<number>;
};

const AnimatedLine = animated.line as unknown as ComponentType<AnimatedLineProps>;

export function AnimatedArrow({
  x1, x2, y1, y2, stroke = '#748ffc',
} : {x1: number, x2: number, y1: number, y2: number, stroke?: string}) {
  const spring = useSpring({
    x1, x2, y1, y2, config: { duration: 500 },
  });

  return (
    <g stroke={stroke} strokeWidth={1.5}>
      <AnimatedLine {...spring} />
    </g>
  );
}
