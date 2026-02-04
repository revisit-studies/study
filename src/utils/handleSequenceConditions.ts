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

export function filterSequenceByCondition(sequence: Sequence, condition?: string | string[] | null): Sequence {
  const conditions = parseConditionParam(condition);

  if (conditions.length === 0) {
    return sequence;
  }

  const filterNode = (node: Sequence): Sequence | null => {
    const isMatchedCondition = !node.condition || conditions.includes(node.condition);

    const filteredComponents: Sequence['components'] = [];
    for (const component of node.components) {
      if (typeof component === 'string') {
        if (isMatchedCondition) {
          filteredComponents.push(component);
        }
      } else {
        const filteredChild = filterNode(component);
        if (filteredChild) {
          filteredComponents.push(filteredChild);
        }
      }
    }

    if (!isMatchedCondition && filteredComponents.length === 0) {
      return null;
    }

    return { ...node, components: filteredComponents };
  };

  return filterNode(sequence) ?? { ...sequence, components: [] };
}

export function getSequenceConditions(sequence: StudyConfig['sequence'] | Sequence): string[] {
  const conditions = new Set<string>();

  const collect = (node: StudyConfig['sequence'] | Sequence) => {
    if (node.condition) {
      conditions.add(node.condition);
    }

    // Get conditions from the nested sequences
    if ('components' in node) {
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
