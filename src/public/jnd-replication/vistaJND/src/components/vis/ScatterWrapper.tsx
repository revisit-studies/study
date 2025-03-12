/**
 * Authors: The ReVISit team
 * Description:
 *    This file is the wrapper component for the Scatter plots
 */

import { Group, Stack, Button } from '@mantine/core';
import {
  useState, useEffect, useRef,
} from 'react';
import ScatterPlots from './ScatterPlots';

/**
 * Holds 2 Scatter Plots
 * @param param0 - r1 is the correlation value for 1, r2 is the correlation value for 2,
 * onClick is a function that determines the functionality when a graph is clicked.
 * @returns 2 Scatter Plots
 */
export default function ScatterWrapper({
  r1, r2, shouldReRender = true, onClick, shouldNegate = false, higherFirst = true,
}: {r1: number; r2: number, shouldReRender?: boolean, onClick: (n: number) => void, shouldNegate?: boolean, higherFirst?: boolean}) {
  const [key, setKey] = useState<number>(0);
  const buttonARef = useRef<HTMLButtonElement | null>(null);
  const buttonBRef = useRef<HTMLButtonElement | null>(null);

  const handleReset = () => {
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
        <ScatterPlots key={key} onClick={() => handleClick(1)} r={r1} shouldNegate={shouldNegate} />
        <Button ref={buttonARef} style={{ marginLeft: '-30px' }} onClick={() => handleClick(1)}>A</Button>
      </Stack>
      <Stack style={{ alignItems: 'center' }}>
        <ScatterPlots key={key + 1} onClick={() => handleClick(2)} r={r2} shouldNegate={shouldNegate} />
        <Button ref={buttonBRef} style={{ marginLeft: '-30px' }} onClick={() => handleClick(2)}>B</Button>
      </Stack>
    </Group>
  ) : (
    <Group style={{ gap: '40px' }}>
      <Stack style={{ alignItems: 'center' }}>
        <ScatterPlots key={key} onClick={() => handleClick(2)} r={r2} shouldNegate={shouldNegate} />
        <Button ref={buttonARef} style={{ marginLeft: '-30px' }} onClick={() => handleClick(2)}>A</Button>
      </Stack>
      <Stack style={{ alignItems: 'center' }}>
        <ScatterPlots key={key + 1} onClick={() => handleClick(1)} r={r1} shouldNegate={shouldNegate} />
        <Button ref={buttonBRef} style={{ marginLeft: '-30px' }} onClick={() => handleClick(1)}>B</Button>
      </Stack>
    </Group>
  );
}
