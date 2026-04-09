import { renderHook } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { useStudyConfig } from '../useStudyConfig';
import type { StudyConfig } from '../../../parser/types';

const mockConfig: StudyConfig = {
  $schema: '',
  studyMetadata: { title: 'Test Study' } as StudyConfig['studyMetadata'],
  uiConfig: { withProgressBar: false } as StudyConfig['uiConfig'],
  components: {},
  sequence: { order: 'fixed', components: [] } as StudyConfig['sequence'],
};

vi.mock('../../store', () => ({
  useStoreSelector: (selector: (s: { config: StudyConfig }) => StudyConfig) => selector({ config: mockConfig }),
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
