import { useParams } from 'react-router';

import { useCallback } from 'react';
import { useAsync } from '../../store/hooks/useAsync';

import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StorageEngine } from '../../storage/engines/types';
import { ThinkAloudFooter } from '../../analysis/individualStudy/thinkAloud/ThinkAloudFooter';
import { useCurrentIdentifier } from '../../routes/utils';
import { useStoreActions, useStoreDispatch } from '../../store/store';
import { useRecordingConfig } from '../../store/hooks/useRecordingConfig';

function getAllParticipantsNames(storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return storageEngine.getAllParticipantIds();
  }
  return null;
}

export function AnalysisFooter({ setHasAudio }: {setHasAudio: (b: boolean) => void}) {
  const { storageEngine } = useStorageEngine();

  const { value: allParticipants } = useAsync(getAllParticipantsNames, [storageEngine]);

  const identifier = useCurrentIdentifier();

  const storeDispatch = useStoreDispatch();

  const { currentComponentHasScreenRecording } = useRecordingConfig();

  const { studyId } = useParams();

  const {
    saveAnalysisState,
  } = useStoreActions();

  const { setAnalysisIsPlaying, setProvenanceJumpTime } = useStoreActions();

  const handleProvenanceTimelineChange = useCallback((n: number) => {
    storeDispatch(setProvenanceJumpTime(n));
  }, [storeDispatch, setProvenanceJumpTime]);

  const handleAnalysisIsPlayingChange = useCallback((isPlaying: boolean) => {
    storeDispatch(setAnalysisIsPlaying(isPlaying));
  }, [storeDispatch, setAnalysisIsPlaying]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveProvenance = useCallback((prov: any) => storeDispatch(saveAnalysisState(prov)), [storeDispatch, saveAnalysisState]);

  return (
    <ThinkAloudFooter storageEngine={storageEngine} setHasAudio={setHasAudio} studyId={studyId || ''} currentTrial={identifier} isReplay visibleParticipants={allParticipants || []} rawTranscript={null} currentShownTranscription={null} width={3000} onTimeUpdate={() => {}} saveProvenance={saveProvenance} onProvenanceTimelineChange={handleProvenanceTimelineChange} onAnalysisIsPlayingChange={handleAnalysisIsPlayingChange} forceMute={currentComponentHasScreenRecording} />
  );
}
