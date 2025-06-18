import {
  useCallback,
  useEffect, useMemo, useRef, useState,
} from 'react';
import { useParams } from 'react-router';
import {
  Group, Loader, Popover, Stack, Text,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { ParticipantData } from '../../../storage/types';
import { useStudyConfig } from '../../../store/hooks/useStudyConfig';
import { useEvent } from '../../../store/hooks/useEvent';
import {
  EditedText, Tag, TranscribedAudio, TranscriptLinesWithTimes,
} from './types';
import { IconComponent } from './tiptapExtensions/IconComponent';
import { TagEditor } from './TextEditorComponents/TagEditor';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';
import { useCurrentComponent } from '../../../routes/utils';
import { StorageEngine } from '../../../storage/engines/StorageEngine';
import { useAsync } from '../../../store/hooks/useAsync';
import { useAuth } from '../../../store/hooks/useAuth';

async function getTags(storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return await storageEngine.getTags('text');
  }

  return [];
}

export function TextEditor({
  participant, playTime, setTranscriptLines, currentShownTranscription, setCurrentShownTranscription, transcriptList, setTranscriptList,
} : {participant: ParticipantData, playTime: number, setTranscriptLines: (lines: TranscriptLinesWithTimes[]) => void; setCurrentShownTranscription: (i: number) => void; currentShownTranscription: number, transcriptList: EditedText[], setTranscriptList: (e: EditedText[]) => void}) {
  const [transcription, setTranscription] = useState<TranscribedAudio | null>(null);

  const auth = useAuth();

  const { trrackId, studyId, index: taskIndex } = useParams();
  const _trialFilter = useCurrentComponent();

  const trialFilter = taskIndex ? _trialFilter : null;

  const { storageEngine } = useStorageEngine();

  const { value: tags, execute: pullTags } = useAsync(getTags, [storageEngine]);

  const setTags = useCallback((_tags: Tag[]) => {
    if (storageEngine) {
      storageEngine.saveTags(_tags, 'text').then(() => pullTags(storageEngine));
    }
  }, [pullTags, storageEngine]);

  const config = useStudyConfig();

  const textRefs = useRef<HTMLTextAreaElement[]>([]);

  const trialFilterAnswersName = useMemo(() => {
    if (!trialFilter || !participant) {
      return null;
    }

    return Object.keys(participant.answers).find((key) => key.startsWith(trialFilter)) || null;
  }, [participant, trialFilter]);

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

  // Create a separate object, transcriptLines, with additional time information so that I can create the actual lines under the waveform.
  useEffect(() => {
    const lines:TranscriptLinesWithTimes[] = [];

    if (transcription && transcriptList.length > transcription.results.length) {
      return;
    }

    transcriptList.forEach((l, i) => {
      if (transcription && (i === 0 || l.transcriptMappingStart !== transcriptList[i - 1].transcriptMappingStart)) {
        lines.push({
          start: i === 0 ? 0 : transcription.results[l.transcriptMappingStart - 1].resultEndTime as number,
          end: transcription.results[l.transcriptMappingEnd].resultEndTime as number,
          lineStart: l.transcriptMappingStart,
          lineEnd: l.transcriptMappingEnd,
          tags: transcriptList.filter((t) => t.transcriptMappingStart === l.transcriptMappingStart && t.transcriptMappingEnd === l.transcriptMappingEnd).map((t) => t.selectedTags),
        });
      }
    });

    setTranscriptLines(lines);
  }, [transcriptList, setTranscriptLines, transcription]);

  // Get transcription, and merge all of the transcriptions into one, correcting for time problems.
  useEffect(() => {
    if (studyId && trrackId && participant) {
      storageEngine?.getTranscription(getSequenceFlatMap(participant.sequence).filter((seq) => config.tasksToNotRecordAudio === undefined || !config.tasksToNotRecordAudio.includes(seq)).filter((seq) => (trialFilter ? seq === trialFilter : true)), trrackId).then((data) => {
        const fullTranscription = data.map((d) => JSON.parse(d) as TranscribedAudio);
        let taskEndTime = 0;

        const newTranscription = fullTranscription.map((task) => {
          const newTimeTask = task.results.map((res) => ({ ...res, resultEndTime: +(res.resultEndTime as string).split('s')[0] + taskEndTime }));

          taskEndTime += +(task.results[task.results.length - 1].resultEndTime as string).split('s')[0];

          return newTimeTask;
        }).flat();

        setTranscription({ results: newTranscription });

        if (transcriptList.length === 0) {
          setTranscriptList(newTranscription.map((t, i) => ({
            transcriptMappingStart: i,
            transcriptMappingEnd: i,
            text: t.alternatives[0].transcript?.trim() || '',
            selectedTags: [],
            annotation: '',
          })));
        }

        setCurrentShownTranscription(0);
      });
    }
    //  WARNING WARNING ADDING TRANSCRIPT.LENGTH BAD BECAUSE I AM A BAD CODER
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageEngine, studyId, trrackId, config.tasksToNotRecordAudio, participant, trialFilter, setTranscriptList, setCurrentShownTranscription]);

  // Update the current transcription based on the playTime.
  // TODO:: this is super unperformant, but I don't have a solution atm. think about it harder
  useEffect(() => {
    if (transcription && currentShownTranscription !== null && participant && playTime > 0) {
      let tempCurrentShownTranscription = currentShownTranscription;
      const startTime = (trialFilterAnswersName ? participant.answers[trialFilterAnswersName].startTime : participant.answers.audioTest.startTime);

      const timeInSeconds = Math.abs(playTime - startTime) / 1000;

      if (timeInSeconds > (transcription.results[tempCurrentShownTranscription].resultEndTime as number)) {
        while (timeInSeconds > (transcription.results[tempCurrentShownTranscription].resultEndTime as number)) {
          tempCurrentShownTranscription += 1;

          if (tempCurrentShownTranscription > transcription.results.length - 1) {
            tempCurrentShownTranscription = transcription.results.length - 1;
            break;
          }
        }
      } else if (tempCurrentShownTranscription > 0 && timeInSeconds < (transcription.results[tempCurrentShownTranscription - 1].resultEndTime as number)) {
        while (tempCurrentShownTranscription > 0 && timeInSeconds < (transcription.results[tempCurrentShownTranscription - 1].resultEndTime as number)) {
          tempCurrentShownTranscription -= 1;
        }
      }

      if (currentShownTranscription === tempCurrentShownTranscription) return;

      setCurrentShownTranscription(tempCurrentShownTranscription);
    }
  }, [currentShownTranscription, participant, playTime, setCurrentShownTranscription, transcription, trialFilterAnswersName]);

  const editTagCallback = useCallback((oldTag: Tag, newTag: Tag) => {
    if (!tags) {
      return;
    }

    const tagIndex = tags.findIndex((t) => t.id === oldTag.id);
    const tagsCopy = Array.from(tags);
    tagsCopy[tagIndex] = newTag;

    const newTranscriptList = Array.from(transcriptList);

    // loop over and change all tags. Will need to do this smarter once we have it hooked up to firebase
    newTranscriptList.forEach((t) => {
      t.selectedTags = t.selectedTags.map((tag) => (tag.id === oldTag.id ? newTag : tag));
    });

    setTranscriptList(newTranscriptList);

    setTags(tagsCopy);
  }, [setTags, setTranscriptList, tags, transcriptList]);

  const addTextRefCallback = useCallback((i: number, ref: HTMLTextAreaElement) => {
    textRefs.current[i] = ref;
  }, []);

  const transcript = useMemo(() => (tags ? transcriptList.map((line, i) => (
    <IconComponent
      annotation={line.annotation}
      setAnnotation={setAnnotationCallback}
      addRef={addTextRefCallback}
      onSelectTags={addTagCallback}
      addRowCallback={addRowCallback}
      deleteRowCallback={deleteRowCallback}
      onTextChange={textChangeCallback}
      tags={tags}
      selectedTags={line.selectedTags}
      text={line.text}
      key={i}
      index={i}
      start={line.transcriptMappingStart}
      end={line.transcriptMappingEnd}
      current={currentShownTranscription === null ? 0 : currentShownTranscription}
    />
  )) : <Loader />), [addRowCallback, addTagCallback, addTextRefCallback, currentShownTranscription, deleteRowCallback, setAnnotationCallback, tags, textChangeCallback, transcriptList]);

  return (
    <Stack gap={0}>
      <Group mb="sm" justify="space-between" wrap="nowrap">
        <Text style={{ flexGrow: 1, textAlign: 'center' }}>Transcript</Text>
        <TagEditor createTagCallback={(t: Tag) => { setTags([...(tags || []), t]); }} editTagCallback={editTagCallback} tags={tags || []} email={auth.user.user?.email || ''} />
      </Group>
      <Stack gap={5}>
        {transcript}
      </Stack>
    </Stack>
  );
}
