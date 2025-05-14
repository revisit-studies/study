import { useParams } from 'react-router';
import { useFlatSequence, useStoreSelector } from '../store';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';
import { decryptIndex } from '../../utils/encryptDecryptIndex';

export function useStoredAnswer() {
  const { funcIndex } = useParams();
  const participantSequence = useFlatSequence();

  const currentStep = useCurrentStep();
  const currentComponent = useCurrentComponent();
  const identifier = funcIndex && typeof currentStep === 'number' ? `${participantSequence[currentStep]}_${currentStep}_${currentComponent}_${decryptIndex(funcIndex)}` : `${currentComponent}_${currentStep}`;
  const answer = useStoreSelector((state) => state.answers[identifier]);
  return answer;
}
