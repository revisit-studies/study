import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { useParams } from 'react-router';
import { useStoreSelector } from '../store';
import type { StoredAnswer, StoreState } from '../types';
import { useCurrentComponent, useCurrentStep } from '../../routes/utils';
import { useStoredAnswer } from './useStoredAnswer';

vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({})),
}));

vi.mock('../store', () => ({
  useFlatSequence: vi.fn(() => ['intro', 'trial1']),
  useStoreSelector: vi.fn((selector: (s: { answers: Record<string, unknown> }) => unknown) => selector({ answers: {} })),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
  useCurrentComponent: vi.fn(() => 'intro'),
}));

vi.mock('../../utils/encryptDecryptIndex', () => ({
  decryptIndex: vi.fn((v: string) => parseInt(v, 10)),
}));

afterEach(() => vi.restoreAllMocks());

describe('useStoredAnswer', () => {
  test('returns undefined when there is no stored answer for the current identifier', () => {
    const { result } = renderHook(() => useStoredAnswer());
    expect(result.current).toBeUndefined();
  });

  test('builds identifier from componentName and step when funcIndex is absent', () => {
    let capturedIdentifier = '';
    vi.mocked(useStoreSelector).mockImplementation(
      (selector: (s: StoreState) => unknown) => selector({
        answers: new Proxy({} as StoreState['answers'], {
          get(_, key: string) {
            capturedIdentifier = key;
            return undefined;
          },
        }),
      } as Partial<StoreState> as StoreState),
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
      (selector: (s: StoreState) => unknown) => selector({
        answers: new Proxy({} as StoreState['answers'], {
          get(_, key: string) {
            capturedIdentifier = key;
            return undefined;
          },
        }),
      } as Partial<StoreState> as StoreState),
    );

    renderHook(() => useStoredAnswer());
    // funcIndex present → participantSequence[step]_step_component_decryptIndex(funcIndex)
    expect(capturedIdentifier).toMatch(/trial1_1_trial1_2/);
  });

  test('returns the stored answer when one exists for the identifier', () => {
    const storedAnswer = { answer: { q1: 'yes' } } as Partial<StoredAnswer> as StoredAnswer;
    vi.mocked(useStoreSelector).mockImplementation(
      (selector: (s: StoreState) => unknown) => selector({
        answers: { intro_0: storedAnswer },
      } as Partial<StoreState> as StoreState),
    );

    const { result } = renderHook(() => useStoredAnswer());
    expect(result.current).toEqual(storedAnswer);
  });
});
