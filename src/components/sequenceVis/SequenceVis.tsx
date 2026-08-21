import {
  ActionIcon, Badge, Box, Code, Divider, Group, Paper, SegmentedControl, Stack, Switch, Text, Title,
} from '@mantine/core';
import { useResizeObserver, useViewportSize } from '@mantine/hooks';
import { IconX } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { useStoreSelector } from '../../store/store';
import { SequenceComponent } from './SequenceComponent';
import {
  buildSequenceVisualization, layoutSequenceVisualization,
} from './sequenceVisModel';
import type {
  FactorExpressionDetail, SequenceVisNode, SequenceVisualizationMode,
} from './sequenceVisModel';

const FALLBACK_VIEWPORT_WIDTH = 800;
const FALLBACK_VIEWPORT_HEIGHT = 700;

function FactorExpressionBranch({ detail, depth = 0 }: {
  detail: FactorExpressionDetail;
  depth?: number;
}) {
  return (
    <Box
      bd={depth === 0 ? undefined : '1px solid var(--mantine-color-gray-3)'}
      ml={depth === 0 ? 0 : 6}
      mt={depth === 0 ? 0 : 3}
      p={depth === 0 ? 0 : 4}
    >
      <Group gap={4} wrap="wrap">
        <Text fw={600} size="xs">{detail.label}</Text>
        {detail.action ? <Badge color="violet" size="xs">{detail.action}</Badge> : null}
        <Text c="dimmed" size="xs">{detail.summary}</Text>
      </Group>
      {detail.children.map((child, index) => (
        <FactorExpressionBranch
          key={`${detail.label}-${child.label}-${index}`}
          detail={child}
          depth={depth + 1}
        />
      ))}
    </Box>
  );
}

