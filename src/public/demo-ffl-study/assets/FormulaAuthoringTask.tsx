import {
  Alert, Badge, Box, Button, Code, Group, List, Paper, Stack, Text, Textarea, Title,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { StimulusParams } from '../../../store/types';

type InterfaceName = 'FFL' | 'LaTeX';
type TaskKind = 'creation' | 'editing' | 'exploratory';

interface FormulaAuthoringTaskParameters {
  taskCode: string;
  interfaceName: InterfaceName;
  taskKind: TaskKind;
  formula: string;
  startingMarkup?: string;
  requirements?: string[];
  timeLimitSeconds?: number;
}

const FFL_EXAMPLE = '$y$ { color: crimson; }';
const LATEX_COLOR_EXAMPLE = '\\textcolor{crimson}{y}';
const LATEX_LABEL_EXAMPLE = '\\overbrace{…}^{\\text{label}}';

function getColors(markup: string, interfaceName: InterfaceName): string[] {
  const expression = interfaceName === 'FFL'
    ? /color\s*:\s*([a-zA-Z]+)/g
    : /\\textcolor\{([a-zA-Z]+)\}/g;
  return [...markup.matchAll(expression)].map((match) => match[1]);
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function getDefaultMarkup(interfaceName: InterfaceName, taskKind: TaskKind) {
  if (taskKind !== 'editing') {
    return interfaceName === 'LaTeX' ? '% Write your LaTeX augmentation here' : '';
  }
  return interfaceName === 'FFL'
    ? '$y$ { color: red; }\n$\\beta_*$ { color: blue; label: coefficient; }'
    : '\\textcolor{red}{y} = \\overbrace{\\beta_1x_1}^{\\text{coefficient}} + \\beta_2x_2';
}

function getDefaultRequirements(taskKind: TaskKind) {
  if (taskKind === 'editing') {
    return [
      'Modify four aspects of the existing augmentation.',
      'Update colors and labels to match the target.',
      'Keep the existing formula content intact.',
    ];
  }
  if (taskKind === 'exploratory') {
    return [
      'Use FFL to make the formula easier for a new reader to understand.',
      'Explore colors and labels freely.',
    ];
  }
  return [
    'Create an augmented formula matching the target.',
    'Add three colors: target, slope terms, and features.',
    'Add three extent labels above or below the formula.',
  ];
}

export default function FormulaAuthoringTask({
  parameters,
  setAnswer,
}: StimulusParams<FormulaAuthoringTaskParameters>) {
  const timeLimitSeconds = parameters.timeLimitSeconds ?? 390;
  const requirements = parameters.requirements ?? getDefaultRequirements(parameters.taskKind);
  const [markup, setMarkup] = useState(
    parameters.startingMarkup ?? getDefaultMarkup(parameters.interfaceName, parameters.taskKind),
  );
  const [secondsRemaining, setSecondsRemaining] = useState(timeLimitSeconds);
  const [completed, setCompleted] = useState(false);
  const colors = useMemo(
    () => getColors(markup, parameters.interfaceName),
    [markup, parameters.interfaceName],
  );

  useEffect(() => {
    if (completed || secondsRemaining === 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [completed, secondsRemaining]);

  const completeTask = () => {
    const elapsedSeconds = timeLimitSeconds - secondsRemaining;
    setCompleted(true);
    setAnswer({
      status: true,
      answers: {
        taskCode: parameters.taskCode,
        interfaceName: parameters.interfaceName,
        taskKind: parameters.taskKind,
        markup,
        elapsedSeconds,
        timedOut: secondsRemaining === 0,
      },
    });
  };

  return (
    <Stack gap="md" maw={960} mx="auto">
      <Group justify="space-between">
        <Group gap="xs">
          <Badge variant="light">{parameters.taskCode}</Badge>
          <Badge color={parameters.interfaceName === 'FFL' ? 'violet' : 'blue'}>
            {parameters.interfaceName}
          </Badge>
          <Badge color={parameters.taskKind === 'editing' ? 'orange' : 'teal'}>
            {parameters.taskKind}
          </Badge>
        </Group>
        <Text fw={700} c={secondsRemaining === 0 ? 'red' : undefined}>
          {`Time remaining: ${formatTime(secondsRemaining)}`}
        </Text>
      </Group>

      <Alert color="gray" title="Task requirements">
        <List size="sm">
          {requirements.map((requirement) => (
            <List.Item key={requirement}>{requirement}</List.Item>
          ))}
        </List>
      </Alert>

      <Group align="stretch" grow>
        <Paper withBorder p="md">
          <Title order={4} mb="xs">Formula preview</Title>
          <Box
            p="xl"
            style={{
              minHeight: 180,
              display: 'grid',
              placeItems: 'center',
              background: '#fafafa',
              borderRadius: 4,
            }}
          >
            <Text ff="serif" fz="2rem" ta="center">
              <span style={{ color: colors[0] || 'inherit' }}>y</span>
              {' = '}
              <span style={{ color: colors[1] || 'inherit' }}>β₀ + β₁</span>
              <span style={{ color: colors[2] || 'inherit' }}>x₁ + β₂x₂ + ⋯ + βₘxₘ</span>
            </Text>
            <Text size="xs" c="dimmed" mt="lg" ta="center">
              Lightweight live preview for this study demo. Colors detected in your markup update here.
            </Text>
          </Box>
        </Paper>

        <Paper withBorder p="md">
          <Title order={4} mb="xs">{`${parameters.interfaceName} markup`}</Title>
          <Textarea
            aria-label={`${parameters.interfaceName} markup editor`}
            autosize
            minRows={10}
            value={markup}
            onChange={(event) => setMarkup(event.currentTarget.value)}
            styles={{ input: { fontFamily: 'monospace', fontSize: 14 } }}
            disabled={completed}
          />
        </Paper>
      </Group>

      {parameters.interfaceName === 'FFL' ? (
        <Alert color="violet" title="FFL reminder">
          <Code>{FFL_EXAMPLE}</Code>
          <Text component="span"> applies a color rule. Add </Text>
          <Code>label: target;</Code>
          <Text component="span"> to create an extent label.</Text>
        </Alert>
      ) : (
        <Alert color="blue" title="LaTeX reminder">
          <Text component="span">Use </Text>
          <Code>{LATEX_COLOR_EXAMPLE}</Code>
          <Text component="span"> for color and </Text>
          <Code>{LATEX_LABEL_EXAMPLE}</Code>
          <Text component="span"> for an extent label.</Text>
        </Alert>
      )}

      <Button onClick={completeTask} disabled={completed}>
        {completed ? 'Task recorded' : secondsRemaining === 0 ? 'Record timed-out task' : 'Mark task complete'}
      </Button>
    </Stack>
  );
}
