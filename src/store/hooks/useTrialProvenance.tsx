import {
  createContext, Fragment, ReactNode, useContext, useEffect, useMemo, useState,
} from 'react';
import { Loader } from '@mantine/core';
import { RestorationError } from '../../components/interface/RestorationError';
import { useCurrentIdentifier } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStoreActions, useStoreDispatch, useStoreSelector } from '../store';
import type { FormElementProvenance, StoredAnswer, StoredProvenance } from '../types';
import type { ResponseBlockLocation } from '../../parser/types';
import { createEmptyProvenance, getLegacyStoredAnswerProvenance } from '../provenance';
import { getResumedProvenanceState } from '../resumeProvenance';
import { useIsAnalysis } from './useIsAnalysis';
import { ErrorBoundary } from '../../controllers/ErrorBoundary';

const TrialProvenanceContext = createContext<StoredProvenance | undefined>(undefined);

export function useTrialProvenance(location: ResponseBlockLocation) {
  return useContext(TrialProvenanceContext)?.[location];
}

function TrialProvenanceLoader({ children }: { children: ReactNode }) {
  const identifier = useCurrentIdentifier();
  const participantId = useStoreSelector((state) => state.participantId);
  const validation = useStoreSelector((state) => state.trialValidation[identifier]);
  const currentAnswer = useStoreSelector((state) => state.answers[identifier]);
  const [answer] = useState(currentAnswer);
  const { storageEngine } = useStorageEngine();
  const dispatch = useStoreDispatch();
  const { restoreTrialProvenance } = useStoreActions();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ provenance?: StoredProvenance; error?: boolean }>({});
  // Take one snapshot per mount; publications from children must not restart restoration.
  const [retained] = useState(() => validation?.provenanceGraph);

  useEffect(() => {
    let cancelled = false;
    setResult({});
    async function load() {
      const saved = answer?.endTime > 0 && storageEngine && !Object.values(retained ?? {}).some(Boolean)
        ? await storageEngine.getProvenance(identifier, participantId, true)
        : null;
      const provenance = { ...createEmptyProvenance(), ...getLegacyStoredAnswerProvenance(answer), ...saved };
      Object.entries(retained ?? {}).forEach(([location, graph]) => {
        if (graph) provenance[location as ResponseBlockLocation] = graph;
      });
      const responseValues: Partial<Record<ResponseBlockLocation, StoredAnswer['answer']>> = {};
      Object.entries(provenance).forEach(([location, graph]) => {
        if (!graph) return;
        const restored = getResumedProvenanceState(graph) as FormElementProvenance;
        if (location !== 'stimulus' && restored.form != null) {
          responseValues[location as ResponseBlockLocation] = restored.form;
        }
      });
      if (cancelled) return;
      dispatch(restoreTrialProvenance({ identifier, provenance, responseValues }));
      setResult({ provenance });
    }
    load().catch(() => { if (!cancelled) setResult({ error: true }); });
    return () => { cancelled = true; };
  }, [answer, attempt, dispatch, identifier, participantId, retained, restoreTrialProvenance, storageEngine]);

  const failure = <RestorationError onRetry={() => setAttempt((value) => value + 1)} />;
  if (result.error) return failure;
  if (!result.provenance) return <Loader aria-label="Restoring saved work" />;
  return (
    <TrialProvenanceContext.Provider value={result.provenance}>
      <ErrorBoundary key={attempt} fallback={failure}>{children}</ErrorBoundary>
    </TrialProvenanceContext.Provider>
  );
}

/** Covers the stimulus and every response location, including the sidebar. */
export function TrialProvenanceBoundary({ children }: { children: ReactNode }) {
  const identifier = useCurrentIdentifier();
  const participantId = useStoreSelector((state) => state.participantId);
  const isAnalysis = useIsAnalysis();
  const key = useMemo(() => `${participantId}:${identifier}`, [identifier, participantId]);
  if (isAnalysis) return <Fragment key={key}>{children}</Fragment>;
  return <TrialProvenanceLoader key={key}>{children}</TrialProvenanceLoader>;
}
