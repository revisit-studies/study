import {
  Alert, Badge, Group, Stack, Text, Title,
} from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';
import { useMemo } from 'react';
import type { ComponentBlock, StudyConfig } from '../../parser/types';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { SequenceComponent } from './SequenceComponent';
import type { Arrows, TraversedSequence } from './types';

const WIDTH_INCREMENT_CIRCLE = 10;
const MARGIN_BETWEEN = 3;
const MIN_VISUALIZATION_WIDTH = 320;
const VISUALIZATION_HEIGHT = 1200;

function isComponentBlock(sequence: StudyConfig['sequence']): sequence is ComponentBlock {
  return sequence.order !== 'dynamic' && !('type' in sequence && sequence.type === 'factor');
}

export function isNonFactoredComponentSequence(
  sequence: StudyConfig['sequence'],
): sequence is ComponentBlock {
  if (!isComponentBlock(sequence)) {
    return false;
  }

  return sequence.components.every((component) => (
    typeof component === 'string' || isNonFactoredComponentSequence(component)
  ));
}

function findBlockWidth(sequence: ComponentBlock, maxWidth: number) {
  const blockCount = sequence.components.filter((component) => typeof component !== 'string').length;
  const circleCount = sequence.components.length - blockCount;

  if (blockCount === 0) {
    return maxWidth;
  }

  const spacingWidth = (circleCount * (WIDTH_INCREMENT_CIRCLE + MARGIN_BETWEEN))
    + (MARGIN_BETWEEN * blockCount);

  return Math.max(WIDTH_INCREMENT_CIRCLE, (maxWidth - spacingWidth) / blockCount);
}

function traverseSequenceRec(
  sequence: ComponentBlock,
  blocks: TraversedSequence[],
  arrows: Arrows[],
  depth: number,
  width: number,
  maxWidth: number,
  active: boolean,
  parentCenter: number,
  path: string,
) {
  const blockSize = findBlockWidth(sequence, maxWidth);
  let currentWidth = width;
  const hasOnlyComponents = sequence.components.every((component) => typeof component === 'string');

  sequence.components.forEach((component, index) => {
    const isActive = active && (!sequence.numSamples || sequence.numSamples > index);
    const componentPath = `${path}_${index}`;

    if (typeof component === 'string') {
      blocks.push({
        component,
        depth: hasOnlyComponents ? depth + (index / 4) : depth,
        start: hasOnlyComponents
          ? currentWidth + (maxWidth / 2) - (WIDTH_INCREMENT_CIRCLE / 2)
          : currentWidth,
        width: WIDTH_INCREMENT_CIRCLE,
        active: isActive,
        id: componentPath,
        order: index,
      });

      if (!hasOnlyComponents) {
        currentWidth += WIDTH_INCREMENT_CIRCLE + MARGIN_BETWEEN;
      }
      return;
    }

    if (!isComponentBlock(component)) {
      return;
    }

    const start = currentWidth - (WIDTH_INCREMENT_CIRCLE / 2);
    const center = start + (blockSize / 2);
    blocks.push({
      component,
      depth,
      start,
      width: blockSize,
      active: isActive,
      id: component.id || componentPath,
      order: index,
    });

    if (isActive && depth > 1) {
      arrows.push({ topDepth: depth - 1, x1: parentCenter, x2: center });
    }

    traverseSequenceRec(
      component,
      blocks,
      arrows,
      depth + 1,
      currentWidth,
      blockSize,
      isActive,
      center,
      componentPath,
    );
    currentWidth += blockSize + MARGIN_BETWEEN;
  });
}

export function getSequenceLayout(
  sequence: ComponentBlock,
  maxWidth: number,
): [TraversedSequence[], Arrows[]] {
  const blocks: TraversedSequence[] = [];
  const arrows: Arrows[] = [];
  const visualizationWidth = Math.max(maxWidth, MIN_VISUALIZATION_WIDTH);

  traverseSequenceRec(
    sequence,
    blocks,
    arrows,
    1,
    WIDTH_INCREMENT_CIRCLE,
    visualizationWidth,
    true,
    visualizationWidth / 2,
    'root',
  );

  return [blocks, arrows];
}

export function SequenceVis() {
  const { sequence } = useStudyConfig();
  const [ref, { width }] = useResizeObserver();
  const supportedSequence = isNonFactoredComponentSequence(sequence) ? sequence : null;
  const [blocks, arrows] = useMemo(
    () => (supportedSequence
      ? getSequenceLayout(supportedSequence, width - MARGIN_BETWEEN)
      : [[], []] as [TraversedSequence[], Arrows[]]),
    [supportedSequence, width],
  );

  return (
    <Stack ref={ref} h="100%" gap="md">
      <div>
        <Title order={2}>Sequence visualization</Title>
        <Text c="dimmed">
          Blocks show nested sequence rules; dots show study components in their configured order.
        </Text>
      </div>
      <Group gap="xs">
        <Badge color="blue">Included</Badge>
        <Badge color="gray">Not sampled</Badge>
      </Group>
      {!supportedSequence ? (
        <Alert color="yellow" title="Sequence type not supported yet">
          This first integration visualizes component-block sequences. Factor and dynamic blocks
          will be added in the next integration step.
        </Alert>
      ) : (
        <svg
          aria-label="Study sequence visualization"
          role="img"
          style={{
            height: VISUALIZATION_HEIGHT,
            width: Math.max(width, MIN_VISUALIZATION_WIDTH),
            fontFamily: 'var(--mantine-font-family)',
          }}
        >
          <SequenceComponent components={blocks} arrows={arrows} />
        </svg>
      )}
    </Stack>
  );
}
