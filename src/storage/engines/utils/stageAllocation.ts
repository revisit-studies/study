// Splits a stage maximum into a target participant count for each
// between-subjects combination. Admission enforces these targets and the stage
// management view displays them, so both must use this one calculation.
//
// Combinations with an explicit target keep it, even when they are disabled, so
// an admin who sets one keeps that reservation. The remaining maximum is split
// evenly across the other enabled combinations, with any remainder going to the
// earliest ones. Disabled combinations without an explicit target take no new
// participants, so they get a target of 0 rather than stranding part of the
// maximum where nobody can be assigned.
//
// Returns undefined when the stage has no maximum, because then there are no
// targets to enforce.
export function getStageCombinationTargets(
  maxParticipants: number | undefined,
  combinationKeys: string[],
  explicitTargetsByCombination: Record<string, number> | undefined,
  disabledCombinationKeys: string[] = [],
): Record<string, number> | undefined {
  if (maxParticipants === undefined) {
    return undefined;
  }

  const explicitTargets = explicitTargetsByCombination ?? {};
  const explicitTotal = combinationKeys.reduce(
    (total, key) => total + (explicitTargets[key] ?? 0),
    0,
  );
  const disabledKeys = new Set(disabledCombinationKeys);
  const evenlySplitKeys = combinationKeys.filter((key) => (
    !Object.hasOwn(explicitTargets, key) && !disabledKeys.has(key)
  ));
  const remainingCount = Math.max(maxParticipants - explicitTotal, 0);
  const countPerKey = evenlySplitKeys.length === 0
    ? 0
    : Math.floor(remainingCount / evenlySplitKeys.length);
  const remainder = evenlySplitKeys.length === 0
    ? 0
    : remainingCount % evenlySplitKeys.length;

  return Object.fromEntries(combinationKeys.map((key) => {
    if (Object.hasOwn(explicitTargets, key)) {
      return [key, explicitTargets[key]];
    }

    const evenlySplitIndex = evenlySplitKeys.indexOf(key);
    if (evenlySplitIndex === -1) {
      return [key, 0];
    }

    return [key, countPerKey + (evenlySplitIndex < remainder ? 1 : 0)];
  }));
}
