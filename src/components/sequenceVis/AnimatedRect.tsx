import { animated, useSpring } from 'react-spring';

export function AnimatedRect({
  x, y, fill, height, width,
} : {x: number, y: number, fill: string, height: number, width: number}) {
  const [spring] = useSpring(() => ({
    x, y, fill, height, width, config: { duration: 1000 },
  }), [x, y, fill, height, width]);

  return <animated.rect {...spring} />;
}
