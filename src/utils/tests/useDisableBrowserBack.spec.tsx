import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';

import { useStoreDispatch } from '../../store/store';
import { useDisableBrowserBack } from '../useDisableBrowserBack';

vi.mock('../../store/store', () => ({
  useStoreActions: vi.fn(() => ({ setAlertModal: vi.fn() })),
  useStoreDispatch: vi.fn(() => vi.fn()),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  window.onpopstate = null;
});

describe('useDisableBrowserBack', () => {
  test('does not call pushState in non-production mode', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    renderHook(() => useDisableBrowserBack());
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  test('registers pushState and onpopstate handler in production mode', () => {
    vi.stubEnv('PROD', true);
    const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

    renderHook(() => useDisableBrowserBack());

    expect(pushStateSpy).toHaveBeenCalled();
    expect(window.onpopstate).toBeTypeOf('function');
  });

  test('popstate handler dispatches setAlertModal in production mode', () => {
    vi.stubEnv('PROD', true);
    vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

    const mockDispatch = vi.fn();
    vi.mocked(useStoreDispatch).mockReturnValueOnce(mockDispatch);

    renderHook(() => useDisableBrowserBack());

    window.onpopstate!(new PopStateEvent('popstate'));

    expect(mockDispatch).toHaveBeenCalled();
  });
});
