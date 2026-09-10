import { Button, Center, Group, Stack, Text } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import CorrelationPlot from './CorrelationPlot';

export default function Comparison({
  datasetA,
  datasetB,
  onResponse,
  progress,
  showCorrelations = false,
  title,
  valueA,
  valueB,
  vis,
}: {
  datasetA: string;
  datasetB: string;
  onResponse: (response: 1 | 2, correct: boolean) => void;
  progress?: string;
  showCorrelations?: boolean;
  title: string;
  valueA: number;
  valueB: number;
  vis: 'pcp' | 'scatter';
}) {
  const [response, setResponse] = useState<1 | 2 | null>(null);
  const buttonARef = useRef<HTMLButtonElement>(null);
  const buttonBRef = useRef<HTMLButtonElement>(null);

  const select = (selection: 1 | 2) => {
    if (response !== null) return;
    const correct = selection === (valueA > valueB ? 1 : 2);
    setResponse(selection);
    onResponse(selection, correct);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') buttonARef.current?.click();
      if (event.key === 'ArrowRight') buttonBRef.current?.click();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const correct = response === (valueA > valueB ? 1 : 2);

  return (
    <Stack h="100%" w="100%">
      <h3 className="trialHeader">{title}</h3>
      {progress && <Text className="score">{progress}</Text>}
      <Text>
        <span className="questionPrompt">Please select the visualization that appears to have a larger correlation.</span>
        <span className="requiredQuestion">*</span>
        <br />
        <span className="questionSecondaryText">Click A or B, or use the left and right arrow keys.</span>
      </Text>
      <Center>
        <Group gap={80}>
          <Stack align="center">
            <CorrelationPlot datasetName={datasetA} onClick={() => select(1)} type={vis} />
            <Button disabled={response === 2} onClick={() => select(1)} ref={buttonARef}>A</Button>
          </Stack>
          <Stack align="center">
            <CorrelationPlot datasetName={datasetB} onClick={() => select(2)} type={vis} />
            <Button disabled={response === 1} onClick={() => select(2)} ref={buttonBRef}>B</Button>
          </Stack>
        </Group>
      </Center>
      {response !== null && (
        <Text c={correct ? 'green' : 'red'} fw="bold" ta="center">
          {correct ? 'Correct' : 'Incorrect'}
          {showCorrelations && ` — A is ${valueA}, B is ${valueB}`}
        </Text>
      )}
    </Stack>
  );
}
