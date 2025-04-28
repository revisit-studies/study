import type { ComponentBlockWithOrderPath } from '../components/interface/StepsPanel';
import { ComponentBlock, DynamicBlock, StudyConfig } from '../parser/types';
import { isDynamicBlock } from '../parser/utils';
import { Sequence } from '../store/types';

export function getSequenceFlatMap<T extends Sequence | StudyConfig['sequence']>(sequence: T): string[] {
  return isDynamicBlock(sequence) ? [sequence.id] : sequence.components.flatMap((component) => (typeof component === 'string' ? component : getSequenceFlatMap(component)));
}

export function findAllFuncBlocks(sequence: StudyConfig['sequence']): DynamicBlock[] {
  return isDynamicBlock(sequence) ? [sequence] : sequence.components.flatMap((component) => (typeof component === 'string' ? [] : findAllFuncBlocks(component)));
}

export function findFuncBlock(name: string, sequence: StudyConfig['sequence']): (DynamicBlock | undefined) {
  const allFuncBlocks = findAllFuncBlocks(sequence);
  return allFuncBlocks.find((funcBlock) => funcBlock.id === name);
}

export function getSequenceFlatMapWithInterruptions(sequence: StudyConfig['sequence']): string[] {
  if (isDynamicBlock(sequence)) {
    return [];
  }

  return [
    ...sequence.components.flatMap((component) => (typeof component === 'string' ? component : (isDynamicBlock(component) ? [] : getSequenceFlatMapWithInterruptions(component)))),
    ...sequence.interruptions?.flatMap((interruption) => interruption.components) || [],
  ];
}

type SkipConditionWithExtents = {
  currentBlock: Sequence;
  firstIndex: number;
  lastIndex: number;
};

function _findBlockForStep(sequence: Sequence, pathOrStep: string | number, distance: number): (SkipConditionWithExtents[]) | number {
  let componentsSeen = 0;
  for (let i = 0; i < sequence.components.length; i += 1) {
    const component = sequence.components[i];
    if (typeof component === 'string') {
      if (typeof pathOrStep === 'number' && pathOrStep === (distance + componentsSeen)) {
        return [{
          currentBlock: sequence,
          firstIndex: distance,
          lastIndex: distance + getSequenceFlatMap(sequence).length - 1,
        }];
      }
      if (typeof pathOrStep === 'string' && sequence.orderPath === pathOrStep) {
        return [{
          currentBlock: sequence,
          firstIndex: distance,
          lastIndex: distance + getSequenceFlatMap(sequence).length - 1,
        }];
      }
      componentsSeen += 1;
    } else {
      const result = _findBlockForStep(component, pathOrStep, distance + componentsSeen);
      if (typeof result === 'number') {
        componentsSeen += result;
      } else {
        const newParentBlock = { currentBlock: sequence, firstIndex: distance, lastIndex: result[0].lastIndex };
        return [...result, newParentBlock];
      }
    }
  }
  return componentsSeen;
}

export function findBlockForStep(sequence: Sequence, pathOrStep: string | number) {
  const toReturn = _findBlockForStep(sequence, pathOrStep, 0);
  return typeof toReturn === 'number' ? null : toReturn;
}

function _findIndexOfBlock(sequence: Sequence, to: string, distance: number): { found: boolean, distance: number } {
  if (sequence.id === to) {
    return { found: true, distance };
  }
  let componentsSeen = 0;
  for (let i = 0; i < sequence.components.length; i += 1) {
    const component = sequence.components[i];
    if (typeof component === 'string') {
      componentsSeen += 1;
    } else {
      const result = _findIndexOfBlock(component, to, distance + componentsSeen);
      if (result.found) {
        return result;
      }
      componentsSeen += result.distance;
    }
  }
  return { found: false, distance: componentsSeen };
}

export function findIndexOfBlock(sequence: Sequence, to: string): number {
  const toReturn = _findIndexOfBlock(sequence, to, 0);
  return toReturn.found ? toReturn.distance : -1;
}

export function configSequenceToUniqueTrials(sequence: ComponentBlock | DynamicBlock, orderPath = 'root'): { componentName: string, orderPath: string, timesSeenInBlock: number }[] {
  if (isDynamicBlock(sequence)) {
    return [];
  }

  const result: { componentName: string, orderPath: string, timesSeenInBlock: number }[] = [];
  const componentsSeen: Record<string, number> = {};
  sequence.components.forEach((component, index) => {
    if (typeof component === 'string') {
      result.push({ componentName: component, orderPath, timesSeenInBlock: componentsSeen[component] || 0 });
      componentsSeen[component] = componentsSeen[component] ? componentsSeen[component] + 1 : 1;
    } else {
      result.push(...configSequenceToUniqueTrials(component, `${orderPath}-${index}`));
    }
  });
  return result;
}

export function addPathToComponentBlock(order: StudyConfig['sequence'] | ComponentBlockWithOrderPath | string, orderPath: string): ComponentBlockWithOrderPath | string {
  if (typeof order === 'string') {
    return order;
  }
  if (isDynamicBlock(order)) {
    return { ...order, orderPath, components: [] };
  }
  return {
    ...order, orderPath, order: order.order, components: order.components.map((o, i) => addPathToComponentBlock(o, `${orderPath}-${i}`)),
  };
}
