import { useCurrentStep } from '../routes';
import { useAppSelector } from '../store';

export function Status() {
  const currentStep = useCurrentStep();
  const { steps } = useAppSelector((state) => state.unTrrackedSlice);

  const status =
    steps[currentStep] && steps[currentStep].complete
      ? 'complete'
      : 'incomplete';

  return <div>{status}</div>;
}
