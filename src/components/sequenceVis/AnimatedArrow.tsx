import { animated, useSpring } from 'react-spring';

export function AnimatedArrow({
  x1, x2, y1, y2,
} : {x1: number, x2: number, y1: number, y2: number}) {
  const [spring] = useSpring(() => ({
    x1, x2, y1, y2, config: { duration: 500 },
  }), [x1, x2, y1, y2]);

  return <animated.line {...spring} stroke="cornflowerblue" />;
}
