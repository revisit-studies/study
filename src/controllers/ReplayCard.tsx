import {
  Card,
  Progress,
  Stack,
} from '@mantine/core';

import { animated, useSpring } from 'react-spring';
import { useDebouncedState, useResizeObserver } from '@mantine/hooks';
import { useCallback, useEffect, useState } from 'react';
import { AnalysisPopout } from '../components/audioAnalysis/AnalysisPopout';
// current active stimuli presented to the user
export default function ReplayCard() {
  const [faded, setFaded] = useDebouncedState(true, 100, { leading: true });
  const [insideVideoView, setInsideVideoView] = useState(false);

  const [styles] = useSpring(() => ({ opacity: faded && !insideVideoView ? 0 : 1 }), [faded, insideVideoView]);
  const [invertedStyles] = useSpring(() => ({ opacity: faded && !insideVideoView ? 1 : 0 }), [faded, insideVideoView]);

  const [percent, setPercent] = useState<number>(0);

  const [ref, { width }] = useResizeObserver();

  useEffect(() => {
    const mainDiv = document.getElementsByClassName('mantine-AppShell-main') as HTMLCollectionOf<HTMLDivElement>;
    if (mainDiv.length > 0) {
      mainDiv[0].addEventListener('mousemove', () => {
        setFaded(false);

        setTimeout(() => {
          if (!insideVideoView) {
            setFaded(true);
          }
        }, 2000);
      });
    }
  }, [insideVideoView, setFaded]);

  const _setPercent = useCallback((n: number) => {
    setPercent(n);
  }, []);

  return (
    <Stack ref={ref} style={{ width: '100%' }}>
      <animated.div style={styles}>
        <Card onMouseEnter={() => setInsideVideoView(true)} onMouseLeave={() => setInsideVideoView(false)} mx={10} style={{ bottom: '15px', position: 'absolute', width: width - 20 }} radius="xl" shadow="sm" withBorder>
          <AnalysisPopout setPercent={_setPercent} />
        </Card>
      </animated.div>
      <animated.div style={invertedStyles}>
        {faded ? <Progress value={percent} style={{ bottom: '10px', position: 'absolute', width: width - 20 }} /> : null}
      </animated.div>
    </Stack>
  );
}
