/** @vitest-environment jsdom */

import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import type { IndividualComponent } from '../parser/types';
import { NextButton } from './NextButton';

const mockNavigate = vi.fn();
const mockGoToNextStep = vi.fn();

let mockIdentifier = 'intro_0';

vi.mock('@mantine/core', () => ({
  Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconInfoCircle: () => null,
  IconAlertTriangle: () => null,
}));

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../store/hooks/useNextStep', () => ({
  useNextStep: () => ({
    isNextDisabled: false,
    goToNextStep: mockGoToNextStep,
  }),
}));

vi.mock('../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => ({
    uiConfig: {
      nextOnEnter: false,
      timeoutReject: false,
    },
  }),
}));

vi.mock('../routes/utils', () => ({
  useCurrentIdentifier: () => mockIdentifier,
}));

vi.mock('./PreviousButton', () => ({
  PreviousButton: () => null,
}));

describe('NextButton', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mockIdentifier = 'intro_0';
    mockNavigate.mockReset();
    mockGoToNextStep.mockReset();
    vi.useFakeTimers();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  test('resets auto-advance state when the current identifier changes', () => {
    const config = {
      type: 'questionnaire',
      response: [],
      nextButtonAutoAdvanceTime: 1000,
    } as unknown as IndividualComponent;

    act(() => {
      root.render(
        <NextButton
          config={config}
          checkAnswer={null}
        />,
      );
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(mockGoToNextStep).toHaveBeenCalledTimes(1);
    expect(mockGoToNextStep).toHaveBeenLastCalledWith(false);

    mockIdentifier = 'intro_0_followup_1';

    act(() => {
      root.render(
        <NextButton
          config={config}
          checkAnswer={null}
        />,
      );
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(mockGoToNextStep).toHaveBeenCalledTimes(2);
    expect(mockGoToNextStep).toHaveBeenLastCalledWith(false);
  });
});
