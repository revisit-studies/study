import { OrderObject } from '../parser/types';
import { Sequence } from '../store/types';
import { deepCopy } from './deepCopy';

export function getSequenceFlatMap<T extends Sequence | OrderObject>(sequence: T): string[] {
  return sequence.components.flatMap((component) => (typeof component === 'string' ? component : getSequenceFlatMap(component)));
}

export function getSubSequence<T extends Sequence | OrderObject>(sequence: T, path: string): T {
  const pathComponents = path.split('-');
  let subSequence = deepCopy(sequence);

  pathComponents.forEach((pathComponent) => {
    if (pathComponent === 'root') {
      return;
    }
    subSequence = subSequence.components[+pathComponent] as T;
  });

  return subSequence;
}

export function findTaskIndexInSequence(sequence: Sequence, step: string, startIndex: number, requestedPath: string, currentPath: string): number {
  let index = 0;

  for (let i = 0; i < sequence.components.length; i += 1) {
    const component = sequence.components[i];
    if (typeof component === 'string') {
      if (requestedPath === currentPath && component === step && i >= startIndex) {
        return index;
      }
      index += 1;
    } else {
      index += findTaskIndexInSequence(component, step, startIndex, requestedPath, `${currentPath}-${i}`);
      if (requestedPath === `${currentPath}-${i}`) {
        return index - 1;
      }
    }
  }

  return index;
}
