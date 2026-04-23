import { renderHook } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { useStudyConfig } from '../useStudyConfig';
import type { StudyConfig } from '../../../parser/types';
import { makeStudyConfig } from '../../../tests/utils';

const mockConfig = makeStudyConfig();

vi.mock('../../store', () => ({
  useStoreSelector: (selector: (s: { config: StudyConfig }) => StudyConfig) => selector({ config: mockConfig }),
}));

describe('useStudyConfig', () => {
  test('returns the config from the store', () => {
    const { result } = renderHook(() => useStudyConfig());
    expect(result.current).toEqual(mockConfig);
  });

  test('returns config with studyMetadata matching the mock', () => {
    const { result } = renderHook(() => useStudyConfig());
    expect(result.current.studyMetadata.title).toBe('Test Study');
  });
});
