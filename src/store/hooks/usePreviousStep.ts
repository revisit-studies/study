import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { useIsAnalysis } from './useIsAnalysis';
import { decryptIndex, encryptIndex } from '../../utils/encryptDecryptIndex';
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

  // Status of the previous button. If false, the previous button should be disabled
  const isPreviousDisabled = typeof currentStep !== 'number' || isAnalysis || currentStep <= 0;

  const goToPreviousStep = useCallback(() => {
    if (typeof currentStep !== 'number') {
      return;
    }

    const previousStep = currentStep - 1;
    const flatSequence = getSequenceFlatMap(studyConfig.sequence);

    // Dynamic block component
    if (funcIndex) {
      // Delete current dynamic block component and go to previous
      storeDispatch(deleteDynamicBlockAnswers({ currentStep, funcIndex: decryptIndex(funcIndex), funcName: flatSequence[currentStep] }));

      // If we're at the first element of a dynamic block, exit the dynamic block
      if (decryptIndex(funcIndex) !== 0) {
        navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(decryptIndex(funcIndex) - 1)}${window.location.search}`);
        return;
      }
    }
    const previousComponentId = flatSequence[previousStep];
    // Check if previous component is a dynamic block
    const isDynamicBlock = findFuncBlock(previousComponentId, studyConfig.sequence);

    if (isDynamicBlock) {
      // Find the last component that has been answered in the dynamic block
      const dynamicBlockAnswers = Object.keys(answers).filter((key) => key.startsWith(`${previousComponentId}_${previousStep}_`));
      const previousDynamicBlockIndex = dynamicBlockAnswers.length - 1;
      // Navigate to the last answered index in the dynamic block
      navigate(`/${studyId}/${encryptIndex(previousStep)}/${encryptIndex(previousDynamicBlockIndex)}${window.location.search}`);
    } else {
      navigate(`/${studyId}/${encryptIndex(previousStep)}${window.location.search}`);
    }
  }, [currentStep, funcIndex, navigate, studyId, studyConfig, storeDispatch, deleteDynamicBlockAnswers, answers]);

  return {
    isPreviousDisabled,
    goToPreviousStep,
  };
}
