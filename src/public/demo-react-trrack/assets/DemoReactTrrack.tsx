import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  ActionIcon, Box, Stack, Text,
} from '@mantine/core';
import { initializeTrrack, Registry } from '@trrack/core';
import { StimulusParams } from '../../../store/types';

type RGBChannel = 'red' | 'green' | 'blue';

interface RGBState {
  red: number;
  green: number;
  blue: number;
  targetRed: number;
  targetGreen: number;
  targetBlue: number;
}

interface TargetColorParam {
  red?: number;
  green?: number;
  blue?: number;
}

const normalizeChannel = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(value)));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RGBColorMixTask({ parameters, setAnswer, provenanceState }: StimulusParams<any, RGBState>) {
  const { taskid } = parameters;
  const configTargetColor = parameters.targetColor as TargetColorParam | undefined;
  const [record, setRecord] = useState({ red: 0, green: 0, blue: 0 });
  const [targetColor, setTargetColor] = useState(() => {
    if (
      provenanceState?.targetRed !== undefined
      && provenanceState.targetGreen !== undefined
      && provenanceState.targetBlue !== undefined
    ) {
      return {
        red: provenanceState.targetRed,
        green: provenanceState.targetGreen,
        blue: provenanceState.targetBlue,
      };
    }
    return {
      red: normalizeChannel(configTargetColor?.red),
      green: normalizeChannel(configTargetColor?.green),
      blue: normalizeChannel(configTargetColor?.blue),
    };
  });

  useEffect(() => {
    if (provenanceState) {
      setRecord({
        red: provenanceState.red ?? 0,
        green: provenanceState.green ?? 0,
        blue: provenanceState.blue ?? 0,
      });
      if (
        provenanceState.targetRed !== undefined
        && provenanceState.targetGreen !== undefined
        && provenanceState.targetBlue !== undefined
      ) {
        setTargetColor({
          red: provenanceState.targetRed,
          green: provenanceState.targetGreen,
          blue: provenanceState.targetBlue,
        });
      } else {
        setTargetColor({
          red: normalizeChannel(configTargetColor?.red),
          green: normalizeChannel(configTargetColor?.green),
          blue: normalizeChannel(configTargetColor?.blue),
        });
      }
    } else {
      setTargetColor({
        red: normalizeChannel(configTargetColor?.red),
        green: normalizeChannel(configTargetColor?.green),
        blue: normalizeChannel(configTargetColor?.blue),
      });
    }
  }, [configTargetColor?.blue, configTargetColor?.green, configTargetColor?.red, provenanceState]);

  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const addColorAction = reg.register('addColor', (state, color: RGBChannel) => {
      state[color] += 1;
      return state;
    });

    const removeColorAction = reg.register('removeColor', (state, color: RGBChannel) => {
      state[color] = Math.max(0, state[color] - 1);
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        red: 0,
        green: 0,
        blue: 0,
        targetRed: targetColor.red,
        targetGreen: targetColor.green,
        targetBlue: targetColor.blue,
      },
    });

    return {
      actions: {
        addColorAction,
        removeColorAction,
      },
      trrack: trrackInst,
    };
  }, [targetColor.blue, targetColor.green, targetColor.red]);

  const mixedColor = useMemo(() => {
    const total = record.red + record.green + record.blue;
    if (total === 0) {
      return null;
    }
    return {
      red: Math.round((record.red / total) * 255),
      green: Math.round((record.green / total) * 255),
      blue: Math.round((record.blue / total) * 255),
    };
  }, [record.blue, record.green, record.red]);

  const updateAnswer = useCallback((nextRecord: { red: number, green: number, blue: number }) => {
    const total = nextRecord.red + nextRecord.green + nextRecord.blue;
    const normalized = total > 0
      ? {
        red: Math.round((nextRecord.red / total) * 255),
        green: Math.round((nextRecord.green / total) * 255),
        blue: Math.round((nextRecord.blue / total) * 255),
      }
      : null;
    setAnswer({
      status: total > 0,
      provenanceGraph: trrack.graph.backend,
      answers: {
        [taskid]: total > 0
          ? `record: R=${nextRecord.red}, G=${nextRecord.green}, B=${nextRecord.blue}; normalized: rgb(${normalized?.red}, ${normalized?.green}, ${normalized?.blue})`
          : 'No color selected',
      },
    });
  }, [setAnswer, taskid, trrack]);

  const changeColorCount = useCallback((color: RGBChannel, delta: 1 | -1) => {
    setRecord((prev) => {
      const next = {
        ...prev,
        [color]: Math.max(0, prev[color] + delta),
      };

      if (delta === 1) {
        trrack.apply(`Add ${color}`, actions.addColorAction(color));
      } else if (prev[color] > 0) {
        trrack.apply(`Remove ${color}`, actions.removeColorAction(color));
      }
      return next;
    });
  }, [actions, trrack]);

  useEffect(() => {
    updateAnswer(record);
  }, [record, updateAnswer]);

  return (
    <Stack gap="xl" style={{ maxWidth: 440, margin: '0 auto' }}>
      <Stack gap="sm" align="center">
        <Text fw={600}>Target color</Text>
        <Box
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            border: '2px solid #222',
            backgroundColor: `rgb(${targetColor.red}, ${targetColor.green}, ${targetColor.blue})`,
          }}
        />
      </Stack>

      <Stack gap="sm">
        <Text fw={600} style={{ textAlign: 'center' }}>Build your color record (add/remove RGB)</Text>
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
          }}
        >
          {(['red', 'green', 'blue'] as RGBChannel[]).map((color) => (
            <Stack key={color} gap="xs" align="center">
              <ActionIcon
                radius="xl"
                size={56}
                onClick={() => changeColorCount(color, 1)}
                style={{ backgroundColor: color, border: '2px solid #222' }}
                aria-label={`add-${color}`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  <line x1="5" y1="12" x2="19" y2="12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </ActionIcon>
              <ActionIcon
                radius="xl"
                size={36}
                onClick={() => changeColorCount(color, -1)}
                variant="outline"
                color="dark"
                aria-label={`remove-${color}`}
              >
                -
              </ActionIcon>
              <Text size="sm" fw={500}>
                {color.toUpperCase()}
                :
                {record[color]}
              </Text>
            </Stack>
          ))}
        </Box>
      </Stack>

      <Stack gap="sm" align="center">
        <Text fw={600}>Your normalized selected color</Text>
        <Box
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            border: '2px solid #222',
            backgroundColor: mixedColor
              ? `rgb(${mixedColor.red}, ${mixedColor.green}, ${mixedColor.blue})`
              : 'transparent',
          }}
        />
        <Text>
          {mixedColor
            ? `rgb(${mixedColor.red}, ${mixedColor.green}, ${mixedColor.blue})`
            : 'No color selected yet'}
        </Text>
      </Stack>
    </Stack>
  );
}

export default RGBColorMixTask;
