import { StudyConfig } from '../parser/types';
import { Sequence } from '../store/types';

type SequenceLike = StudyConfig['sequence'] | Sequence;

export function filterSequenceByCondition(sequence: Sequence, condition?: string | null): Sequence {
  if (!condition) {
    return sequence;
  }

  const filterNode = (node: Sequence): Sequence | null => {
    if (node.condition && node.condition !== condition) {
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
