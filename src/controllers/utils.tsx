import { useCurrentStep } from '../routes';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { ContainerComponent } from '../parser/types';

export function useNextTrialId(currentTrial: string | null) {
  const studyConfig = useStudyConfig();
  const step = useCurrentStep();
  const stepConfig = studyConfig.components[step];

  if (!stepConfig || stepConfig.type !== 'container') return null;

  const { order } = (stepConfig as ContainerComponent);

  if (!order) return null;

  const idx = order.findIndex((t) => t === currentTrial);

  if (idx === -1) return null;

  return order[idx + 1] || null;
}
