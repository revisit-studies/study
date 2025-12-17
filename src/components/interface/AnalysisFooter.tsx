import { useParams, useSearchParams } from 'react-router';

import { useCallback, useMemo } from 'react';
import { useAsync } from '../../store/hooks/useAsync';

import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StorageEngine } from '../../storage/engines/types';
import { ThinkAloudFooter } from '../../analysis/individualStudy/thinkAloud/ThinkAloudFooter';
import { useCurrentIdentifier } from '../../routes/utils';
import { useStoreActions, useStoreDispatch } from '../../store/store';

async function getAllParticipantsNames(storageEngine: StorageEngine | undefined) {
  if (storageEngine) {
    return (await storageEngine.getAllParticipantIds()).filter((p) => p !== undefined);
  }
  return null;
}

export function AnalysisFooter({ setHasAudio }: {setHasAudio: (b: boolean) => void}) {
  const { storageEngine } = useStorageEngine();

  const { value: allParticipants } = useAsync(getAllParticipantsNames, [storageEngine]);

  const identifier = useCurrentIdentifier();

  const storeDispatch = useStoreDispatch();

  const { studyId } = useParams();
  const [searchParams] = useSearchParams();

  const currentTrial = useMemo(() => searchParams.get('currentTrial') || identifier, [identifier, searchParams]);

  const {
    saveAnalysisState,
  } = useStoreActions();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveProvenance = useCallback((prov: any) => storeDispatch(saveAnalysisState(prov)), [storeDispatch, saveAnalysisState]);

  return (
    <ThinkAloudFooter storageEngine={storageEngine} setHasAudio={setHasAudio} studyId={studyId || ''} currentTrial={currentTrial} isReplay visibleParticipants={allParticipants || []} rawTranscript={null} currentShownTranscription={null} width={3000} onTimeUpdate={() => {}} saveProvenance={saveProvenance} />
  );
}
