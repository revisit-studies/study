import { useParams } from 'react-router-dom';
import { useFlatSequence } from '../store/store';

export function useStudyId(): string {
  const { studyId } = useParams();

  return `${studyId}`;
}

export function useCurrentStep(): string | number {
  const { index } = useParams();

  const indexOrStep = parseInt(index || '0', 10);

  return Number.isNaN(indexOrStep) ? index as string : indexOrStep;
}

export function useCurrentComponent(): string {
  const currentStep = useCurrentStep();
  const flatSequence = useFlatSequence();
  return typeof currentStep === 'number' ? flatSequence[currentStep] : currentStep.replace('reviewer-', '');
}
