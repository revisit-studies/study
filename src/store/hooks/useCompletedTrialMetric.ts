import { useAppSelector } from "..";
import { isTrialsComponent } from "../../parser/types";

/**
 * Get total number of trials and completed trials for given trial group.
 * Useful for progress calculation.
 * Can write similar function for overall progress
 */

export function useCompletedTrialMetric(trialName: string) {
  const { config, trials } = useAppSelector((state) => state.study);
  const trialConfig = config?.components[trialName];

  if (trialConfig && isTrialsComponent(trialConfig)) {
    const totalTrials = trialConfig.order.length;
    const totalCompleted = Object.values(trials[trialName]).filter(
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
