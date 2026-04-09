import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { useParams } from 'react-router';
import { useStoreSelector } from '../../store';
import type { StoredAnswer, StoreState } from '../../types';
import { useCurrentComponent, useCurrentStep } from '../../../routes/utils';
import { useStoredAnswer } from '../useStoredAnswer';
import { makeStoredAnswer } from '../../../tests/utils';

vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({})),
}));

vi.mock('../../store', () => ({
  useFlatSequence: vi.fn(() => ['intro', 'trial1']),
  useStoreSelector: vi.fn((selector: (s: { answers: Record<string, StoredAnswer> }) => StoredAnswer) => selector({ answers: {} as Record<string, StoredAnswer> })),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
  useCurrentComponent: vi.fn(() => 'intro'),
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  decryptIndex: vi.fn((v: string) => parseInt(v, 10)),
}));

afterEach(() => vi.restoreAllMocks());

describe('useStoredAnswer', () => {
  test('returns nothing when there is no stored answer for the current identifier', () => {
    const { result } = renderHook(() => useStoredAnswer());
    expect(result.current).toBeUndefined();
  });

  test('builds identifier from componentName and step when funcIndex is absent', () => {
    let capturedIdentifier = '';
    vi.mocked(useStoreSelector).mockImplementation(
      (selector) => selector({
        answers: new Proxy({} as StoreState['answers'], {
          get(_, key: string) {
            capturedIdentifier = key;
            return null;
          },
        }),
      } as StoreState),
    );

    renderHook(() => useStoredAnswer());
    expect(capturedIdentifier).toBe('intro_0');
  });

  test('builds a longer identifier when funcIndex is present', () => {
    vi.mocked(useParams).mockReturnValueOnce({ funcIndex: '2' });
    vi.mocked(useCurrentStep).mockReturnValueOnce(1);
    vi.mocked(useCurrentComponent).mockReturnValueOnce('trial1');

    let capturedIdentifier = '';
    vi.mocked(useStoreSelector).mockImplementation(
      (selector) => selector({
        answers: new Proxy({} as StoreState['answers'], {
          get(_, key: string) {
            capturedIdentifier = key;
            return null;
          },
        }),
      } as StoreState),
    );

    renderHook(() => useStoredAnswer());
    expect(capturedIdentifier).toMatch(/trial1_1_trial1_2/);
  });

  test('returns the stored answer when one exists for the identifier', () => {
    const storedAnswer = makeStoredAnswer({ answer: { q1: 'yes' }, endTime: 100, startTime: 0 });
    vi.mocked(useStoreSelector).mockImplementation(
      (selector) => selector({ answers: { intro_0: storedAnswer } } as unknown as StoreState),
    );

    const { result } = renderHook(() => useStoredAnswer());
    expect(result.current).toEqual(storedAnswer);
  });
});
