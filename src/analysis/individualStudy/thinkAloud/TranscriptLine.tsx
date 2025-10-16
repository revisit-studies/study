import {
  Grid, Group, Textarea,
} from '@mantine/core';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useResizeObserver } from '@mantine/hooks';
import { Tag } from './types';
import { TagSelector } from './tags/TagSelector';

export function TranscriptLine({
  annotation, setAnnotation, start, current, end, text, tags, selectedTags, onTextChange, deleteRowCallback, addRowCallback, onSelectTags, addRef, index, editTagCallback, createTagCallback, onClickLine,
} : {annotation: string; setAnnotation: (i: number, s: string) => void; start: number, end: number, current: number, text: string, tags: Tag[], selectedTags: Tag[], onTextChange: (i: number, v: string) => void, deleteRowCallback: (i: number) => void, addRowCallback: (i: number, textIndex: number) => void, onSelectTags: (i: number, t: Tag[]) => void, addRef: (i: number, ref: HTMLTextAreaElement) => void, index: number, editTagCallback: (oldTag: Tag, newTag: Tag) => void, createTagCallback: (t: Tag) => void, onClickLine: (focusedLine: number) => void }) {
  const [annotationVal, setAnnotationVal] = useState<string>(annotation);

  const indexRef = useRef<number>(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const [ref, { width }] = useResizeObserver();

  const memoizedRender = useMemo(() => (
    <Grid style={{ width: '100%' }}>
      <Grid.Col span={8}>

        <Group wrap="nowrap" gap={0} px={10} style={{ width: '100%', borderRadius: '10px', backgroundColor: current >= start && current <= end ? 'rgba(100, 149, 237, 0.3)' : 'white' }}>
          <Textarea
            ref={(r) => (r ? addRef(indexRef.current, r) : undefined)}
            autosize
            minRows={1}
            maxRows={4}
            style={{ width: '100%' }}
            variant="unstyled"
            value={text}
            onFocus={() => onClickLine(indexRef.current)}
            onChange={(e) => { onTextChange(indexRef.current, e.currentTarget.value); }}
            onKeyDown={((e) => {
              if (e.key === 'Enter' && e.currentTarget.selectionStart !== null) {
                addRowCallback(indexRef.current, e.currentTarget.selectionStart);
                e.preventDefault();
                e.stopPropagation();
              } else if (e.key === 'Backspace') {
                if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                  deleteRowCallback(indexRef.current);
                  e.preventDefault();
                  e.stopPropagation();
                }
              }
            })}
          />
        </Group>
      </Grid.Col>
      <Grid.Col ref={ref} span={2}>
        <TagSelector width={width - 20} createTagCallback={createTagCallback} editTagCallback={editTagCallback} onSelectTags={(t) => onSelectTags(indexRef.current, t)} selectedTags={selectedTags} tags={tags} tagsEmptyText="Add Text Tags" />
      </Grid.Col>
      <Grid.Col span={2}>
        <Textarea
          autosize
          style={{ width: width - 20 }}
          minRows={1}
          maxRows={4}
          value={annotationVal}
          onChange={(event) => setAnnotationVal(event.currentTarget.value)}
          placeholder="Add Annotation"
          onBlur={() => setAnnotation(indexRef.current, annotationVal)}
        />
      </Grid.Col>
    </Grid>
  ), [addRef, addRowCallback, annotationVal, createTagCallback, current, deleteRowCallback, editTagCallback, end, onClickLine, onSelectTags, onTextChange, ref, selectedTags, setAnnotation, start, tags, text, width]);

  return memoizedRender;
}
