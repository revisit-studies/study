import { ComponentBlock } from '../parser/types';
import { Sequence } from '../store/types';

export function getSequenceFlatMap<T extends Sequence | ComponentBlock>(sequence: T): string[] {
  return sequence.components.flatMap((component) => (typeof component === 'string' ? component : getSequenceFlatMap(component)));
}
