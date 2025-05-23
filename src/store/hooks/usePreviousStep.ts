import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { useIsAnalysis } from './useIsAnalysis';
import { decryptIndex, encryptIndex } from '../../utils/encryptDecryptIndex';
import { useStudyConfig } from './useStudyConfig';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';

export function usePreviousStep() {
  const currentStep = useCurrentStep();
  const { funcIndex } = useParams();
  const studyId = useStudyId();
  const navigate = useNavigate();
  const isAnalysis = useIsAnalysis();
  const studyConfig = useStudyConfig();

  // Status of the previous button. If false, the previous button should be disabled
  const isPreviousDisabled = typeof currentStep !== 'number' || isAnalysis || currentStep <= 0;

  const goToPreviousStep = useCallback(() => {
    if (typeof currentStep !== 'number') {
      return;
    }

    const previousStep = currentStep - 1;
    const flatSequence = getSequenceFlatMap(studyConfig.sequence);
    const currentComponentId = flatSequence[currentStep];
    const currentComponent = studyConfig.components[currentComponentId];

    if (funcIndex) {
      // If we're at the first element of a dynamic block, exit the dynamic block
      if (decryptIndex(funcIndex) === 0) {
        navigate(`/${studyId}/${encryptIndex(previousStep)}${window.location.search}`);
      } else {
        // Stay in the dynamic block but go to previous element
        navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(decryptIndex(funcIndex) - 1)}${window.location.search}`);
      }
    } else if (currentComponent && 'order' in currentComponent && currentComponent.order === 'dynamic') {
      // If current component is a dynamic block, check if next component has previousButton
      if (currentStep + 1 < flatSequence.length) {
        const nextComponent = flatSequence[currentStep + 1];
        const nextConfig = studyConfig.components[nextComponent];
        if (nextConfig?.previousButton) {
          navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(0)}${window.location.search}`);
        }
      }
    } else {
      navigate(`/${studyId}/${encryptIndex(previousStep)}${window.location.search}`);
    }
  }, [currentStep, funcIndex, navigate, studyId, studyConfig]);

  return {
    isPreviousDisabled,
    goToPreviousStep,
  };
}
