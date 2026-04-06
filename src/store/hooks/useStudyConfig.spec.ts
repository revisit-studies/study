import { renderHook } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { useStudyConfig } from './useStudyConfig';

vi.mock('../store', () => ({
  useStoreSelector: (selector: (s: Record<string, unknown>) => unknown) => selector({
    config: {
      studyMetadata: { title: 'Test Study' },
      uiConfig: { withProgressBar: false },
      components: {},
      sequences: {},
    },
  }),
}));

describe('useStudyConfig', () => {
  test('returns the config from the store', () => {
    const { result } = renderHook(() => useStudyConfig());
    expect(result.current).toBeDefined();
  });

  test('returns config with studyMetadata', () => {
    const { result } = renderHook(() => useStudyConfig());
    expect(result.current.studyMetadata).toBeDefined();
  });
});
