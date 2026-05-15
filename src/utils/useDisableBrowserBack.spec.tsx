/** @vitest-environment jsdom */

import { createRoot } from 'react-dom/client';
import { act } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { useDisableBrowserBack } from './useDisableBrowserBack';

const mockSetAlertModal = vi.fn((payload) => ({ type: 'setAlertModal', payload }));
const mockDispatch = vi.fn();
const mockPushState = vi.fn();

let mockIsAnalysis = false;

vi.mock('../store/store', () => ({
  useStoreActions: () => ({
    setAlertModal: mockSetAlertModal,
  }),
  useStoreDispatch: () => mockDispatch,
}));

vi.mock('../routes/utils', () => ({
  useCurrentStep: () => 1,
}));

vi.mock('../store/hooks/useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

function HookHarness() {
  useDisableBrowserBack();
  return null;
}

describe('useDisableBrowserBack', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mockIsAnalysis = false;
    mockSetAlertModal.mockClear();
    mockDispatch.mockClear();
    mockPushState.mockClear();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        pushState: mockPushState,
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.onpopstate = null;
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  test('does not intercept browser back in analysis replay', () => {
    mockIsAnalysis = true;

    act(() => {
      root.render(<HookHarness />);
    });

    expect(mockPushState).not.toHaveBeenCalled();
    expect(window.onpopstate).toBeNull();
  });
});
