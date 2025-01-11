import { useParams } from 'react-router-dom';
import { useFlatSequence } from '../store/store';
import { decryptIndex } from '../utils/encryptDecryptIndex';

export function useStudyId(): string {
  const { studyId } = useParams();

  return `${studyId}`;
}

export function useCurrentStep() {
  const { index } = useParams();
  if (index === undefined) {
    return 0;
  }

  if (index.startsWith('reviewer-')) {
    return index;
  }

  return decryptIndex(index);
}

export function useCurrentComponent(): string {
  const currentStep = useCurrentStep();
  const flatSequence = useFlatSequence();
  return typeof currentStep === 'number' ? flatSequence[currentStep] : currentStep.replace('reviewer-', '');
}
