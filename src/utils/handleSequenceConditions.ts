import { StudyConfig } from '../parser/types';
import { ParticipantData } from '../storage/types';
import { Sequence } from '../store/types';

type SequenceLike = StudyConfig['sequence'] | Sequence;

export function parseConditionParam(condition?: string | string[] | null): string[] {
  if (!condition) {
    return [];
  }
  if (Array.isArray(condition)) {
    return condition.map((c) => c.trim()).filter(Boolean);
  }
  return condition.split(',').map((c) => c.trim()).filter(Boolean);
}

export function filterSequenceByCondition(sequence: Sequence, condition?: string | string[] | null): Sequence {
  const conditions = parseConditionParam(condition);

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

export function getSequenceConditions(sequence: SequenceLike): string[] {
  const conditions = new Set<string>();

  const collect = (node: SequenceLike) => {
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