function FactorDetails({ node, onClose }: { node: SequenceVisNode, onClose: () => void }) {
  const metadata = node.factorMetadata;
  return (
    <Paper shadow="md" withBorder p="xs">
      <Stack gap={5}>
        <div>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700} size="sm">{node.label}</Text>
              <Text c="dimmed" size="xs">{node.path}</Text>
            </div>
            <Group gap={3}>
              <Badge color="violet" size="xs">Factor</Badge>
              <ActionIcon aria-label="Close factor details" onClick={onClose} size="xs" variant="subtle">
                <IconX size={12} />
              </ActionIcon>
            </Group>
          </Group>
        </div>
        <Group gap={3}>
          <Badge size="xs" variant="light">{`${node.totalConditions ?? 0} candidates`}</Badge>
          {node.selectedConditions !== undefined ? (
            <Badge color="blue" size="xs" variant="light">{`${node.selectedConditions} selected`}</Badge>
          ) : null}
          {metadata?.numSamples !== undefined ? (
            <Badge color="grape" size="xs" variant="light">{`sample ${metadata.numSamples}`}</Badge>
          ) : null}
          {metadata?.hasRuntimeOrder ? <Badge color="orange" size="xs" variant="light">runtime order</Badge> : null}
          {metadata?.hasRuntimeSample ? <Badge color="orange" size="xs" variant="light">runtime sample</Badge> : null}
        </Group>
        {metadata ? (
          <Group gap={4}>
            <Text size="xs">
              {`Base component${metadata.baseComponents.length === 1 ? '' : 's'}:`}
            </Text>
            <Code fz="xs">{metadata.baseComponents.join(', ')}</Code>
          </Group>
        ) : null}
        {node.factorDetails ? (
          <>
            <Divider label="Expression" labelPosition="left" />
            <FactorExpressionBranch detail={node.factorDetails} />
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}

function BetweenSubjectsAssignment({
  factors, parameters,
}: {
  factors: string[];
  parameters?: Record<string, unknown>;
}) {
  return (
    <Paper bg="violet.0" p={4} withBorder>
      <Group gap={4} wrap="nowrap">
        <Text fw={600} size="xs">Between subjects:</Text>
        {factors.map((factor) => <Badge key={factor} size="xs" variant="light">{factor}</Badge>)}
        <Text c="dimmed" lineClamp={1} size="xs">
          {parameters && Object.keys(parameters).length > 0
            ? JSON.stringify(parameters)
            : 'not assigned'}
        </Text>
      </Group>
    </Paper>
  );
}

export function SequenceVis() {
  const config = useStudyConfig();
  const participantSequence = useStoreSelector((state) => state.sequence);
  const [mode, setMode] = useState<SequenceVisualizationMode>('design');
  const [expandedFactors, setExpandedFactors] = useState(false);
  const [selectedFactorKey, setSelectedFactorKey] = useState<string>();
  const [ref, { width }] = useResizeObserver();
  const viewport = useViewportSize();
  const root = useMemo(() => buildSequenceVisualization(
    config.sequence,
    participantSequence,
    config.factors ?? {},
    mode,
    expandedFactors,
  ), [config.factors, config.sequence, expandedFactors, mode, participantSequence]);
  const layout = useMemo(() => layoutSequenceVisualization(
    root,
    0,
  ), [root]);
  const availableWidth = width || viewport.width || FALLBACK_VIEWPORT_WIDTH;
  const viewportHeight = viewport.height || FALLBACK_VIEWPORT_HEIGHT;
  const controlsHeight = config.betweenSubjects?.length ? 270 : 240;
  const maximumCanvasHeight = Math.max(140, viewportHeight - controlsHeight);
  const aspectFitHeight = layout.height * (availableWidth / layout.width);
  const canvasHeight = Math.max(100, Math.min(maximumCanvasHeight, aspectFitHeight));
  const selectedFactor = layout.nodes.find((node) => (
    node.kind === 'factor' && node.key === selectedFactorKey
  ));
  const handleSelectNode = (node: SequenceVisNode) => {
    if (node.kind === 'factor') {
      setSelectedFactorKey(node.key);
    }
  };

  return (
    <Stack ref={ref} h="100%" gap={5}>
      <Group gap="xs" justify="space-between">
        <Group gap="xs">
          <Title order={3}>Sequence</Title>
          <Text c="dimmed" size="xs">Select a purple factor for details.</Text>
        </Group>
        <Group gap={5}>
          <SegmentedControl
            aria-label="Sequence visualization view"
            data={[
              { label: 'Design', value: 'design' },
              { label: 'Participant', value: 'participant' },
            ]}
            onChange={(value) => setMode(value as SequenceVisualizationMode)}
            size="xs"
            value={mode}
          />
          <Switch
            checked={expandedFactors}
            label="Expand factors"
            onChange={(event) => setExpandedFactors(event.currentTarget.checked)}
            size="xs"
          />
        </Group>
      </Group>
      {config.betweenSubjects && config.betweenSubjects.length > 0 ? (
        <BetweenSubjectsAssignment
          factors={config.betweenSubjects}
          parameters={participantSequence.parameters}
        />
      ) : null}
      <Group gap={3}>
        <Badge color="indigo" size="xs">Block</Badge>
        <Badge color="violet" size="xs">Factor</Badge>
        <Badge color="blue" size="xs">Included</Badge>
        <Badge color="gray" size="xs">Excluded</Badge>
        <Badge color="yellow" size="xs">Dynamic</Badge>
      </Group>
      <Paper
        pos="relative"
        style={{ height: canvasHeight, minWidth: 0, overflow: 'hidden' }}
        withBorder
      >
        <svg
          aria-label={`${mode === 'design' ? 'Study design' : 'Participant'} sequence visualization`}
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          style={{ display: 'block', fontFamily: 'var(--mantine-font-family)', width: '100%' }}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          <SequenceComponent
            edges={layout.edges}
            nodes={layout.nodes}
            onSelectNode={handleSelectNode}
            selectedNodeKey={selectedFactorKey}
          />
        </svg>
        {selectedFactor ? (
          <Box
            pos="absolute"
            right={5}
            style={{ maxHeight: Math.max(130, canvasHeight - 10), overflow: 'hidden', width: 'min(310px, calc(100% - 10px))' }}
            top={5}
          >
            <FactorDetails node={selectedFactor} onClose={() => setSelectedFactorKey(undefined)} />
          </Box>
        ) : null}
      </Paper>
    </Stack>
  );
}
