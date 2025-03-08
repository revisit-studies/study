/**
 * Authors: The ReVISit team
 * Description:
 *    This file is the wrapper component for the Parallel Coordinate plots
 */

import { Group, Stack, Button } from '@mantine/core';
import {
  useMemo, useState, useEffect, useRef,
} from 'react';
import ParallelCoordinates from './ParallelCoordinates';

function hashSeed(r1: number, r2: number) {
  return Math.abs(Math.sin(r1 * 1000 + r2 * 1000)) % 1;
}

/**
 * Holds 2 Parallel Coordinate Plots
 * @param param0 - r1 is the correlation value for 1, r2 is the correlation value for 2,
 * onClick is a function that determines the functionality when a graph is clicked.
 * @returns 2 Parallel Coordinate Plots
 */
export default function ParallelCoordinatesWrapper({
  r1, r2, shouldReRender = true, onClick, shouldRandomize = true, shouldNegate = false,
}: {r1: number; r2: number, shouldReRender?: boolean, onClick: (n: number) => void, shouldRandomize?: boolean, shouldNegate?: boolean}) {
  const higherFirst = useMemo(
    () => (shouldRandomize ? hashSeed(r1, r2) > 0.5 : true),
    [shouldRandomize, r1, r2],
  );

  const [key, setKey] = useState<number>(0);
  const buttonARef = useRef<HTMLButtonElement | null>(null);
  const buttonBRef = useRef<HTMLButtonElement | null>(null);

  const handleReset = () => {
    // Increment key to trigger re-render
    if (shouldReRender) {
      setKey((prevKey) => prevKey + 1);
    }
  };

  const handleClick = (n: number) => {
    onClick(n);
    handleReset();
  };

  // Keybinding for left (A) and right (B)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && buttonARef.current) {
        buttonARef.current.click();
      } else if (event.key === 'ArrowRight' && buttonBRef.current) {
        buttonBRef.current.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return higherFirst ? (
    <Group style={{ gap: '40px' }}>
      <Stack style={{ alignItems: 'center' }}>
        <ParallelCoordinates key={key} onClick={() => handleClick(1)} v={r1} shouldNegate={shouldNegate} />
        <Button ref={buttonARef} style={{ marginLeft: '-30px' }} onClick={() => handleClick(1)}>A</Button>
      </Stack>
      <Stack style={{ alignItems: 'center' }}>
        <ParallelCoordinates key={key + 1} onClick={() => handleClick(2)} v={r2} shouldNegate={shouldNegate} />
        <Button ref={buttonBRef} style={{ marginLeft: '-30px' }} onClick={() => handleClick(2)}>B</Button>
      </Stack>
    </Group>
  ) : (
    <Group style={{ gap: '40px' }}>
      <Stack style={{ alignItems: 'center' }}>
        <ParallelCoordinates key={key} onClick={() => handleClick(2)} v={r2} shouldNegate={shouldNegate} />
        <Button ref={buttonARef} style={{ marginLeft: '-30px' }} onClick={() => handleClick(2)}>A</Button>
      </Stack>
      <Stack style={{ alignItems: 'center' }}>
        <ParallelCoordinates key={key + 1} onClick={() => handleClick(1)} v={r1} shouldNegate={shouldNegate} />
        <Button ref={buttonBRef} style={{ marginLeft: '-30px' }} onClick={() => handleClick(1)}>B</Button>
      </Stack>
    </Group>
  );
}
