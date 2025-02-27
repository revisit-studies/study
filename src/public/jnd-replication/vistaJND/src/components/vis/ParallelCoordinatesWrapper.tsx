/**
 * Authors: The ReVISit team
 * Description:
 *    This file is the wrapper component for the Parallel Coordinate plots
 */

import { Group, Stack, Button } from '@mantine/core';
import { useMemo, useState } from 'react';
import ParallelCoordinates from './ParallelCoordinates';

/**
 * Holds 2 Parallel Coordinate Plots
 * @param param0 - r1 is the correlation value for 1, r2 is the correlation value for 2,
 * onClick is a function that determines the functionality when a graph is clicked.
 * @returns 2 Parallel Coordinate Plots
 */
export default function ParallelCoordinatesWrapper({
  r1, r2, shouldReRender = true, onClick, shouldRandomize = true,
}: {r1: number; r2: number, shouldReRender?: boolean, onClick: (n: number) => void, shouldRandomize?: boolean}) {
  const higherFirst = useMemo(() => (shouldRandomize ? Math.random() > 0.5 : true), [shouldRandomize]);

  const [key, setKey] = useState<number>(0);

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

  return higherFirst ? (
    <Group style={{ gap: '40px' }}>
      <Stack style={{ alignItems: 'center' }}>
        <ParallelCoordinates key={key} onClick={() => handleClick(1)} v={r1} />
        <Button onClick={() => handleClick(1)}>A</Button>
      </Stack>
      <Stack style={{ alignItems: 'center' }}>
        <ParallelCoordinates key={key + 1} onClick={() => handleClick(2)} v={r2} />
        <Button onClick={() => handleClick(2)}>B</Button>
      </Stack>
    </Group>
  ) : (
    <Group style={{ gap: '40px' }}>
      <Stack style={{ alignItems: 'center' }}>
        <ParallelCoordinates key={key} onClick={() => handleClick(2)} v={r2} />
        <Button onClick={() => handleClick(2)}>A</Button>
      </Stack>
      <Stack style={{ alignItems: 'center' }}>
        <ParallelCoordinates key={key + 1} onClick={() => handleClick(1)} v={r1} />
        <Button onClick={() => handleClick(1)}>B</Button>
      </Stack>
    </Group>
  );
}
