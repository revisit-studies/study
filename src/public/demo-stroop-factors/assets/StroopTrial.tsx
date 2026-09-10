import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Button, Center, Group, Stack, Text,
} from '@mantine/core';
import { useEvent } from '../../../store/hooks/useEvent';
import { useNextStep } from '../../../store/hooks/useNextStep';
import { StimulusParams } from '../../../store/types';

const COLOR_NAMES = [
  'RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE',
  'PURPLE', 'PINK', 'BROWN', 'GRAY', 'BLACK',
] as const;

type ColorName = typeof COLOR_NAMES[number];

interface StroopTrialParameters {
  word: ColorName;
  inkColor: ColorName;
}

const COLOR_VALUES: Record<ColorName, string> = {
  RED: '#c92a2a',
  ORANGE: '#e8590c',
  YELLOW: '#e67700',
  GREEN: '#2b8a3e',
  BLUE: '#1971c2',
  PURPLE: '#7b2cbf',
  PINK: '#d6336c',
  BROWN: '#8b5e3c',
  GRAY: '#6c757d',
  BLACK: '#212529',
};

const KEY_TO_COLOR: Record<string, ColorName> = {
  1: 'RED',
  2: 'ORANGE',
  3: 'YELLOW',
  4: 'GREEN',
  5: 'BLUE',
  6: 'PURPLE',
  7: 'PINK',
  8: 'BROWN',
  9: 'GRAY',
  0: 'BLACK',
};

function StroopTrial({
  parameters,
  setAnswer,
}: StimulusParams<StroopTrialParameters>) {
  const { word, inkColor } = parameters;
  const { goToNextStep } = useNextStep();
  const advanceToNextStep = useEvent(() => goToNextStep());
  const trialStartedAt = useRef(Date.now());
  const advanceTimer = useRef<number | undefined>(undefined);
  const responded = useRef(false);
  const [selectedColor, setSelectedColor] = useState<ColorName | null>(null);

  const respond = useCallback((response: ColorName) => {
    if (responded.current) {
      return;
    }

    responded.current = true;
    const correct = response === inkColor;
    setSelectedColor(response);
    setAnswer({
      status: true,
      answers: {
        response,
        correct,
        congruent: word === inkColor,
        reactionTimeMs: Date.now() - trialStartedAt.current,
      },
    });
    advanceTimer.current = window.setTimeout(advanceToNextStep, 300);
  }, [advanceToNextStep, inkColor, setAnswer, word]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const response = KEY_TO_COLOR[event.key.toLowerCase()];
      if (response) {
        event.preventDefault();
        respond(response);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [respond]);

  useEffect(() => () => {
    if (advanceTimer.current !== undefined) {
      window.clearTimeout(advanceTimer.current);
    }
  }, []);

  return (
    <Stack align="center" gap="xl">
      <Center mih={180}>
        <Text
          data-ink-color={inkColor}
          data-stroop-condition={`${word}-${inkColor}`}
          fw={800}
          size="4rem"
          style={{ color: COLOR_VALUES[inkColor], letterSpacing: '0.08em' }}
        >
          {word}
        </Text>
      </Center>
      <Group justify="center">
        {COLOR_NAMES.map((color, index) => (
          <Button
            color="gray"
            disabled={selectedColor !== null}
            key={color}
            onClick={() => respond(color)}
            variant="light"
          >
            {`${index === 9 ? 0 : index + 1}. ${color}`}
          </Button>
        ))}
      </Group>
      <Text c="dimmed" size="sm">
        {selectedColor ? 'Response recorded' : 'Keyboard shortcuts: 1–9 and 0'}
      </Text>
    </Stack>
  );
}

export default StroopTrial;
