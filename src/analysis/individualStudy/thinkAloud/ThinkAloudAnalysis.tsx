import {
  Center,
  Group, Stack, Text,
} from '@mantine/core';
import { useParams, useSearchParams } from 'react-router';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import debounce from 'lodash.debounce';

import { useResizeObserver } from '@mantine/hooks';
import { useAsync } from '../../../store/hooks/useAsync';
import { useStorageEngine } from '../../../storage/storageEngineHooks';
import { useAuth } from '../../../store/hooks/useAuth';
import { ParticipantData } from '../../../storage/types';
import {
  EditedText, TranscribedAudio,
} from './types';
import { TextEditor } from './TextEditor';
import { StorageEngine } from '../../../storage/engines/types';
import { ThinkAloudFooter } from './ThinkAloudFooter';

async function getTranscript(storageEngine: StorageEngine | undefined, partId: string | undefined, trialName: string | undefined, authEmail: string | null | undefined) {
  if (storageEngine && partId && trialName && authEmail) {
    return await storageEngine.getEditedTranscript(partId, authEmail, trialName);
  }

  return null;
}

function getParticipantData(trrackId: string | undefined, storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getParticipantData(trrackId);
  }

  return null;
}

export function ThinkAloudAnalysis({ visibleParticipants } : {visibleParticipants: ParticipantData[]}) {
  const { storageEngine } = useStorageEngine();
  const [rawTranscript, setRawTranscript] = useState<TranscribedAudio | null>(null);

  const auth = useAuth();

  const [searchParams] = useSearchParams();
  const [jumpedToLine, setJumpedToLine] = useState<number>(0);

  const currentTrial = useMemo(() => searchParams.get('currentTrial') || '', [searchParams]);

  const participantId = useMemo(() => searchParams.get('participantId') || '', [searchParams]);

  const [currentShownTranscription, setCurrentShownTranscription] = useState(0);

  const { value: participant } = useAsync(getParticipantData, [participantId, storageEngine]);

  const [editedTranscript, _setEditedTranscript] = useState<EditedText[]>([]);

  const debouncedSave = useMemo(() => {
    if (storageEngine && participantId && currentTrial) {
      return debounce((editedText: EditedText[]) => storageEngine.saveEditedTranscript(participantId, auth.user.user?.email || 'temp', currentTrial, editedText), 1000, { maxWait: 5000 });
    }

    return (_editedText: EditedText[]) => null;
  }, [currentTrial, auth.user.user?.email, storageEngine, participantId]);

  const setEditedTranscript = useCallback((editedText: EditedText[]) => {
    _setEditedTranscript(editedText);
    debouncedSave(editedText);
  }, [debouncedSave]);

  const { value: onlineTranscriptList, status: transcriptStatus } = useAsync(getTranscript, [storageEngine, participantId, currentTrial, auth.user.user?.email || 'temp']);

  useEffect(() => {
    if (onlineTranscriptList && transcriptStatus === 'success') {
      _setEditedTranscript(onlineTranscriptList);
    } else {
      _setEditedTranscript([]);
    }
  }, [onlineTranscriptList, transcriptStatus]);

  const { studyId } = useParams();

  const [ref, { width }] = useResizeObserver();

  // Update the current transcription based on the playTime.
  // TODO:: this is super unperformant, but I don't have a solution atm. think about it harder
  const onTimeUpdate = useCallback((playTime: number) => {
    if (rawTranscript && currentShownTranscription !== null && participant && playTime > 0) {
      let tempCurrentShownTranscription = currentShownTranscription;
      const startTime = (currentTrial ? participant.answers[currentTrial].startTime : participant.answers.audioTest.startTime);

      const timeInSeconds = Math.abs(playTime - startTime) / 1000;

      if (timeInSeconds > (rawTranscript.results[tempCurrentShownTranscription].resultEndTime as number)) {
        while (timeInSeconds > (rawTranscript.results[tempCurrentShownTranscription].resultEndTime as number)) {
          tempCurrentShownTranscription += 1;

          if (tempCurrentShownTranscription > rawTranscript.results.length - 1) {
            tempCurrentShownTranscription = rawTranscript.results.length - 1;
            break;
          }
        }
      } else if (tempCurrentShownTranscription > 0 && timeInSeconds < (rawTranscript.results[tempCurrentShownTranscription - 1].resultEndTime as number)) {
        while (tempCurrentShownTranscription > 0 && timeInSeconds < (rawTranscript.results[tempCurrentShownTranscription - 1].resultEndTime as number)) {
          tempCurrentShownTranscription -= 1;
        }
      }

      if (currentShownTranscription === tempCurrentShownTranscription) return;

      setCurrentShownTranscription(tempCurrentShownTranscription);
    }
  }, [rawTranscript, currentShownTranscription, participant, currentTrial]);

  // Get transcription, and merge all of the transcriptions into one, correcting for time problems. Only do this if we already checked that we dont have an edited transcript
  useEffect(() => {
    if (studyId && participantId) {
      storageEngine?.getTranscription(currentTrial, participantId, studyId).then((data) => {
        if (!data) {
          return;
        }

        const newTranscription = data.results.map((task) => {
          const newTimeTask = ({ ...task, resultEndTime: +(task.resultEndTime as string).split('s')[0] });

          return newTimeTask;
        }).flat();

        setRawTranscript({ results: newTranscription });

        if ((!onlineTranscriptList || onlineTranscriptList.length === 0) && editedTranscript.length === 0) {
          setEditedTranscript(newTranscription.map((t, i) => ({
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
  }, [storageEngine, studyId, participantId, currentTrial, setEditedTranscript, setCurrentShownTranscription, onlineTranscriptList, transcriptStatus, editedTranscript]);

  const changeLine = useCallback((focusedLine: number) => {
    const currentLine = editedTranscript[focusedLine].transcriptMappingStart;

    setJumpedToLine(currentLine);
  }, [editedTranscript]);

  return (
    <Group wrap="nowrap" gap={25}>
      <Stack ref={ref} style={{ width: '100%' }} gap={10}>

        {!participantId || !currentTrial ? <Center><Text c="dimmed" size="24">Select a Participant and Trial to Analyze</Text></Center> : (

          <Stack>
            <TextEditor onClickLine={changeLine} transcriptList={editedTranscript} setTranscriptList={setEditedTranscript} currentShownTranscription={currentShownTranscription} />
          </Stack>
        )}

        <ThinkAloudFooter jumpedToLine={jumpedToLine} editedTranscript={editedTranscript} currentTrial={currentTrial} isReplay={false} visibleParticipants={visibleParticipants.map((v) => v.participantId)} rawTranscript={rawTranscript} onTimeUpdate={onTimeUpdate} currentShownTranscription={currentShownTranscription} width={width} />
      </Stack>

    </Group>
  );
}
