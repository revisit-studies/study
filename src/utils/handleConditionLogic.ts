import { StudyConfig } from '../parser/types';
import { ParticipantData } from '../storage/types';
import { Sequence } from '../store/types';

export function parseConditionParam(condition?: string | string[] | null): string[] {
  if (!condition) {
    return [];
  }
  if (Array.isArray(condition)) {
    return condition.map((c) => c.trim()).filter(Boolean);
  }
  // multiple conditions are separated by commas
  // e.g. ?condition=condition1,condition2
  return condition.split(',').map((c) => c.trim()).filter(Boolean);
}

export function resolveParticipantConditions({
  urlCondition,
  participantConditions,
  participantSearchParamCondition,
  allowUrlOverride,
}: {
  urlCondition?: string | string[] | null;
  participantConditions?: string[] | null;
  participantSearchParamCondition?: string | string[] | null;
  allowUrlOverride: boolean;
}): string[] {
  const parsedUrlCondition = parseConditionParam(urlCondition);

  if (allowUrlOverride && parsedUrlCondition.length > 0) {
    return parsedUrlCondition;
  }

  return parseConditionParam(participantConditions ?? participantSearchParamCondition);
}

export function filterSequenceByCondition(sequence: Sequence, condition?: string | string[] | null): Sequence {
  const conditions = parseConditionParam(condition);

  if (conditions.length === 0) {
    return sequence;
  }

  const filterNode = (node: Sequence): Sequence | null => {
    const isConditionalNode = Boolean(node.conditional && node.id != null);
    const isMatchedCondition = !isConditionalNode || conditions.includes(node.id as string);

    // If a conditional node is not selected, exclude its entire subtree.
    // This enforces hierarchical conditions where nested conditions require their parent.
    if (isConditionalNode && !isMatchedCondition) {
      return null;
    }

    const filteredComponents: Sequence['components'] = [];
    for (const component of node.components) {
      if (typeof component === 'string') {
        filteredComponents.push(component);
      } else {
        const filteredChild = filterNode(component);
        if (filteredChild) {
          filteredComponents.push(filteredChild);
        }
      }
    }

    return { ...node, components: filteredComponents };
  };

  return filterNode(sequence) ?? { ...sequence, components: [] };
}

export function getSequenceConditions(sequence: StudyConfig['sequence'] | Sequence): string[] {
  const conditions = new Set<string>();

  const collect = (node: StudyConfig['sequence'] | Sequence | null | undefined) => {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (node.conditional && node.id) {
      conditions.add(node.id);
    }

    // Get conditions from the nested sequences
    if ('components' in node && Array.isArray(node.components)) {
      node.components.forEach((component) => {
        if (component && typeof component !== 'string') {
          collect(component);
        }
      });
    }
  };

  collect(sequence);
  return Array.from(conditions);
}

export function getConditionParticipantCounts(participants: ParticipantData[]): Record<string, number> {
  const counts: Record<string, number> = {};

  participants.forEach((participant) => {
    const conditions = parseConditionParam(participant.conditions ?? participant.searchParams?.condition);
    if (conditions.length === 0) {
      counts.default = (counts.default || 0) + 1;
      return;
    }
    conditions.forEach((condition) => {
      counts[condition] = (counts[condition] || 0) + 1;
    });
  });

  return counts;
}
