import { useAppSelector } from '../store';
import { isContainerComponent, isProcessedContainerComponent } from '../../parser/types';

/**
 * Get total number of trials and completed trials for given trial group.
 * Useful for progress calculation.
 * Can write similar function for overall progress
 */

export function useCompletedTrialMetric(trialName: string) {
  const { config } = useAppSelector((state) => state.unTrrackedSlice);
  const trialConfig = config?.components[trialName];

  if (trialConfig && isContainerComponent(trialConfig)) {
    const totalTrials = trialConfig.order.length;
    const totalCompleted = Object.values(trialConfig.components[trialName]).filter(
      (t) => t.complete
    ).length;

    return {
      name: trialName,
      totalTrials,
      completedTrials: totalCompleted,
    };
  }
  return null;
}
