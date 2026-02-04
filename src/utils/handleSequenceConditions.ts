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

// TODO: travese first
export function filterSequenceByCondition(sequence: Sequence, condition?: string | string[] | null): Sequence {
  const conditions = parseConditionParam(condition);

  // default condition
  if (conditions.length === 0) {
    return sequence;
  }

  const filterNode = (node: Sequence): Sequence | null => {
    if (node.condition && !conditions.includes(node.condition)) {
      return null;
    }

    const filteredComponents: Sequence['components'] = [];

    node.components.forEach((component) => {
      if (typeof component === 'string') {
        filteredComponents.push(component);
        return;
      }

      const filteredChild = filterNode(component);
      if (filteredChild) {
        filteredComponents.push(filteredChild);
      }
    });

    if (node.condition && !conditions.includes(node.condition)) {
      return filteredComponents.length > 0
        ? { ...node, components: filteredComponents }
        : null;
    }

    return {
      ...node,
      components: filteredComponents,
    };
  };

  const filtered = filterNode(sequence);
  if (!filtered) {
    return { ...sequence, components: [] };
  }

  return filtered;
}

// Get all conditions used in a sequence by traversing sequence in the study config
// TODO: double check traverse logic
export function getSequenceConditions(sequence: StudyConfig['sequence'] | Sequence): string[] {
  const conditions = new Set<string>();

  const collect = (node: StudyConfig['sequence'] | Sequence) => {
    if ('condition' in node && node.condition) {
      conditions.add(node.condition);
    }

    if ('components' in node && Array.isArray(node.components)) {
      node.components.forEach((component) => {
        if (typeof component !== 'string') {
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
    const conditions = parseConditionParam(participant.searchParams?.condition);
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
