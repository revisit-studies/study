import { animated, useSpring } from 'react-spring';

export function AnimatedCircle({
  cx, cy, r, fill,
} : {cx: number, cy: number, r: number, fill: string}) {
  const [spring] = useSpring(() => ({
    cx, cy, r, fill, config: { duration: 1000 },
  }), [cx, cy, r, fill]);

  return <animated.circle {...spring} />;
}
