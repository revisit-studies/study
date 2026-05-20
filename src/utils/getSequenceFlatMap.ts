import {
  DynamicBlock, FactorSequence, StudyConfig,
} from '../parser/types';
import { isDynamicBlock, isFactorSequence, isFactorSequenceReference } from '../parser/utils';
import { Sequence } from '../store/types';

export function getSequenceFlatMap<T extends Sequence | StudyConfig['sequence']>(sequence: T): string[] {
  if (isDynamicBlock(sequence) || isFactorSequence(sequence)) {
    return [sequence.id];
  }

  if (isFactorSequenceReference(sequence)) {
    return [sequence.id ?? sequence.factor];
  }

  return sequence.components.flatMap((component) => (typeof component === 'string' ? component : getSequenceFlatMap(component)));
}

function findAllFuncBlocks(sequence: StudyConfig['sequence']): DynamicBlock[] {
  return isDynamicBlock(sequence) ? [sequence] : isFactorSequence(sequence) || isFactorSequenceReference(sequence) ? [] : sequence.components.flatMap((component) => (typeof component === 'string' ? [] : findAllFuncBlocks(component)));
}

export function findAllFactorSequences(sequence: StudyConfig['sequence']): FactorSequence[] {
  return isFactorSequence(sequence) ? [sequence] : isDynamicBlock(sequence) || isFactorSequenceReference(sequence) ? [] : sequence.components.flatMap((component) => (typeof component === 'string' ? [] : findAllFactorSequences(component)));
}

export function findFuncBlock(name: string, sequence: StudyConfig['sequence']): (DynamicBlock | undefined) {
  const allFuncBlocks = findAllFuncBlocks(sequence);
  return allFuncBlocks.find((funcBlock) => funcBlock.id === name);
}

export function getSequenceFlatMapWithInterruptions(sequence: StudyConfig['sequence']): string[] {
  if (isDynamicBlock(sequence) || isFactorSequence(sequence) || isFactorSequenceReference(sequence)) {
    return [];
  }

  return [
    ...sequence.components.flatMap((component) => (typeof component === 'string' ? component : (isDynamicBlock(component) || isFactorSequence(component) || isFactorSequenceReference(component) ? [] : getSequenceFlatMapWithInterruptions(component)))),
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

export function addPathToComponentBlock(order: StudyConfig['sequence'] | Sequence | string, orderPath: string): Sequence | string {
  if (typeof order === 'string') {
    return order;
  }
  if (isDynamicBlock(order)) {
    return {
      ...order, orderPath, components: [], skip: [], interruptions: [],
    };
  }
  if (isFactorSequence(order)) {
    return {
      ...order, order: order.order ?? 'fixed', orderPath, components: [], skip: [], interruptions: [],
    };
  }
  if (isFactorSequenceReference(order)) {
    return {
      id: order.id ?? order.factor, order: order.order ?? 'fixed', orderPath, components: [], skip: [], interruptions: [],
    };
  }
  return {
    ...order,
    orderPath,
    order: order.order,
    components: order.components.map((o, i) => addPathToComponentBlock(o, `${orderPath}-${i}`)),
    skip: order.skip || [],
    interruptions: order.interruptions || [],
  };
}
