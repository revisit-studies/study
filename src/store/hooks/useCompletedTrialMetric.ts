import { useAppSelector } from '../store';

/**
 * Get total number of trials and completed trials for given trial group.
 * Useful for progress calculation.
 * Can write similar function for overall progress
 */ 

export function useCompletedTrialMetric(trialName: string) {
  const { config } = useAppSelector((state) => state.unTrrackedSlice);
  const trialConfig = config?.components[trialName];

  return null;
}
