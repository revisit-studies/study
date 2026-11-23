import { useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getActiveGlobalStoreSubmissions } from '../globalStoreProvenance';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { useIsAnalysis } from './useIsAnalysis';
import { decryptIndex, encryptIndex } from '../../utils/encryptDecryptIndex';
import { parseTrialOrder } from '../../utils/parseTrialOrder';
import { useStudyConfig } from './useStudyConfig';
import { getSequenceFlatMap, findFuncBlock } from '../../utils/getSequenceFlatMap';
import { useStoreDispatch, useStoreActions, useStoreSelector } from '../store';
import { useOptionalWindowEvents } from './useWindowEvents';
import { useStorageEngine } from '../../storage/storageEngineHooks';

export function usePreviousStep() {
  const graph = useStoreSelector((state) => state.globalStoreGraph);
  const completed = useStoreSelector((state) => state.completed);
  const submitting = useStoreSelector((state) => state.globalStoreSubmitting);
  const answers = useStoreSelector((state) => state.answers);
  const currentStep = useCurrentStep();
  const { funcIndex } = useParams();
  const studyId = useStudyId();
  const navigate = useNavigate();
  const isAnalysis = useIsAnalysis();
  const studyConfig = useStudyConfig();
  const storeDispatch = useStoreDispatch();
  const { deleteDynamicBlockAnswers } = useStoreActions();
  const sequence = useStoreSelector((state) => state.sequence);
  const windowEvents = useOptionalWindowEvents();
  const { storageEngine } = useStorageEngine();
  const previousNavigationInFlight = useRef(false);

  // Status of the previous button. If true, the previous button should be disabled
  const isPreviousDisabled = typeof currentStep !== 'number' || isAnalysis || completed || !!submitting || (currentStep <= 0 && (!funcIndex || decryptIndex(funcIndex) <= 0));

  const buildSearch = useCallback(() => window.location.search, []);

  const persistDynamicArchive = useCallback(async () => {
    if (
      !funcIndex
      || isAnalysis
      || studyConfig.globalVariables
      || typeof currentStep !== 'number'
    ) return;
    const funcName = getSequenceFlatMap(sequence)[currentStep];
    const currentFuncIndex = decryptIndex(funcIndex);
    const matchesCurrentIteration = (key: string) => key.startsWith(`${funcName}_${currentStep}_`) && key.endsWith(`_${currentFuncIndex}`);
    const currentAnswers = storageEngine?.getCurrentParticipantDataSnapshot()?.answers ?? answers;
    const answersToPersist = Object.entries(currentAnswers).reduce<typeof currentAnswers>((nextAnswers, [key, answer]) => {
      if (!matchesCurrentIteration(key)) {
        nextAnswers[key] = answer;
        return nextAnswers;
      }
      const hasRecording = (answer.recordingSegments?.length ?? 0) > 0
        || !!answer.assetIdentifier
        || Object.keys(answer.recordingChunkKeys ?? {}).length > 0;
      if (hasRecording) {
        nextAnswers[key] = {
          ...answer,
          answer: {},
          endTime: -1,
          recordingArchived: true,
        };
      }
      return nextAnswers;
    }, {});
    if (storageEngine && Object.keys(answersToPersist).some((key) => matchesCurrentIteration(key) && answersToPersist[key].recordingArchived)) {
      await storageEngine.saveAnswers(answersToPersist);
    }
  }, [answers, currentStep, funcIndex, isAnalysis, sequence, storageEngine, studyConfig.globalVariables]);

  const navigatePreviousStep = useCallback(async () => {
    if (typeof currentStep !== 'number' || completed || submitting) {
      return;
    }

    if (studyConfig.globalVariables && !isAnalysis) {
      const active = getActiveGlobalStoreSubmissions(graph);
      const index = active.findIndex((entry) => entry.submission.answer.trialOrder === `${currentStep}${funcIndex ? `_${decryptIndex(funcIndex)}` : ''}`);
      const previous = index < 0 ? active.at(-1) : active[index - 1];
      if (!previous) return;
      const order = parseTrialOrder(previous.submission.answer.trialOrder);
      if (order.step === null) return;
      navigate(`/${studyId}/${encryptIndex(order.step)}${order.funcIndex !== null ? `/${encryptIndex(order.funcIndex)}` : ''}${buildSearch()}`);
      return;
    }
    const previousStep = currentStep - 1;
    const flatSequence = getSequenceFlatMap(sequence);

    // Dynamic block component
    if (funcIndex) {
      if (!isAnalysis) {
        // Delete current dynamic block component and go to previous during participant flow.
        const funcName = flatSequence[currentStep];
        const currentFuncIndex = decryptIndex(funcIndex);
        storeDispatch(deleteDynamicBlockAnswers({ currentStep, funcIndex: currentFuncIndex, funcName }));
      }

      // If we're at the first element of a dynamic block, exit the dynamic block
      const currentFuncIndex = decryptIndex(funcIndex);
      const previousFuncIndex = Object.entries(answers)
        .filter(([key, answer]) => key.startsWith(`${flatSequence[currentStep]}_${currentStep}_`) && !answer.recordingArchived)
        .reduce((maxIndex, [, answer]) => {
          const { funcIndex: answerFuncIndex } = parseTrialOrder(answer.trialOrder);
          return answerFuncIndex !== null && answerFuncIndex < currentFuncIndex ? Math.max(maxIndex, answerFuncIndex) : maxIndex;
        }, -1);
      if (previousFuncIndex >= 0) {
        navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(previousFuncIndex)}${buildSearch()}`);
        return;
      }
    }

    for (let stepIndex = previousStep; stepIndex >= 0; stepIndex -= 1) {
      const previousComponentId = flatSequence[stepIndex];
      const isDynamicBlock = findFuncBlock(previousComponentId, sequence);

      if (!isDynamicBlock) {
        navigate(`/${studyId}/${encryptIndex(stepIndex)}${buildSearch()}`);
        return;
      }

      const previousDynamicBlockIndex = Object.entries(answers)
        .filter(([key, answer]) => key.startsWith(`${previousComponentId}_${stepIndex}_`) && !answer.recordingArchived)
        .reduce((maxIndex, [, answer]) => {
          const { funcIndex: answerFuncIndex } = parseTrialOrder(answer.trialOrder);
          return answerFuncIndex !== null ? Math.max(maxIndex, answerFuncIndex) : maxIndex;
        }, -1);

      if (previousDynamicBlockIndex >= 0) {
        navigate(`/${studyId}/${encryptIndex(stepIndex)}/${encryptIndex(previousDynamicBlockIndex)}${buildSearch()}`);
        return;
      }
    }
  }, [answers, graph, completed, submitting, buildSearch, currentStep, deleteDynamicBlockAnswers, funcIndex, isAnalysis, navigate, sequence, storageEngine, storeDispatch, studyConfig.globalVariables, studyId]);

  const goToPreviousStep = useCallback(async () => {
    if (typeof currentStep !== 'number' || completed || submitting || previousNavigationInFlight.current) return;
    if (windowEvents?.visitFinalizing) return;
    previousNavigationInFlight.current = true;
    try {
      if (!windowEvents?.finalizeVisit) {
        await persistDynamicArchive();
        await navigatePreviousStep();
        return;
      }

      const saved = await windowEvents.finalizeVisit(persistDynamicArchive);
      if (saved) await navigatePreviousStep();
    } catch (error) {
      console.error('Failed to finalize screen recording before going to the previous task', error);
    } finally {
      previousNavigationInFlight.current = false;
    }
  }, [completed, currentStep, navigatePreviousStep, persistDynamicArchive, submitting, windowEvents]);

  return {
    isPreviousDisabled,
    goToPreviousStep,
  };
}
