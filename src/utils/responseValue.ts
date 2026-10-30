import type { Response } from '../parser/types';
import type { StoredAnswer } from '../store/types';

export function isResponseAnswered(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0 && value.some(isResponseAnswered);
  if (typeof value === 'object') {
    const values = Object.values(value);
    return values.length > 0 && values.some(isResponseAnswered);
  }
  return true;
}

export function isResponseDontKnowSelected(response: Response | undefined, values: StoredAnswer['answer']): boolean {
  return !!response?.withDontKnow
    && response.type !== 'matrix-radio'
    && response.type !== 'matrix-checkbox'
    && !!values[`${response.id}-dontKnow`];
}
