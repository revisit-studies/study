import {
  Box, Divider, Group, Stack,
} from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import seedrandom from 'seedrandom';
import * as d3 from 'd3';
import Editor, {
  DiffEditor, useMonaco, loader,
} from '@monaco-editor/react';

import { editor } from 'monaco-editor';
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

function traverseSequenceRec(sequence: ComponentBlock, blocks: TraversedSequence[], arrows: Arrows[], depth: number, width: number, maxWidth: number, active: boolean, parentCenter: number, path: string) {
  const blockSize = findBlockWidth(sequence, maxWidth);

  const usedComponents = deepCopy(sequence.components);
  const originalIndices = d3.range(sequence.components.length);

  if (sequence.order !== 'fixed') {
    // usedComponents.sort(() => moveRandomizer() - moveRandomizer());
    // originalIndices.sort(() => copyRandomizer() - copyRandomizer());
  }

  let currWidth = width;

  const isLastChild = usedComponents.filter((comp) => {
    if (typeof comp === 'string') {
      return false;
    }
    return true;
  }).length === 0;
  usedComponents.forEach((seq, i) => {
    const isActive = active && (!sequence.numSamples || sequence.numSamples > i);
    if (typeof seq === 'string') {
      blocks.push({
        component: seq, depth: isLastChild ? (depth + (i / 4)) : depth, start: isLastChild ? currWidth + (maxWidth / 2) - (WIDTH_INCREMENT_CIRCLE / 2) : currWidth, width: WIDTH_INCREMENT_CIRCLE, active: isActive, id: seq, order: i,
      });
      if (!isLastChild) {
        currWidth += WIDTH_INCREMENT_CIRCLE + MARGIN_BETWEEN;
      }
    } else {
      blocks.push({
        component: seq, depth, start: currWidth - WIDTH_INCREMENT_CIRCLE / 2, width: blockSize, active: isActive, id: seq.id || '', order: i,
      });
      if (isActive && sequence.numSamples) {
        arrows.push({ topDepth: depth - 1, x1: parentCenter, x2: (currWidth - WIDTH_INCREMENT_CIRCLE / 2) + (blockSize / 2) });
      }
      traverseSequenceRec(seq, blocks, arrows, depth + 1, currWidth, blockSize, isActive, (currWidth - WIDTH_INCREMENT_CIRCLE / 2) + (blockSize / 2), `${path}_${originalIndices[i]}`);

      currWidth += blockSize + MARGIN_BETWEEN;
    }
  });
}

function traverseSequence(sequence: ComponentBlock, maxWidth: number, fakeCounter: number, assignedIds: boolean) : [TraversedSequence[], Arrows[] ] {
  const blocks: TraversedSequence[] = [];
  const arrows: Arrows[] = [];

  if (assignedIds) {
    traverseSequenceRec(sequence, blocks, arrows, 1, WIDTH_INCREMENT_CIRCLE, maxWidth, true, maxWidth / 2, '0');
  }

  return [blocks, arrows];
}

function getAllBlocks(sequence: ComponentBlock, blocks: ComponentBlock[]) {
  sequence.components.forEach((seq) => {
    if (typeof seq !== 'string') {
      blocks.push(seq);
      getAllBlocks(seq, blocks);
    }
  });
}

function assignIds(sequence: ComponentBlock, path: string) {
  sequence.components.forEach((seq, i) => {
    if (typeof seq !== 'string' && !seq.id) {
      seq.id = `${path}_${i}`;
      assignIds(seq, `${path}_${i}`);
    } else if (typeof seq === 'string') {
      sequence.components[i] = `${seq}___${path}`;
    }
  });
}

function getAllBlocksRecursively(sequence: ComponentBlock) {
  const blocks: ComponentBlock[] = [];

  getAllBlocks(sequence, blocks);
  return blocks;
}

function switchOneOrder(sequence: ComponentBlock) {
  const allBlocks = getAllBlocksRecursively(sequence).filter((block) => block.order !== 'fixed');

  const randomBlock = allBlocks[Math.floor(Math.random() * allBlocks.length)];

  randomBlock.components.sort(() => Math.random() - Math.random());

  return allBlocks;
}

export function SequenceVis() {
  const { sequence } = useStudyConfig();

  const monacoEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const currentSequence = useRef<ComponentBlock>(deepCopy(sequence));
  const [assignedIds, setAssignedIds] = useState<boolean>(false);

  useEffect(() => {
    assignIds(currentSequence.current, '0');
    setAssignedIds(true);
  }, []);

  const [fakeCounter, setFakeCounter] = useState<number>(0);

  const [ref, { width }] = useResizeObserver();

  useEffect(() => {
    setTimeout(() => {
      switchOneOrder(currentSequence.current);
      setFakeCounter(fakeCounter + 1);
    }, 200);
  }, [fakeCounter]);

  const [blocks, arrows] = useMemo(() => traverseSequence(currentSequence.current, width - MARGIN_BETWEEN - 600, fakeCounter, assignedIds), [currentSequence, width, fakeCounter, assignedIds]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value) {
      currentSequence.current = JSON.parse(value);
    }
  }, []);

  console.log(monacoEditorRef.current);

  useEffect(() => {

  }, []);

  return (
    <Stack ref={ref} style={{ height: '100%' }}>
      <Group wrap="nowrap">
        <Box
          style={{ width: '600px', height: '1200px' }}
          onKeyDown={(press) => {
            if (press.key === 's' && (press.ctrlKey || press.metaKey)) {
              if (monacoEditorRef.current) {
                monacoEditorRef.current?.getAction('editor.action.formatDocument')?.run();
                setFakeCounter(fakeCounter + 1);
              }
              press.preventDefault();
              press.stopPropagation();
            }
          }}
        >
          <Editor
            onMount={(editorRef) => {
              monacoEditorRef.current = editorRef;
            }}
            onChange={handleEditorChange}
            height="1200px"
            defaultLanguage="json"
            options={{
              scrollbar: {
                horizontal: 'visible',
              },
              wordWrap: 'off',
              wordWrapOverride1: 'off',
              wordWrapOverride2: 'off',
              automaticLayout: true,
              autoIndent: 'full',

            }}
            defaultValue={JSON.stringify(sequence)}
          />
        </Box>
        <Divider orientation="vertical" size="lg" />
        <svg style={{ height: '1200px', width: width - 400, fontFamily: 'var(--mantine-font-family)' }}>
          <SequenceComponent components={blocks} arrows={arrows} />
        </svg>
      </Group>

    </Stack>
  );
}
