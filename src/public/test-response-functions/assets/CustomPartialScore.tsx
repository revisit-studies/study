import { Text } from '@mantine/core';
import type { CustomResponseParams, CustomResponseScore, CustomResponseValidate } from '../../../store/types';
import type { JsonValue } from '../../../parser/types';

type ScoredValue = { score?: number };

export const validate: CustomResponseValidate = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.score !== 'number') return 'Enter a score.';

  if (value.score < 0 || value.score > 10) return 'Enter a score between 0 and 10.';
  return null;
};

export const score: CustomResponseScore = (value, _values, _response, expected) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.score !== 'number' || value.score < 0 || value.score > 10) return null;
  if (expected === undefined) return value.score / 10;
  if (!expected || typeof expected !== 'object' || typeof (expected as ScoredValue).score !== 'number') return null;

  const expectedScore = (expected as ScoredValue).score!;
  if (expectedScore === 0) return value.score === 0;
  if (value.score === expectedScore) return true;
  return Math.max(0, 1 - Math.abs(value.score - expectedScore) / Math.abs(expectedScore));
};

export default function CustomPartialScore({ response, value, field, disabled }: CustomResponseParams<Record<string, unknown>, JsonValue>) {
  const score = value && typeof value === 'object' && !Array.isArray(value)
    && typeof value.score === 'number' ? value.score : 5;

  return (
    <>
      <Text>{response.prompt}</Text>
      <button type="button" disabled={disabled} onClick={() => field.setValue({ score: score === 5 ? 10 : 5 })}>
        Custom score: {score} (click to change)
      </button>
    </>
  );
}
