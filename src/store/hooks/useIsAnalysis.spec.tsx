import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { useSearchParams } from 'react-router';
import { useIsAnalysis } from './useIsAnalysis';

vi.mock('react-router', () => ({
  useSearchParams: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe('useIsAnalysis', () => {
  test('returns false when participantId is absent from search params', () => {
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
    const { result } = renderHook(() => useIsAnalysis());
    expect(result.current).toBe(false);
  });

  test('returns true when participantId is present in search params', () => {
    vi.mocked(useSearchParams).mockReturnValue([
      new URLSearchParams({ participantId: 'pid-123' }),
      vi.fn(),
    ]);
    const { result } = renderHook(() => useIsAnalysis());
    expect(result.current).toBe(true);
  });

  test('returns false when only unrelated params are present', () => {
    vi.mocked(useSearchParams).mockReturnValue([
      new URLSearchParams({ studyId: 'my-study' }),
      vi.fn(),
    ]);
    const { result } = renderHook(() => useIsAnalysis());
    expect(result.current).toBe(false);
  });
});
