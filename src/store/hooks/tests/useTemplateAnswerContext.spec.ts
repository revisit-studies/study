import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { useParams } from 'react-router';
import { useCurrentComponent } from '../../../routes/utils';
import { useTemplateAnswerContext } from '../useTemplateAnswerContext';

vi.mock('react-router', () => ({
  useParams: vi.fn(() => ({})),
}));

vi.mock('../../store', () => ({
  useFlatSequence: vi.fn(() => ['intro', 'trial1']),
  useStoreSelector: vi.fn((selector: (s: unknown) => unknown) => selector({ answers: {} })),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
  useCurrentComponent: vi.fn(() => 'intro'),
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  decryptIndex: vi.fn((v: string) => parseInt(v, 10)),
}));

afterEach(() => vi.restoreAllMocks());

describe('useTemplateAnswerContext', () => {
  test('returns the resolved template data when the current component is known', () => {
    const { result } = renderHook(() => useTemplateAnswerContext());

    expect(result.current).toEqual(expect.objectContaining({
      currentComponent: 'intro',
      currentStep: 0,
    }));
  });

  test('returns undefined while a dynamic block has not resolved its current component yet, so callers cannot compile a path/template off a stale iteration', () => {
    vi.mocked(useCurrentComponent).mockReturnValue('__dynamicLoading');

    const { result } = renderHook(() => useTemplateAnswerContext());

    expect(result.current).toBeUndefined();
  });

  test('resolves once the dynamic component settles on a later render', () => {
    vi.mocked(useCurrentComponent).mockReturnValue('__dynamicLoading');
    const { result, rerender } = renderHook(() => useTemplateAnswerContext());
    expect(result.current).toBeUndefined();

    vi.mocked(useCurrentComponent).mockReturnValue('dynamicTrial');
    vi.mocked(useParams).mockReturnValue({ funcIndex: '3' });
    rerender();

    expect(result.current).toEqual(expect.objectContaining({
      currentComponent: 'dynamicTrial',
      funcIndex: 3,
    }));
  });
});
