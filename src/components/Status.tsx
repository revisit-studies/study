import { useCurrentStep } from "../routes";
import { useAppSelector } from "../store";

export function Status() {
  const currentStep = useCurrentStep();
  const { steps } = useAppSelector((state) => state.study);

  const status = steps[currentStep].complete ? "complete" : "incomplete";

  return <div>{status}</div>;
}
