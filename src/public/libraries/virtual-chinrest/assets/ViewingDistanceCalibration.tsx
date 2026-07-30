import {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import {
  Stack, List, Text, Container, Button,
} from '@mantine/core';
import {
  StimulusParams, StoredAnswer,
} from '../../../../store/types';
import { useStoreSelector } from '../../../../store/store';
import { useIsAnalysis } from '../../../../store/hooks/useIsAnalysis';
import { useStoredAnswer } from '../../../../store/hooks/useStoredAnswer';
import { parseTrialOrder } from '../../../../utils/parseTrialOrder';

// Utility functions
const degToRadians = (degrees: number) => (degrees * Math.PI) / 180;
const cardSizeComponent = '$virtual-chinrest.components.card-size';

function compareTrialOrders(left: string, right: string) {
  const leftOrder = parseTrialOrder(left);
  const rightOrder = parseTrialOrder(right);
  if (leftOrder.step === null || rightOrder.step === null) {
    return undefined;
  }

  return leftOrder.step - rightOrder.step
    || (leftOrder.funcIndex ?? -1) - (rightOrder.funcIndex ?? -1);
}

export function findPreviousCardSizeAnswer(
  answers: Record<string, StoredAnswer>,
  currentTrialOrder: StoredAnswer['trialOrder'] | undefined,
) {
  if (!currentTrialOrder || parseTrialOrder(currentTrialOrder).step === null) {
    return undefined;
  }

  return Object.values(answers)
    .filter((answer) => (
      answer.componentName === cardSizeComponent
      && (compareTrialOrders(answer.trialOrder, currentTrialOrder) ?? 0) < 0
    ))
    .sort((a, b) => compareTrialOrders(b.trialOrder, a.trialOrder) ?? 0)[0];
}

export default function ViewingDistanceCalibration({ parameters, setAnswer }: StimulusParams<{ blindspotAngle: number }>) {
  const ballRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { blindspotAngle } = parameters;
  const isAnalysis = useIsAnalysis();

  const ans = useStoreSelector((state) => state.answers);
  const currentAnswer = useStoredAnswer();
  const cardSizeAnswer = findPreviousCardSizeAnswer(ans, currentAnswer?.trialOrder);
  const pixelsPerMM = Number(cardSizeAnswer?.answer?.pixelsPerMM);
  const storedViewingDistance = Number(currentAnswer?.answer?.['dist-calibration-MM']);
  const storedBallPositions = useMemo(() => {
    const value = currentAnswer?.answer?.['ball-positions'];
    if (typeof value !== 'string') {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.every((position) => typeof position === 'number')
        ? parsed
        : [];
    } catch {
      return [];
    }
  }, [currentAnswer]);

  // States
  const [ballPositions, setBallPositions] = useState<number[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [viewingDistance, setViewingDistance] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [clickCount, setClickCount] = useState<number>(5);

  // Calculate viewing distance function
  const calculateViewingDistance = useCallback((positions: number[]) => {
    if (!positions.length || !pixelsPerMM || !squareRef.current) return;

    const avgBallPos = positions.reduce((a, b) => a + b, 0) / positions.length;
    const squareRect = squareRef.current.getBoundingClientRect();
    const squarePos = squareRect.left;
    const ballSquareDistance = Math.abs(avgBallPos - squarePos) / pixelsPerMM;
    const viewDistance = ballSquareDistance / Math.tan(degToRadians(blindspotAngle));

    setViewingDistance(viewDistance);
    setIsTracking(false);
  }, [blindspotAngle, pixelsPerMM]);

  // Reset ball to starting position
  const resetBall = () => {
    if (ballRef.current) {
      ballRef.current.style.left = '740px';
    }
  };

  // Animation control functions
  const startBlindspotTracking = useCallback(() => {
    if (!ballRef.current || !squareRef.current || !pixelsPerMM || ballPositions.length >= 5) return;
    setIsTracking(true);

    let isPaused = false;
    let pauseStartTime = 0;
    const PAUSE_DURATION = 1000; // 1 second pause

    const animateBall = (timestamp: number) => {
      if (!ballRef.current) return;

      if (isPaused) {
        if (timestamp - pauseStartTime >= PAUSE_DURATION) {
          isPaused = false;
          ballRef.current.style.left = '740px';
        }
        animationFrameRef.current = requestAnimationFrame(animateBall);
        return;
      }

      const currentLeft = parseInt(ballRef.current.style.left || '740', 10);
      const newLeft = currentLeft - 2; // Move left by decreasing left value

      // add looping effect
      if (newLeft <= 0) {
        isPaused = true;
        pauseStartTime = timestamp;
        // ballRef.current.style.left = '740px';
      } else {
        ballRef.current.style.left = `${newLeft}px`;
      }

      animationFrameRef.current = requestAnimationFrame(animateBall);
    };

    animationFrameRef.current = requestAnimationFrame(animateBall);
  }, [ballPositions, pixelsPerMM]);

  const stopTracking = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsTracking(false);
  };

  useEffect(() => {
    if (!isAnalysis && viewingDistance !== null && ballPositions.length === 5) {
      setAnswer({
        status: true,
        answers: {
          'dist-calibration-MM': viewingDistance,
          'dist-calibration-CM': viewingDistance / 10,
          'ball-positions': JSON.stringify(ballPositions),
          'square-position': squareRef.current?.getBoundingClientRect().left ?? 0,
        },
      });
    }
  }, [isAnalysis, viewingDistance, ballPositions, setAnswer]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (isAnalysis) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();

        if (!isTracking) {
          startBlindspotTracking();
        } else if (ballRef.current) {
          stopTracking();
          const ballRect = ballRef.current.getBoundingClientRect();
          const newPosition = ballRect.left;

          setBallPositions((prev) => {
            const newPositions = [...prev, newPosition];
            if (newPositions.length >= 5) {
              calculateViewingDistance(newPositions);
            }
            return newPositions;
          });

          setClickCount((prev) => prev - 1);
          resetBall();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAnalysis, isTracking, startBlindspotTracking, calculateViewingDistance]);

  // Reset state when pixelsPerMM changes
  useEffect(() => {
    setViewingDistance(null);
    setIsTracking(false);
    setBallPositions([]);
    setClickCount(5);
    resetBall();

    return () => {
      setViewingDistance(null);
      setIsTracking(false);
      setBallPositions([]);
      setClickCount(5);
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(storedViewingDistance) || storedViewingDistance <= 0) {
      return;
    }

    setBallPositions(storedBallPositions);
    setViewingDistance(storedViewingDistance);
    setIsTracking(false);
    setClickCount(Math.max(0, 5 - storedBallPositions.length));
  }, [storedBallPositions, storedViewingDistance]);

  // Cleanup animation frame on unmount
  useEffect(() => () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  // handle retake
  const handleRetake = () => {
    setBallPositions([]);
    setViewingDistance(null);
    setIsTracking(false);
    setClickCount(5);
    resetBall();
    // clear submitted answers
    setAnswer({
      status: false,
      answers: {},
    });
  };

  if (!pixelsPerMM) {
    return <div>Please complete card calibration first.</div>;
  }
  return (
    <Container size="md">
      <Stack gap="md">
        <Text>Now we will quickly measure how far away you are sitting. </Text>
        <Stack gap="xs">
          <List>
            <List.Item>
              Put your left hand on the&nbsp;
              <b>space bar</b>
              .
            </List.Item>
            <List.Item>Cover your right eye with your right hand.</List.Item>
            <List.Item>Using your left eye, focus on the black square. Keep your focus on the black square.</List.Item>
            <List.Item>
              The&nbsp;
              <span style={{ color: 'red', fontWeight: 'bold' }}>red ball</span>
              {' '}
              will disappear as it moves from right to left.
              Press the space bar as soon as the ball disappears.
            </List.Item>
          </List>
          <Text ta="center" fw={600}>
            {ballPositions.length >= 5
              ? 'All measurements completed!'
              : 'Press the space bar when you are ready to begin.'}
          </Text>
        </Stack>
        <div
          style={{
            position: 'relative',
            width: '900px',
            height: '100px',
            backgroundColor: '#ffffff',
          }}
        >
          <div
            ref={ballRef}
            style={{
              position: 'absolute',
              width: '30px',
              height: '30px',
              backgroundColor: 'rgb(255, 0, 0)',
              borderRadius: '30px',
              left: '740px',
            }}
          />
          <div
            ref={squareRef}
            style={{
              position: 'absolute',
              width: '30px',
              height: '30px',
              backgroundColor: 'rgb(0, 0, 0)',
              left: '870px',
            }}
          />
        </div>
        <Text ta="center">
          Remaining measurements:
          {' '}
          {5 - ballPositions.length}
        </Text>
        {
          ballPositions.length > 0 && (
            <>
              <Text ta="left"> Not happy with your measurements? You can restart by clicking &quot;Retake&quot;.</Text>
              <Button disabled={isAnalysis} size="md-compact" w="fit-content" color="indigo" onClick={handleRetake}>Retake</Button>
            </>
          )
        }
        {viewingDistance && (
        <Stack gap="xs">
          <Text fw={700} size="lg">Viewing Distance Results</Text>
          <Text>
            Estimated Viewing Distance:
            {' '}
            {(viewingDistance / 10).toFixed(1)}
            {' '}
            cm
          </Text>
        </Stack>
        )}
      </Stack>
    </Container>
  );
}
