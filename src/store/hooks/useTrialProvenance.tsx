import {
  createContext, Fragment, ReactNode, useContext, useEffect, useMemo, useState,
} from 'react';
import { Loader } from '@mantine/core';
import { getGlobalStoreHistory } from '../globalStoreHistory';
import { getActiveGlobalStoreSubmissions } from '../globalStoreProvenance';
import { RestorationError } from '../../components/interface/RestorationError';
import { useCurrentIdentifier } from '../../routes/utils';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { useStoreActions, useStoreDispatch, useStoreSelector } from '../store';
import type {
  FormElementProvenance, StoredAnswer, StoredProvenance, TrrackedProvenance,
} from '../types';
import type { ResponseBlockLocation } from '../../parser/types';
import { createEmptyProvenance, getLegacyStoredAnswerProvenance } from '../provenance';
import { getResumedProvenanceState, validateResumableProvenance } from '../resumeProvenance';
import { useIsAnalysis } from './useIsAnalysis';
import { ErrorBoundary } from '../../controllers/ErrorBoundary';

const TrialProvenanceContext = createContext<StoredProvenance | undefined>(undefined);

export function useTrialProvenance(location: ResponseBlockLocation) {
  return useContext(TrialProvenanceContext)?.[location];
}

function TrialProvenanceLoader({ children }: { children: ReactNode }) {
  const identifier = useCurrentIdentifier();
  const participantId = useStoreSelector((state) => state.participantId);
  const currentGlobalGraph = useStoreSelector((state) => state.globalStoreGraph);
  const [globalGraph] = useState(currentGlobalGraph);
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
      const active = getActiveGlobalStoreSubmissions(globalGraph).find((entry) => entry.submission.answer.identifier === identifier);
      const historical = active?.submission ?? (globalGraph && getGlobalStoreHistory(globalGraph).find((entry) => entry.submission.answer.identifier === identifier)?.submission);
      const saved = (answer?.endTime > 0 || historical) && storageEngine && !Object.values(retained ?? {}).some(Boolean)
        ? await storageEngine.getProvenance(identifier, participantId, true)
        : null;
      const provenance = { ...createEmptyProvenance(), ...getLegacyStoredAnswerProvenance(answer), ...saved };
      Object.entries(retained ?? {}).forEach(([location, graph]) => {
        if (graph) provenance[location as ResponseBlockLocation] = graph;
      });
      if (historical) {
        Object.entries(historical.sourceNodes).forEach(([location, source]) => {
          const graph = provenance[location as ResponseBlockLocation];
          if (!graph || source.root !== graph.root || !graph.nodes[source.current]) throw new Error('The accepted interaction state is missing.');
        });
        Object.entries(provenance).forEach(([location, candidate]) => {
          if (!candidate) return;
          const graph: TrrackedProvenance = structuredClone(candidate);
          const source = active?.submission.sourceNodes[location];
          if (source && (source.root !== graph.root || !graph.nodes[source.current])) throw new Error('The accepted interaction state is missing.');
          graph.current = (source?.current ?? graph.root) as typeof graph.current;
          if (!active) graph.resetToInitialState = true;
          provenance[location as ResponseBlockLocation] = graph;
        });
      }
      Object.values(provenance).forEach((graph) => { if (graph) validateResumableProvenance(graph); });
      const responseValues: Partial<Record<ResponseBlockLocation, StoredAnswer['answer']>> = {};
      Object.entries(provenance).forEach(([location, graph]) => {
        if (!graph || location === 'globalStore' || ('resetToInitialState' in graph && graph.resetToInitialState)) return;
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
  }, [globalGraph, answer, attempt, dispatch, identifier, participantId, retained, restoreTrialProvenance, storageEngine]);

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
  const dispatch = useStoreDispatch();
  const { setGlobalStoreSubmitting } = useStoreActions();
  const pendingIdentifier = useStoreSelector((state) => state.globalStorePendingIdentifier);
  const pendingRevision = useStoreSelector((state) => state.globalStorePendingRevision);
  const revision = useStoreSelector((state) => state.globalStoreRevision);
  const identifier = useCurrentIdentifier();
  const participantId = useStoreSelector((state) => state.participantId);
  const isAnalysis = useIsAnalysis();
  const changedDuringSave = !!pendingIdentifier && pendingIdentifier !== identifier;
  const saveAccepted = pendingRevision !== undefined && (revision ?? 0) > pendingRevision;
  useEffect(() => {
    if (!isAnalysis && changedDuringSave && saveAccepted) dispatch(setGlobalStoreSubmitting(false));
  }, [isAnalysis, changedDuringSave, saveAccepted, dispatch, setGlobalStoreSubmitting]);
  const key = useMemo(() => `${participantId}:${identifier}`, [identifier, participantId]);
  // Do not snapshot the destination's history while its predecessor is still saving.
  if (!isAnalysis && changedDuringSave && !saveAccepted) return <Loader aria-label="Finishing response save" />;
  if (isAnalysis) return <Fragment key={key}>{children}</Fragment>;
  return <TrialProvenanceLoader key={key}>{children}</TrialProvenanceLoader>;
}
