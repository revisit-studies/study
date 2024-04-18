import { ComponentBlock } from '../parser/types';
import { Sequence } from '../store/types';

export function getSequenceFlatMap<T extends Sequence | ComponentBlock>(sequence: T): string[] {
  return sequence.components.flatMap((component) => (typeof component === 'string' ? component : getSequenceFlatMap(component)));
}

function _findBlockForStep(sequence: Sequence, step: number, distance: number): { currentBlock: Sequence, firstIndex: number, lastIndex: number } | number {
  let componentsSeen = 0;
  for (let i = 0; i < sequence.components.length; i += 1) {
    const component = sequence.components[i];
    if (typeof component === 'string') {
      if (step === distance + componentsSeen) {
        return { currentBlock: sequence, firstIndex: distance, lastIndex: distance + sequence.components.length - 1 };
      }
      componentsSeen += 1;
    } else {
      const result = _findBlockForStep(component, step, distance + componentsSeen);
      if (typeof result === 'number') {
        componentsSeen += result;
      } else {
        return result;
      }
    }
  }
  return componentsSeen;
}

export function findBlockForStep(sequence: Sequence, step: number) {
  const toReturn = _findBlockForStep(sequence, step, 0);
  return typeof toReturn === 'number' ? null : toReturn;
}
