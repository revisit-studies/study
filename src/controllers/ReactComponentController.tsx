import {
  ComponentType, Suspense, useCallback, useEffect, useMemo, useState,
} from 'react';
import { useGlobalStore, useGlobalStoreUpdaterRegistration } from '../store/hooks/useGlobalStore';
import { ParticipantData, ReactComponent } from '../parser/types';
import { StimulusParams, TrrackedProvenance } from '../store/types';
import { ResourceNotFound } from '../ResourceNotFound';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { useStoreDispatch, useStoreActions, useStoreSelector } from '../store/store';
import { useCurrentIdentifier } from '../routes/utils';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { RevisitProvenanceProvider } from '../store/hooks/useRevisitTrrack';
import { ErrorBoundary } from './ErrorBoundary';
import { useTrialProvenance } from '../store/hooks/useTrialProvenance';
import { StudyStateContext } from '../store/hooks/useStudyState';
import { RestorationError } from '../components/interface/RestorationError';
import { RestorationWarning } from '../components/interface/RestorationWarning';
import { responseValueKeys } from '../utils/responseVisibility';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { useAssetStatus, useAssetLoadStatus } from '../store/hooks/useAssetStatus';

const modules = import.meta.glob<{ default: ComponentType<StimulusParams<ReactComponent['parameters'], unknown>> }>(
  [
    '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
    '!../public/**/*.spec.{mjs,js,mts,ts,jsx,tsx}',
  ],
  { eager: true },
);

export function ReactComponentController({ currentConfig, provState, answers }: { currentConfig: ReactComponent; provState?: unknown, answers: ParticipantData['answers'] }) {
  const globalVariables = useGlobalStore();
  const registerGlobalStoreUpdater = useGlobalStoreUpdaterRegistration();
  const studyConfig = useStudyConfig();
  const templateData = useTemplateAnswerContext();
  const templatedPath = templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined;
  const reactPath = templatedPath ? `../public/${templatedPath}` : undefined;
  const StimulusComponent = reactPath ? modules[reactPath]?.default : undefined;
  const identifier = useCurrentIdentifier();
  const provenance = useTrialProvenance('stimulus');
  const retainedValues = useStoreSelector((state) => state.trialValidation[identifier]?.stimulus.values);
  const [restoredAnswers] = useState(() => ({ ...answers[identifier]?.answer, ...retainedValues }));
  const [registrations, setRegistrations] = useState({ state: 0, stateless: 0, graph: 0 });
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [settled, setSettled] = useState(false);
  const stateContext = useMemo(() => ({
    answers: restoredAnswers,
    register: (kind: 'state' | 'stateless' | 'graph') => {
      setRegistrations((current) => ({ ...current, [kind]: current[kind] + 1 }));
      return () => setRegistrations((current) => ({ ...current, [kind]: current[kind] - 1 }));
    },
  }), [restoredAnswers]);
  const registerGraph = useCallback(() => stateContext.register('graph'), [stateContext]);
  useEffect(() => { setSettled(true); }, []);
  const hostResponseKeys = new Set((currentConfig.response ?? [])
    .filter((response) => response.type !== 'reactive').flatMap(responseValueKeys));
  const hasSavedData = !!provenance || Object.keys(stateContext.answers).some((key) => !hostResponseKeys.has(key));

  const storeDispatch = useStoreDispatch();
  const {
    updateProvenance, updateResponseBlockValidation, setReactiveAnswers,
  } = useStoreActions();
  const isAnalysis = useIsAnalysis();
  const onProvenanceChange = useCallback((provenanceGraph: TrrackedProvenance) => {
    if (isAnalysis) return;
    storeDispatch(updateProvenance({
      location: 'stimulus',
      identifier,
      provenanceGraph,
    }));
  }, [identifier, isAnalysis, storeDispatch, updateProvenance]);
  const setAnswer = useCallback(({
    status,
    provenanceGraph,
    answers: stimulusAnswers,
    reason,
    message,
  }: Parameters<StimulusParams<unknown>['setAnswer']>[0]) => {
    if (isAnalysis) return;
    storeDispatch(updateResponseBlockValidation({
      location: 'stimulus',
      identifier,
      status,
      values: stimulusAnswers,
      provenanceGraph,
      reason,
      message,
    }));

    storeDispatch(setReactiveAnswers(stimulusAnswers));
  }, [isAnalysis, setReactiveAnswers, storeDispatch, updateResponseBlockValidation, identifier]);

  const requestKey = `${identifier}:${reactPath}`;
  const { status: componentStatus, onReady: handleReady, onError: handleRuntimeError } = useAssetLoadStatus(requestKey);
  const assetStatus = !templateData ? 'loading' : !StimulusComponent ? 'error' : componentStatus;
  useAssetStatus(assetStatus);

  if (!templateData) {
    return null;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RestorationWarning
        component={identifier}
        visible={settled && hasSavedData && registrations.state === 0 && !(registrations.stateless > 0 && (!provenance || registrations.graph > 0))}
      />
      {StimulusComponent
        ? (
          <ErrorBoundary
            key={`${requestKey}:${restoreAttempt}`}
            onReady={handleReady}
            onError={handleRuntimeError}
            fallback={hasSavedData ? <RestorationError onRetry={() => setRestoreAttempt((value) => value + 1)} /> : <ResourceNotFound path={templatedPath} />}
          >
            <StudyStateContext.Provider value={stateContext}>
              <RevisitProvenanceProvider
                key={identifier}
                onProvenanceChange={onProvenanceChange}
                provenance={provenance}
                onGraphReady={registerGraph}
              >
                {(useTrrack) => (
                  <StimulusComponent
                    globalVariables={globalVariables}
                    registerGlobalStoreUpdater={registerGlobalStoreUpdater}
                    parameters={currentConfig.parameters}
                    setAnswer={setAnswer}
                    answers={answers}
                    provenanceState={provState}
                    useTrrack={useTrrack}
                  />
                )}
              </RevisitProvenanceProvider>
            </StudyStateContext.Provider>
          </ErrorBoundary>
        )
        : <ResourceNotFound email={studyConfig.uiConfig.contactEmail} path={templatedPath} />}
    </Suspense>
  );
}
