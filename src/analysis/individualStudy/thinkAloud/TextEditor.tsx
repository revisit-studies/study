import {
  useCallback,
  useMemo, useRef,
} from 'react';
import {
  Grid,
  Group, Stack, Text,
  Tooltip,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useEvent } from '../../../store/hooks/useEvent';
import {
  EditedText, Tag,
} from './types';
import {
  TranscriptLine,
} from './TranscriptLine';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { useAsync } from '../../../store/hooks/useAsync';
import { StorageEngine } from '../../../storage/engines/types';

async function getTags(storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    const tags = await storageEngine.getTags('text');

    if (Array.isArray(tags)) {
      return tags;
    }
    return [];
  }

  return [];
}

export function TextEditor({
  currentShownTranscription, transcriptList, setTranscriptList, onClickLine,
} : {
  currentShownTranscription: number, transcriptList: EditedText[], setTranscriptList: (e: EditedText[]) => void, onClickLine: (focusedLine: number) => void
}) {
  const { storageEngine } = useStorageEngine();

  const { value: tags, execute: pullTags } = useAsync(getTags, [storageEngine]);

  const setTags = useCallback((_tags: Tag[]) => {
    if (storageEngine) {
      storageEngine.saveTags(_tags, 'text').then(() => pullTags(storageEngine));
    }
  }, [pullTags, storageEngine]);

  const textRefs = useRef<HTMLTextAreaElement[]>([]);

  const textChangeCallback = useEvent((index: number, newVal: string) => {
    const tempList = [...transcriptList];
    tempList[index].text = newVal;

    setTranscriptList(tempList);
  });

  const addTagCallback = useEvent((index: number, newTags: Tag[]) => {
    const tempList = [...transcriptList];
    tempList[index].selectedTags = newTags;

    setTranscriptList(tempList);
  });

  const setAnnotationCallback = useEvent((index: number, annotation: string) => {
    const tempList = [...transcriptList];
    tempList[index].annotation = annotation;

    setTranscriptList(tempList);
  });

  // special logic for when I hit backspace at the start of one of the text boxes. Delete that row, move the text to the one above it, copy up the tags, accounting for duplicates
  const deleteRowCallback = useEvent((index) => {
    if (index === 0) {
      return;
    }

    const newEditedList = structuredClone(transcriptList);
    newEditedList[index - 1].text = transcriptList[index - 1].text + transcriptList[index].text;
    newEditedList[index - 1].transcriptMappingEnd = transcriptList[index].transcriptMappingEnd;
    newEditedList[index - 1].selectedTags = [...transcriptList[index - 1].selectedTags, ...transcriptList[index].selectedTags.filter((tag) => !transcriptList[index - 1].selectedTags.find((prevTags) => prevTags.id === tag.id))];

    newEditedList.splice(index, 1);

    newEditedList.filter((l) => l.transcriptMappingStart === newEditedList[index - 1].transcriptMappingStart).forEach((l) => { l.transcriptMappingEnd = newEditedList[index - 1].transcriptMappingEnd; });

    setTranscriptList(newEditedList);

    setTimeout(() => {
      textRefs.current[index - 1].focus();
      textRefs.current[index - 1].setSelectionRange(transcriptList[index - 1].text.length, transcriptList[index - 1].text.length, 'none');
    }, 1);
  });

  // Special logic for when i hit enter in any of the text boxes. Create a new row below, moving text after the enter into the new row, and copy the tags into the new row
  const addRowCallback = useEvent((index, textIndex) => {
    const newEditedList = structuredClone(transcriptList);
    const editedItem = newEditedList[index];

    newEditedList.splice(index + 1, 0, {
      transcriptMappingEnd: editedItem.transcriptMappingEnd,
      transcriptMappingStart: editedItem.transcriptMappingStart,
      text: editedItem.text.slice(textIndex),
      selectedTags: editedItem.selectedTags,
      annotation: '',
    });

    newEditedList[index].text = newEditedList[index].text.slice(0, textIndex);

    setTranscriptList(newEditedList);

    setTimeout(() => {
      textRefs.current[index + 1].focus();
      textRefs.current[index + 1].setSelectionRange(0, 0);
    }, 1);
  });

  const editTagCallback = useCallback((oldTag: Tag, newTag: Tag) => {
    if (!tags) {
      return;
    }

    const tagIndex = tags.findIndex((t) => t.id === oldTag.id);
    const tagsCopy = Array.from(tags);
    tagsCopy[tagIndex] = newTag;

    setTags(tagsCopy);
  }, [setTags, tags]);

  const createTagCallback = useCallback((t: Tag) => { setTags([...(tags || []), t]); }, [setTags, tags]);

  const addTextRefCallback = useCallback((i: number, ref: HTMLTextAreaElement) => {
    textRefs.current[i] = ref;
  }, []);

  const transcript = useMemo(() => (transcriptList.map((line, i) => (
    <TranscriptLine
      onClickLine={onClickLine}
      editTagCallback={editTagCallback}
      createTagCallback={createTagCallback}
      annotation={line.annotation}
      setAnnotation={setAnnotationCallback}
      addRef={addTextRefCallback}
      onSelectTags={addTagCallback}
      addRowCallback={addRowCallback}
      deleteRowCallback={deleteRowCallback}
      onTextChange={textChangeCallback}
      tags={tags || []}
      selectedTags={line.selectedTags}
      text={line.text}
      key={i}
      index={i}
      start={line.transcriptMappingStart}
      end={line.transcriptMappingEnd}
      current={currentShownTranscription === null ? 0 : currentShownTranscription}
    />
  ))), [addRowCallback, addTagCallback, addTextRefCallback, createTagCallback, currentShownTranscription, deleteRowCallback, editTagCallback, onClickLine, setAnnotationCallback, tags, textChangeCallback, transcriptList]);

  return (
    <Stack gap={0}>
      <Grid style={{ width: '100%' }} mb="sm">
        <Grid.Col span={8}>
          <Text fw={700} size="xl">Transcripts</Text>
        </Grid.Col>
        <Grid.Col span={2}>

          <Group gap="xs" align="center">
            <Text fw={700} size="xl">Text Tags</Text>
            <Tooltip w={300} multiline label="Text tags allow you to categorize segments of text. Click in the box to add, create, or edit tags.">
              <IconInfoCircle size={16} />
            </Tooltip>
          </Group>
        </Grid.Col>
        <Grid.Col span={2}>

          <Group gap="xs" align="center">
            <Text fw={700} size="xl">Annotations</Text>
            <Tooltip w={300} multiline label="Annotations allow you to add additional context or notes to segments of text.">
              <IconInfoCircle size={16} />
            </Tooltip>
          </Group>
        </Grid.Col>
      </Grid>

      <Stack gap={5}>
        {transcript}
      </Stack>
    </Stack>
  );
}
