import { Stack } from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import seedrandom from 'seedrandom';
import * as d3 from 'd3';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { SequenceComponent } from './SequenceComponent';
import { ComponentBlock } from '../../parser/types';
import { Arrows, TraversedSequence } from './types';
import { useEvent } from '../../store/hooks/useEvent';
import { deepCopy } from '../../utils/deepCopy';

const WIDTH_INCREMENT_CIRCLE = 10;
const MARGIN_BETWEEN = 3;

function findBlockWidth(sequence: ComponentBlock, maxWidth: number) {
  const blockCount = sequence.components.filter((seq) => typeof seq !== 'string').length;
  const circleCount = sequence.components.length - blockCount;

  return (maxWidth - (circleCount * (WIDTH_INCREMENT_CIRCLE + MARGIN_BETWEEN)) - (MARGIN_BETWEEN * blockCount)) / blockCount;
}

function findMaxDepth(seq: ComponentBlock, depth: number) : number {
  let newDepth = depth;

  seq.components.forEach((comp) => {
    if (typeof comp !== 'string') {
      const testDepth = findMaxDepth(comp, depth + 1);
      if (testDepth > newDepth) {
        newDepth = testDepth;
      }
    }
  });

  return newDepth;
}

function traverseSequenceRec(sequence: ComponentBlock, blocks: TraversedSequence[], arrows: Arrows[], seeds: number[], depth: number, width: number, maxWidth: number, active: boolean, parentCenter: number, path: string) {
  const blockSize = findBlockWidth(sequence, maxWidth);

  const randomizer = seedrandom(`${seeds[depth]}`);
  const moveRandomizer = seedrandom(`${seeds[depth]}`);
  const copyRandomizer = seedrandom(`${seeds[depth]}`);

  const usedComponents = deepCopy(sequence.components);
  const originalIndices = d3.range(sequence.components.length);

  let activeNumbers: number[] = [];

  if (sequence.numSamples) {
    activeNumbers = sequence.components.map((s, i) => i).sort(() => randomizer() - randomizer()).slice(0, sequence.numSamples);
  }

  if (sequence.order !== 'fixed') {
    // usedComponents.sort(() => moveRandomizer() - moveRandomizer());
    // originalIndices.sort(() => copyRandomizer() - copyRandomizer());
  }

  let currWidth = width;
  usedComponents.forEach((seq, i) => {
    const isActive = active && (!sequence.numSamples || activeNumbers.includes(i));
    if (typeof seq === 'string') {
      blocks.push({
        component: seq, depth, start: currWidth, width: WIDTH_INCREMENT_CIRCLE, active: isActive, id: `${seq + depth + path}_${originalIndices[i]}`,
      });
      currWidth += WIDTH_INCREMENT_CIRCLE + MARGIN_BETWEEN;
    } else {
      blocks.push({
        component: seq, depth, start: currWidth - WIDTH_INCREMENT_CIRCLE / 2, width: blockSize, active: isActive, id: `${depth + path}_${originalIndices[i]}`,
      });
      if (isActive && sequence.numSamples) {
        arrows.push({ topDepth: depth - 1, x1: parentCenter, x2: (currWidth - WIDTH_INCREMENT_CIRCLE / 2) + (blockSize / 2) });
      }
      traverseSequenceRec(seq, blocks, arrows, seeds, depth + 1, currWidth, blockSize, isActive, (currWidth - WIDTH_INCREMENT_CIRCLE / 2) + (blockSize / 2), `${path}_${originalIndices[i]}`);

      currWidth += blockSize + MARGIN_BETWEEN;
    }
  });
}

function traverseSequence(sequence: ComponentBlock, maxWidth: number, seeds: number[]) : [TraversedSequence[], Arrows[] ] {
  const blocks: TraversedSequence[] = [];
  const arrows: Arrows[] = [];
  traverseSequenceRec(sequence, blocks, arrows, seeds, 1, WIDTH_INCREMENT_CIRCLE, maxWidth, true, maxWidth / 2, '0');

  return [blocks, arrows];
}

export function SequenceVis() {
  const { sequence } = useStudyConfig();

  const [randomSeeds, setRandomSeeds] = useState<number[]>([]);

  const setSeed = useEvent((index: number, newSeed: number) => {
    setRandomSeeds(randomSeeds.map((seed, i) => (i === index ? newSeed : seed)));
  });

  const [fakeCounter, setFakeCounter] = useState<number>(0);

  const [ref, { width }] = useResizeObserver();

  const maxDepth = useMemo(() => findMaxDepth(sequence, 1), [sequence]);

  //   useEffect(() => {
  //     if (randomSeeds.length === 0) {
  //       setRandomSeeds(d3.range(maxDepth));
  //       setFakeCounter(fakeCounter + 1);
  //     } else {
  //       for (let i = 0; i < randomSeeds.length; i += 1) {
  //         setTimeout(() => {
  //           setSeed(i, Math.random() * 1000);
  //         }, 7000 + i * 1000);
  //       }
  //     }
  //   }, [maxDepth, fakeCounter]);

  //   useEffect(() => {
  //     setTimeout(() => {
  //       setFakeCounter(fakeCounter + 1);
  //     }, 7000);
  //   }, [fakeCounter]);

  const [blocks, arrows] = useMemo(() => traverseSequence(sequence, width - MARGIN_BETWEEN, randomSeeds), [sequence, width, randomSeeds]);
  console.log(blocks);

  return (
    <Stack ref={ref} style={{ height: '100%' }}>
      <svg style={{ height: '1000px', width, fontFamily: 'var(--mantine-font-family)' }}>
        <SequenceComponent components={blocks} arrows={arrows} />
      </svg>
    </Stack>
  );
}
