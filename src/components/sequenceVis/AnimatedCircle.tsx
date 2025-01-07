import { animated, useSpring, easings } from 'react-spring';

export function AnimatedCircle({
  cx, cy, r, fill, id,
} : {cx: number, cy: number, r: number, fill: string, id: string}) {
  const [spring] = useSpring(() => ({
    cx, cy, r, fill, id, config: { duration: 1000, easing: easings.easeInOutCirc },
  }), [cx, cy, r, fill]);

  return <animated.circle {...spring} />;
}
