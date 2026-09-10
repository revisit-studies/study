import {
  Badge, Box, Group, Paper, Stack, Text,
} from '@mantine/core';
import { useMemo } from 'react';
import { StimulusParams } from '../../../store/types';

type Domain = 'viral' | 'stock';
type Guardrail = 'none' | 'super_data' | 'super_summ' | 'juxt_data' | 'juxt_summ';

interface ChartParameters {
  caption: string;
  domain: Domain;
  guardrail: Guardrail;
  initialSelection: string[];
  studyArm: string;
  target: string;
}

interface Point {
  x: number;
  y: number;
}

interface Series {
  name: string;
  points: Point[];
  selected: boolean;
}

const WIDTH = 760;
const HEIGHT = 390;
const MARGIN = {
  top: 18, right: 18, bottom: 42, left: 62,
};
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const COLORS = ['#1971c2', '#e8590c', '#2b8a3e', '#9c36b5', '#c92a2a', '#0c8599'];

const VIRAL_NAMES = [
  'Aerion North',
  'Aerion South',
  'Aerion West',
  'Eldoril East',
  'Eldoril North',
  'Eldoril South',
  'Eldoril West',
  'Silvoria North',
  'Silvoria South',
  'Mystara East',
  'Mystara North',
  'Mystara South',
  'Mystara West',
  'Thundoril North',
  'Thundoril South',
];

const STOCK_NAMES = [
  'Car A',
  'Car B',
  'Car C',
  'Airline A',
  'Airline B',
  'Airline C',
  'Gas A',
  'Gas B',
  'Gas C',
  'Tech A',
  'Tech B',
  'Tech C',
];

const GUARDRAIL_LABELS: Record<Guardrail, string> = {
  none: 'Selected data only',
  super_data: 'Superimposed data context',
  super_summ: 'Superimposed summary context',
  juxt_data: 'Juxtaposed data context',
  juxt_summ: 'Juxtaposed summary context',
};

function hashName(name: string) {
  return Array.from(name).reduce((total, character) => (
    (total * 31 + character.charCodeAt(0)) % 997
  ), 17);
}

function buildSeries(domain: Domain, selectedNames: string[]): Series[] {
  const names = domain === 'viral' ? VIRAL_NAMES : STOCK_NAMES;

  return names.map((name) => {
    const seed = hashName(name);
    const selected = selectedNames.includes(name);
    const points = Array.from({ length: 24 }, (_, x) => {
      const wave = Math.sin((x + (seed % 9)) / 3.4) * (domain === 'viral' ? 17 : 8);
      const secondaryWave = Math.cos((x + (seed % 5)) / 2.1) * 5;
      const trend = domain === 'viral' ? x * 0.8 : x * 1.25;
      const selectedShift = selected ? (domain === 'viral' ? -13 : 12) : 0;
      const base = domain === 'viral' ? 72 : 35;

      return {
        x,
        y: Math.max(2, base + wave + secondaryWave + trend + selectedShift + (seed % 13)),
      };
    });

    return { name, points, selected };
  });
}

