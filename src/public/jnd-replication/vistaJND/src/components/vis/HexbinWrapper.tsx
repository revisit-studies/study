/**
 * Authors: The ReVISit team
 * Description:
 *    This file is the wrapper component for the Scatter plots
 */

import { Group, Stack, Button } from '@mantine/core';
import { useMemo, useState } from 'react';
import HexbinPlots from './HexbinPlots';

/**
 * Holds 2 Scatter Plots
 * @param param0 - r1 is the correlation value for 1, r2 is the correlation value for 2,
 * onClick is a function that determines the functionality when a graph is clicked.
 * @returns 2 Scatter Plots
 */
export default function HexbinWrapper({
  r1, r2, shouldReRender = true, onClick,
}: {r1: number; r2: number, shouldReRender?: boolean, onClick: (n: number, higherFirst?: boolean) => void}) {
  const higherFirst = useMemo(() => Math.random() > 0.5, []);

  const [key, setKey] = useState<number>(0);

  const handleReset = () => {
    // Increment key to trigger re-render
    if (shouldReRender) {
      setKey((prevKey) => prevKey + 1);
    }
  };

  const handleClick = (n: number) => {
    onClick(n, higherFirst);
    handleReset();
  };

  return higherFirst ? (
    <Group style={{ gap: '40px' }}>
      <Stack style={{ alignItems: 'center' }}>
        <HexbinPlots key={key} onClick={() => handleClick(1)} r={r1} />
        <Button onClick={() => handleClick(1)}>Left</Button>
      </Stack>
      <Stack style={{ alignItems: 'center' }}>
        <HexbinPlots key={key + 1} onClick={() => handleClick(2)} r={r2} />
        <Button onClick={() => handleClick(2)}>Right</Button>
      </Stack>
    </Group>
  ) : (
    <Group style={{ gap: '40px' }}>
      <Stack style={{ alignItems: 'center' }}>
        <HexbinPlots key={key} onClick={() => handleClick(2)} r={r2} />
        <Button onClick={() => handleClick(2)}>Left</Button>
      </Stack>
      <Stack style={{ alignItems: 'center' }}>
        <HexbinPlots key={key + 1} onClick={() => handleClick(1)} r={r1} />
        <Button onClick={() => handleClick(1)}>Right</Button>
      </Stack>
    </Group>
  );
}
