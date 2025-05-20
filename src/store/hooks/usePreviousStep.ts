import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCurrentStep, useStudyId } from '../../routes/utils';
import { useIsAnalysis } from './useIsAnalysis';
import { decryptIndex, encryptIndex } from '../../utils/encryptDecryptIndex';
import { useStoreSelector } from '../store';
import { getSequenceFlatMap } from '../../utils/getSequenceFlatMap';
import { useStudyConfig } from './useStudyConfig';

export function usePreviousStep() {
  const currentStep = useCurrentStep();
  const { funcIndex } = useParams();
  const studyId = useStudyId();
  const navigate = useNavigate();
  const isAnalysis = useIsAnalysis();
  const sequence = useStoreSelector((state) => state.sequence);
  const flatSequence = getSequenceFlatMap(sequence);
  const studyConfig = useStudyConfig();

  // Status of the previous button. If false, the previous button should be disabled
  const isPreviousDisabled = typeof currentStep !== 'number' || isAnalysis || currentStep <= 0;

  const goToPreviousStep = useCallback(() => {
    if (typeof currentStep !== 'number') {
      return;
    }

    const previousStep = currentStep - 1;

    if (funcIndex) {
      // If we're at the first element of a dynamic block, exit the dynamic block
      if (decryptIndex(funcIndex) === 0) {
        navigate(`/${studyId}/${encryptIndex(previousStep)}${window.location.search}`);
      } else {
        navigate(`/${studyId}/${encryptIndex(currentStep)}/${encryptIndex(decryptIndex(funcIndex) - 1)}${window.location.search}`);
      }
    } else {
      navigate(`/${studyId}/${encryptIndex(previousStep)}${window.location.search}`);
    }
  }, [currentStep, funcIndex, navigate, studyId, sequence, flatSequence, studyConfig.components]);

  return {
    isPreviousDisabled,
    goToPreviousStep,
  };
}
