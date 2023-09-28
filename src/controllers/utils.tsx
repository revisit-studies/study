import { useCurrentStep } from '../routes';
import { OrderContainerComponent } from '../parser/types';
import { useAppSelector } from '../store/store';

export function useNextTrialId(currentTrial: string | null) {
  const studyConfig = useAppSelector((state) => state.trrackedSlice.orderConfig);
  const step = useCurrentStep();
  const stepConfig = studyConfig.components[step];

  if (!stepConfig || stepConfig.type !== 'container') return null;

  const { order } = (stepConfig as OrderContainerComponent);

  if (!order) return null;

  const idx = order.findIndex((t) => t === currentTrial);

  if (idx === -1) return null;

  return order[idx + 1] || null;
}
