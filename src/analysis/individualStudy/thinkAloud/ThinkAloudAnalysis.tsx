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
import { useAuth } from '../../../store/hooks/useAuth';
import { ParticipantData } from '../../../storage/types';
import {
  EditedText,
} from './types';
import { TextEditor } from './TextEditor';
import { ThinkAloudFooter } from './ThinkAloudFooter';
import { useEvent } from '../../../store/hooks/useEvent';
import { FirebaseStorageEngine } from '../../../storage/engines/FirebaseStorageEngine';

async function getTranscript(storageEngine: FirebaseStorageEngine, partId: string | undefined, trialName: string | undefined, authEmail: string | null | undefined) {
  if (storageEngine && partId && trialName && authEmail) {
    return await storageEngine.getEditedTranscript(partId, authEmail, trialName);
  }

  return null;
}

function getParticipantData(trrackId: string | undefined, storageEngine: FirebaseStorageEngine) {
  if (storageEngine) {
    return storageEngine.getParticipantData(trrackId);
  }

  return null;
}

function getRawTranscript(storageEngine: FirebaseStorageEngine, currentTrial: string, participantId: string, studyId: string | undefined) {
  if (storageEngine && studyId) {
    return storageEngine.getTranscription(currentTrial, participantId).then((data) => {
      if (!data || !data.results) {
        return null;
      }

      const newTranscription = data.results.map((task) => {
        const newTimeTask = ({ ...task, resultEndTime: +(task.resultEndTime as string).split('s')[0] });

        return newTimeTask;
      }).flat();

      return { results: newTranscription };
    });
  }

  return null;
}

export function ThinkAloudAnalysis({ visibleParticipants, storageEngine } : { visibleParticipants: ParticipantData[], storageEngine: FirebaseStorageEngine }) {
  const auth = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const [jumpedToLine, setJumpedToLine] = useState<number>(0);

  const currentTrial = useMemo(() => searchParams.get('currentTrial') || '', [searchParams]);

  const participantId = useMemo(() => searchParams.get('participantId') || '', [searchParams]);

  const [currentShownTranscription, setCurrentShownTranscription] = useState(0);

  const { value: participant } = useAsync(getParticipantData, [participantId, storageEngine]);
  const { studyId } = useParams();

  const [hasAudio, setHasAudio] = useState<boolean>();

  const [ref, { width }] = useResizeObserver();

  const [editedTranscript, _setEditedTranscript] = useState<EditedText[]>([]);

  const { value: rawTranscript, status: rawTranscriptStatus } = useAsync(getRawTranscript, [storageEngine, currentTrial, participantId, studyId]);

  const debouncedSave = useMemo(() => {
    if (storageEngine && participantId && currentTrial) {
      return debounce((editedText: EditedText[]) => storageEngine.saveEditedTranscript(participantId, auth.user.user?.email || 'temp', currentTrial, editedText), 1000, { maxWait: 5000 });
    }

    return (_editedText: EditedText[]) => null;
  }, [currentTrial, auth.user.user?.email, storageEngine, participantId]);

  useEffect(() => {
    if (!currentTrial && !participantId && visibleParticipants.length > 0) {
      setSearchParams({ participantId: visibleParticipants[0].participantId, currentTrial: Object.entries(visibleParticipants[0].answers).find(([_, ans]) => +ans.trialOrder.split('_')[0] === 0)?.[0] || '' });
    }
    // I really only want to do this on mount, so leaving this empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Update the current transcription based on the playTime.
  const onTimeUpdate = useEvent((playTime: number) => {
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
  });

  // Get transcription, and merge all of the transcriptions into one, correcting for time problems. Only do this if we already checked that we dont have an edited transcript
  useEffect(() => {
    if (transcriptStatus === 'success' && (!onlineTranscriptList || onlineTranscriptList.length === 0) && rawTranscriptStatus === 'success' && rawTranscript) {
      setEditedTranscript(rawTranscript.results.map((t, i) => ({
        transcriptMappingStart: i,
        transcriptMappingEnd: i,
        text: t.alternatives[0].transcript?.trim() || '',
        selectedTags: [],
        annotation: '',
      })));
    }
  }, [auth.user.user?.email, currentTrial, onlineTranscriptList, participantId, rawTranscript, rawTranscriptStatus, setEditedTranscript, storageEngine, transcriptStatus]);

  const changeLine = useCallback((focusedLine: number) => {
    const currentLine = editedTranscript[focusedLine].transcriptMappingStart;

    setJumpedToLine(currentLine);
  }, [editedTranscript]);

  // If we change task or participant, jump back to 0
  useEffect(() => {
    setJumpedToLine(0);
  }, [participantId, currentTrial]);

  return (
    <Group wrap="nowrap" gap={25}>
      <Stack ref={ref} style={{ width: '100%' }} gap={10}>

        {!participantId || !currentTrial ? <Center><Text c="dimmed" size="24">Select a Participant and Trial to Analyze</Text></Center>
          : !hasAudio || (rawTranscriptStatus === 'success' && rawTranscript === null) ? <Center><Text c="dimmed" size="24">No transcripts found for this task</Text></Center> : (

            <Stack>
              <TextEditor onClickLine={changeLine} transcriptList={editedTranscript} setTranscriptList={setEditedTranscript} currentShownTranscription={currentShownTranscription} />
            </Stack>
          )}

        <ThinkAloudFooter setHasAudio={setHasAudio} saveProvenance={() => null} studyId={studyId || ''} jumpedToLine={jumpedToLine} editedTranscript={editedTranscript} currentTrial={currentTrial} isReplay={false} visibleParticipants={visibleParticipants.map((v) => v.participantId)} rawTranscript={rawTranscript} onTimeUpdate={onTimeUpdate} currentShownTranscription={currentShownTranscription} width={width} storageEngine={storageEngine} />
      </Stack>

    </Group>
  );
}
