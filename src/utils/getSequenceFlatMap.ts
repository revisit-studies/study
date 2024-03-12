import { OrderObject } from '../parser/types';
import { Sequence } from '../store/types';

export function getSequenceFlatMap<T extends Sequence | OrderObject>(sequence: T): string[] {
  return sequence.components.flatMap((component) => (typeof component === 'string' ? component : getSequenceFlatMap(component)));
}
