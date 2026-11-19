import {
  consumesCapacity, isStageParticipantLimitEnabled, SequenceAssignment, StageInfo,
} from '../storage/engines/types';
import { getStageCombinationTargets } from '../storage/engines/utils/stageAllocation';
import { getSequenceAssignmentStatus } from '../storage/participantStatus';

export interface ConditionLimitSummary {
  /** The stored between-subjects combination key. */
  key: string;
  /** A readable description such as `color: red, size: large`. */
  label: string;
  /** Maximum participants admission allows in this condition (0 when disabled). */
  target: number;
  /** Participants currently holding a slot (in progress or completed). */
  enrolled: number;
  completed: number;
  enabled: boolean;
}

export interface ParticipantLimitSummary {
  maxParticipants: number;
  /** Participants currently holding a slot (in progress or completed). */
  enrolled: number;
  completed: number;
  /** True once no further participant can be admitted to the current stage. */
  full: boolean;
  conditions: ConditionLimitSummary[];
}

/** Turns a between-subjects combination key (a JSON list of `[factor, level]` pairs) into readable text. */
export function formatCombinationKey(key: string) {
  try {
    const pairs = JSON.parse(key) as [string, unknown][];
    return pairs.map(([factor, level]) => `${factor}: ${typeof level === 'string' ? level : JSON.stringify(level)}`).join(', ');
  } catch {
    return key;
  }
}

/**
 * Summarizes the current stage's participant limit, overall and per between-subjects condition,
 * using the same targets that admission enforces. Returns null when the stage has no enforced limit.
 */
export function summarizeParticipantLimits(
  stage: StageInfo | undefined,
  assignments: SequenceAssignment[],
  conditionKeys: string[],
): ParticipantLimitSummary | null {
  if (!stage || !isStageParticipantLimitEnabled(stage)) return null;

  const inStage = assignments.filter((assignment) => assignment.stage === stage.stageName);
  const count = (items: SequenceAssignment[]) => ({
    enrolled: items.filter(consumesCapacity).length,
    completed: items.filter((assignment) => getSequenceAssignmentStatus(assignment) === 'completed').length,
  });
  const overall = count(inStage);

  const assignmentMode = stage.participantAssignmentMode ?? (stage.desiredParticipantsByCombination ? 'manual' : 'even');
  const manualTargets = assignmentMode === 'manual'
    ? stage.manualDesiredParticipantsByCombination ?? stage.desiredParticipantsByCombination
    : undefined;
  const disabled = stage.disabledBetweenSubjectsCombinations ?? [];
  const targets = conditionKeys.length > 0
    ? getStageCombinationTargets(stage.maxParticipants, conditionKeys, manualTargets, disabled) ?? {}
    : {};

  const conditions = conditionKeys.map((key) => ({
    key,
    label: formatCombinationKey(key),
    target: targets[key] ?? 0,
    enabled: !disabled.includes(key),
    ...count(inStage.filter((assignment) => assignment.betweenSubjectsCombinationKey === key)),
  }));

  const enabledConditions = conditions.filter((condition) => condition.enabled);
  const full = overall.enrolled >= stage.maxParticipants
    || (conditions.length > 0 && enabledConditions.every((condition) => condition.enrolled >= condition.target));

  return {
    maxParticipants: stage.maxParticipants, ...overall, full, conditions,
  };
}
