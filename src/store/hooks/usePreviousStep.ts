import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { useIsAnalysis } from './useIsAnalysis';
import { decryptIndex, encryptIndex } from '../../utils/encryptDecryptIndex';
import { parseTrialOrder } from '../../utils/parseTrialOrder';
import { useStudyConfig } from './useStudyConfig';
import { getSequenceFlatMap, findFuncBlock } from '../../utils/getSequenceFlatMap';
import { useStoreDispatch, useStoreActions, useStoreSelector } from '../store';

export function usePreviousStep() {
  const currentStep = useCurrentStep();
  const { funcIndex } = useParams();
  const studyId = useStudyId();
  const navigate = useNavigate();
  const isAnalysis = useIsAnalysis();
  const studyConfig = useStudyConfig();
  const storeDispatch = useStoreDispatch();
  const { deleteDynamicBlockAnswers } = useStoreActions();
  const answers = useStoreSelector((state) => state.answers);

  // Status of the previous button. If true, the previous button should be disabled
  const isPreviousDisabled = typeof currentStep !== 'number' || (currentStep <= 0 && (!funcIndex || decryptIndex(funcIndex) <= 0));

  const buildSearch = useCallback(() => window.location.search, []);

  const goToPreviousStep = useCallback(() => {
    if (typeof currentStep !== 'number') {
      return;
    }

    const previousStep = currentStep - 1;
    const flatSequence = getSequenceFlatMap(studyConfig.sequence);

    // Dynamic block component
    if (funcIndex) {
      if (!isAnalysis) {
        // Delete current dynamic block component and go to previous during participant flow.
        storeDispatch(deleteDynamicBlockAnswers({ currentStep, funcIndex: decryptIndex(funcIndex), funcName: flatSequence[currentStep] }));
      }

      // If we're at the first element of a dynamic block, exit the dynamic block
      if (decryptIndex(funcIndex) !== 0) {
        const previousFuncIndex = decryptIndex(funcIndex) - 1;
        navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(previousFuncIndex)}${buildSearch()}`);
        return;
      }
    }

    for (let stepIndex = previousStep; stepIndex >= 0; stepIndex -= 1) {
      const previousComponentId = flatSequence[stepIndex];
      const isDynamicBlock = findFuncBlock(previousComponentId, studyConfig.sequence);

      if (!isDynamicBlock) {
        navigate(`/${studyId}/${encryptIndex(stepIndex)}${buildSearch()}`);
        return;
      }

      const previousDynamicBlockIndex = Object.entries(answers)
        .filter(([key]) => key.startsWith(`${previousComponentId}_${stepIndex}_`))
        .reduce((maxIndex, [, answer]) => {
          const { funcIndex: answerFuncIndex } = parseTrialOrder(answer.trialOrder);
          return answerFuncIndex !== null ? Math.max(maxIndex, answerFuncIndex) : maxIndex;
        }, -1);

      if (previousDynamicBlockIndex >= 0) {
        navigate(`/${studyId}/${encryptIndex(stepIndex)}/${encryptIndex(previousDynamicBlockIndex)}${buildSearch()}`);
        return;
      }
    }
  }, [answers, buildSearch, currentStep, deleteDynamicBlockAnswers, funcIndex, isAnalysis, navigate, storeDispatch, studyConfig, studyId]);

  return {
    isPreviousDisabled,
    goToPreviousStep,
  };
}
