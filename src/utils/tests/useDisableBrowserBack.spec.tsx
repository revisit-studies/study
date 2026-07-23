import { renderHook } from '@testing-library/react';
import {
  afterEach, describe, expect, test, vi,
} from 'vitest';
import { MemoryRouter } from 'react-router';

import { useStoreDispatch } from '../../store/store';
import { useDisableBrowserBack } from '../useDisableBrowserBack';
import { useIsAnalysis } from '../../store/hooks/useIsAnalysis';

vi.mock('../../store/store', () => ({
  useStoreActions: vi.fn(() => ({ setAlertModal: vi.fn() })),
  useStoreDispatch: vi.fn(() => vi.fn()),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 0),
}));

vi.mock('../../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: vi.fn(() => false),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  window.onpopstate = null;
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useDisableBrowserBack', () => {
  test('does not call pushState in non-production mode', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    renderHook(() => useDisableBrowserBack(), { wrapper: Wrapper });
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  test('registers pushState and onpopstate handler in production mode', () => {
    vi.stubEnv('PROD', true);
    const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

    renderHook(() => useDisableBrowserBack(), { wrapper: Wrapper });

    expect(pushStateSpy).toHaveBeenCalled();
    expect(window.onpopstate).toBeTypeOf('function');
  });

  test('does not intercept browser back in analysis mode', () => {
    vi.stubEnv('PROD', true);
    vi.mocked(useIsAnalysis).mockReturnValueOnce(true);
    const pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

    renderHook(() => useDisableBrowserBack(), { wrapper: Wrapper });

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(window.onpopstate).toBeNull();
  });

  test('popstate handler dispatches setAlertModal in production mode', () => {
    vi.stubEnv('PROD', true);
    vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

    const mockDispatch = vi.fn();
    vi.mocked(useStoreDispatch).mockReturnValueOnce(mockDispatch);

    renderHook(() => useDisableBrowserBack(), { wrapper: Wrapper });

    window.onpopstate!(new PopStateEvent('popstate'));

    expect(mockDispatch).toHaveBeenCalled();
  });
});
