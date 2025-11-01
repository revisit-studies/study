import { useDispatch } from 'react-redux';
import { useParams } from 'react-router';

import { useAsync } from '../../store/hooks/useAsync';

import { useStorageEngine } from '../../storage/storageEngineHooks';
import { StorageEngine } from '../../storage/engines/types';
import { ThinkAloudFooter } from '../../analysis/individualStudy/thinkAloud/ThinkAloudFooter';
import { useCurrentIdentifier } from '../../routes/utils';
import { useStoreActions } from '../../store/store';

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

  const dispatch = useDispatch();

  const { studyId } = useParams();

  const {
    saveAnalysisState,
  } = useStoreActions();

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ThinkAloudFooter storageEngine={storageEngine} setHasAudio={setHasAudio} studyId={studyId || ''} currentTrial={identifier} isReplay visibleParticipants={allParticipants || []} rawTranscript={null} currentShownTranscription={null} width={3000} onTimeUpdate={() => {}} saveProvenance={(prov: any) => dispatch(saveAnalysisState(prov))} />
  );
}