function quantile(values: number[], proportion: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * proportion;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function linePoints(points: Point[], scaleY: (value: number) => number) {
  return points.map((point) => (
    `${MARGIN.left + (point.x / 23) * PLOT_WIDTH},${scaleY(point.y)}`
  )).join(' ');
}

function DataExplorer({ parameters }: StimulusParams<ChartParameters>) {
  const selectedNames = useMemo(
    () => parameters.initialSelection.filter(Boolean),
    [parameters.initialSelection],
  );
  const series = useMemo(
    () => buildSeries(parameters.domain, selectedNames),
    [parameters.domain, selectedNames],
  );
  const selectedSeries = series.filter((item) => item.selected);
  const allValues = series.flatMap((item) => item.points.map((point) => point.y));
  const yMin = Math.floor(Math.min(...allValues) / 10) * 10;
  const yMax = Math.ceil(Math.max(...allValues) / 10) * 10;
  const scaleY = (value: number) => (
    MARGIN.top + ((yMax - value) / (yMax - yMin)) * PLOT_HEIGHT
  );
  const summaryBand = Array.from({ length: 24 }, (_, x) => {
    const values = series.map((item) => item.points[x].y);
    return {
      x,
      lower: quantile(values, 0.25),
      upper: quantile(values, 0.75),
    };
  });
  const summaryPolygon = [
    ...summaryBand.map((point) => (
      `${MARGIN.left + (point.x / 23) * PLOT_WIDTH},${scaleY(point.upper)}`
    )),
    ...[...summaryBand].reverse().map((point) => (
      `${MARGIN.left + (point.x / 23) * PLOT_WIDTH},${scaleY(point.lower)}`
    )),
  ].join(' ');
  const endValues = series.map((item) => ({
    name: item.name,
    selected: item.selected,
    value: item.points[item.points.length - 1].y,
  })).sort((a, b) => b.value - a.value);
  const selectedEndValues = endValues.filter((item) => item.selected).map((item) => item.value);
  const yTicks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) * index) / 4);
  const showAllSeries = parameters.guardrail === 'super_data';
  const showSummaryBand = parameters.guardrail === 'super_summ';
  const showDataComparison = parameters.guardrail === 'juxt_data';
  const showSummaryComparison = parameters.guardrail === 'juxt_summ';
  const yLabel = parameters.domain === 'viral'
    ? 'Infections per million people'
    : 'Percent change in stock price';
  const captionText = `“${parameters.caption}”`;
  const selectedRange = `${Math.min(...selectedEndValues).toFixed(0)}–${Math.max(...selectedEndValues).toFixed(0)}`;
  const allEndValues = endValues.map((item) => item.value);
  const allDataRange = `${Math.min(...allEndValues).toFixed(0)}–${Math.max(...allEndValues).toFixed(0)}`;

  return (
    <Stack gap="md" maw={1040} mx="auto">
      <Group justify="space-between">
        <Text fw={600}>{yLabel}</Text>
        <Badge color="gray" variant="light">
          {GUARDRAIL_LABELS[parameters.guardrail]}
        </Badge>
      </Group>

      <Paper bg="gray.0" p="md" radius="md" withBorder>
        <Text component="p" fs="italic" m={0}>
          {captionText}
        </Text>
      </Paper>

      <Box style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        {showDataComparison ? (
          <Paper p="sm" radius="md" style={{ minWidth: 190 }} withBorder>
            <Text fw={600} mb="xs" size="sm">All series at period end</Text>
            <Stack gap={3}>
              {endValues.map((item) => (
                <Group gap="xs" justify="space-between" key={item.name} wrap="nowrap">
                  <Text c={item.selected ? 'blue.8' : 'dimmed'} fw={item.selected ? 600 : 400} size="xs">
                    {item.name}
                  </Text>
                  <Text ff="monospace" size="xs">{item.value.toFixed(0)}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        ) : null}

        <Paper p="xs" radius="md" style={{ flex: 1, overflowX: 'auto' }} withBorder>
          {showSummaryComparison ? (
            <Box bg="gray.1" mb="xs" p="xs" style={{ borderRadius: 6 }}>
              <Text size="xs">
                {`Selected end-value range: ${selectedRange} · All-data range: ${allDataRange}`}
              </Text>
            </Box>
          ) : null}

          <svg
            aria-label={`${parameters.target} line chart with ${GUARDRAIL_LABELS[parameters.guardrail]}`}
            height={HEIGHT}
            role="img"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width="100%"
          >
            {yTicks.map((tick) => {
              const y = scaleY(tick);
              return (
                <g key={tick}>
                  <line
                    stroke="#dee2e6"
                    x1={MARGIN.left}
                    x2={WIDTH - MARGIN.right}
                    y1={y}
                    y2={y}
                  />
                  <text fill="#495057" fontSize="11" textAnchor="end" x={MARGIN.left - 8} y={y + 4}>
                    {tick.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {showSummaryBand ? (
              <polygon fill="#adb5bd" opacity="0.45" points={summaryPolygon} />
            ) : null}

            {showAllSeries ? series.filter((item) => !item.selected).map((item) => (
              <polyline
                fill="none"
                key={item.name}
                opacity="0.42"
                points={linePoints(item.points, scaleY)}
                stroke="#868e96"
                strokeWidth="1.4"
              />
            )) : null}

            {selectedSeries.map((item, index) => (
              <polyline
                fill="none"
                key={item.name}
                points={linePoints(item.points, scaleY)}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth="2.7"
              />
            ))}

            <line
              stroke="#495057"
              x1={MARGIN.left}
              x2={MARGIN.left}
              y1={MARGIN.top}
              y2={HEIGHT - MARGIN.bottom}
            />
            <line
              stroke="#495057"
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={HEIGHT - MARGIN.bottom}
              y2={HEIGHT - MARGIN.bottom}
            />
            <text fill="#495057" fontSize="11" x={MARGIN.left} y={HEIGHT - 14}>Start</text>
            <text fill="#495057" fontSize="11" textAnchor="end" x={WIDTH - MARGIN.right} y={HEIGHT - 14}>End</text>
          </svg>

          <Group gap="md" justify="center" mt={-8}>
            {selectedSeries.map((item, index) => (
              <Group gap={5} key={item.name} wrap="nowrap">
                <Box bg={COLORS[index % COLORS.length]} h={3} w={18} />
                <Text size="xs">{item.name}</Text>
              </Group>
            ))}
          </Group>
        </Paper>
      </Box>
    </Stack>
  );
}

export default DataExplorer;
