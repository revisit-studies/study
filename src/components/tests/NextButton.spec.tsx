import { ReactNode } from 'react';
import {
  render, act, cleanup, screen, fireEvent,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { IndividualComponent } from '../../parser/types';
import { NextButton } from '../NextButton';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockIsNextDisabled = false;
let mockIdentifier = 'intro_0';
const mockGoToNextStep = vi.fn();
const mockNavigate = vi.fn();
let mockStudyConfig: {
  uiConfig: {
    nextButtonDisableTime: number | undefined;
    nextButtonEnableTime: number | undefined;
    nextOnEnter: boolean;
    previousButtonText: string;
    timeoutReject: boolean;
  };
} = {
  uiConfig: {
    nextButtonDisableTime: undefined,
    nextButtonEnableTime: undefined,
    nextOnEnter: false,
    previousButtonText: 'Previous',
    timeoutReject: false,
  },
};

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../store/hooks/useNextStep', () => ({
  useNextStep: () => ({
    isNextDisabled: mockIsNextDisabled,
    goToNextStep: mockGoToNextStep,
  }),
}));

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../routes/utils', () => ({
  useCurrentIdentifier: () => mockIdentifier,
}));

vi.mock('../PreviousButton', () => ({
  PreviousButton: ({ label }: { label?: string }) => (
    <button type="button" data-testid="prev-btn">{label ?? 'Previous'}</button>
  ),
}));

vi.mock('@mantine/core', () => ({
  Alert: ({ children, title }: { children: ReactNode; title?: ReactNode }) => (
    <div role="alert">
      <div>{title}</div>
      {children}
    </div>
  ),
  Button: ({
    children, disabled, onClick, type,
  }: { children: ReactNode; disabled?: boolean; onClick?: () => void; type?: string }) => (
    <button type={type === 'submit' ? 'submit' : 'button'} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertTriangle: () => null,
  IconInfoCircle: () => null,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('NextButton', () => {
  beforeEach(() => {
    mockIsNextDisabled = false;
    mockIdentifier = 'intro_0';
    mockNavigate.mockReset();
    mockStudyConfig = {
      uiConfig: {
        nextButtonDisableTime: undefined,
        nextButtonEnableTime: undefined,
        nextOnEnter: false,
        previousButtonText: 'Previous',
        timeoutReject: false,
      },
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test('renders Next button with default label', () => {
    const html = renderToStaticMarkup(<NextButton checkAnswer={null} onNext={vi.fn()} />);
    expect(html).toContain('Next');
  });

  test('renders button with custom label', () => {
    const html = renderToStaticMarkup(<NextButton label="Continue" checkAnswer={null} onNext={vi.fn()} />);
    expect(html).toContain('Continue');
  });

  test('does not render PreviousButton when config.previousButton is false', () => {
    const html = renderToStaticMarkup(
      <NextButton config={{ type: 'questionnaire', response: [], previousButton: false }} checkAnswer={null} onNext={vi.fn()} />,
    );
    expect(html).not.toContain('data-testid="prev-btn"');
  });

  test('renders PreviousButton when config.previousButton is true', () => {
    const html = renderToStaticMarkup(
      <NextButton
        config={{
          type: 'questionnaire', response: [], previousButton: true, previousButtonText: 'Back',
        }}
        checkAnswer={null}
        onNext={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="prev-btn"');
    expect(html).toContain('Back');
  });

  test('button is disabled when disabled prop is true', () => {
    const html = renderToStaticMarkup(<NextButton disabled checkAnswer={null} onNext={vi.fn()} />);
    expect(html).toContain('disabled');
  });

  test('button is disabled when isNextDisabled is true', () => {
    mockIsNextDisabled = true;
    const html = renderToStaticMarkup(<NextButton checkAnswer={null} onNext={vi.fn()} />);
    expect(html).toContain('disabled');
  });

  test('renders checkAnswer element when provided', () => {
    const html = renderToStaticMarkup(
      <NextButton checkAnswer={<div data-testid="check">Check Answer</div>} onNext={vi.fn()} />,
    );
    expect(html).toContain('Check Answer');
  });

  test('shows "Please wait" alert after render when nextButtonEnableTime is set', async () => {
    mockStudyConfig = {
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        nextButtonEnableTime: 5000,
      },
    };
    await act(async () => {
      render(<NextButton checkAnswer={null} onNext={vi.fn()} />);
    });
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Please wait')).toBeDefined();
  });

  test('does not show "Please wait" alert when no enable time is configured', async () => {
    await act(async () => {
      render(<NextButton checkAnswer={null} onNext={vi.fn()} />);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('shows "Next button disables soon" alert when timer is approaching disableTime', async () => {
    // timer starts at 0; disableTime=5000 means (5000 - 0) = 5000ms < 10000ms and > 0
    mockStudyConfig = {
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        nextButtonDisableTime: 5000,
      },
    };
    await act(async () => {
      render(<NextButton checkAnswer={null} onNext={vi.fn()} />);
    });
    expect(screen.getByText('Next button disables soon')).toBeDefined();
  });

  test('shows "Next button disabled" alert when timer has passed disableTime', async () => {
    vi.useFakeTimers();
    mockStudyConfig = {
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        nextButtonDisableTime: 100,
        timeoutReject: false,
      },
    };
    await act(async () => {
      render(<NextButton checkAnswer={null} onNext={vi.fn()} />);
    });
    // Advance past disableTime (100ms) and into the <10000ms window
    await act(async () => {
      vi.advanceTimersByTime(9500);
    });
    vi.useRealTimers();
    expect(screen.getByText('Next button disabled')).toBeDefined();
  });

  test('does not show "Next button disabled" alert when timeoutReject is true', async () => {
    vi.useFakeTimers();
    mockStudyConfig = {
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        nextButtonDisableTime: 100,
        timeoutReject: true,
      },
    };
    await act(async () => {
      render(<NextButton checkAnswer={null} onNext={vi.fn()} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(9500);
    });
    vi.useRealTimers();
    expect(screen.queryByText('Next button disabled')).toBeNull();
  });

  test('nextOnEnter: pressing Enter calls goToNextStep', async () => {
    const onNext = vi.fn();
    mockStudyConfig = {
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        nextOnEnter: true,
      },
    };
    await act(async () => {
      render(<NextButton checkAnswer={null} onNext={onNext} />);
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(onNext).toHaveBeenCalled();
  });

  test('nextOnEnter: Enter inside a textarea does not call onNext', async () => {
    const onNext = vi.fn();
    mockStudyConfig = { uiConfig: { ...mockStudyConfig.uiConfig, nextOnEnter: true } };
    await act(async () => {
      render(<NextButton checkAnswer={null} onNext={onNext} />);
    });
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    try {
      await act(async () => { fireEvent.keyDown(textarea, { key: 'Enter' }); });
      expect(onNext).not.toHaveBeenCalled();
    } finally {
      document.body.removeChild(textarea);
    }
  });

  test('nextOnEnter: Enter on a focused button is left to its synthesized click', async () => {
    const onNext = vi.fn();
    mockStudyConfig = { uiConfig: { ...mockStudyConfig.uiConfig, nextOnEnter: true } };
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<NextButton checkAnswer={null} onNext={onNext} />));
    });
    const button = container.querySelector('button')!;
    await act(async () => { fireEvent.keyDown(button, { key: 'Enter' }); });
    expect(onNext).not.toHaveBeenCalled();
  });

  test('nextOnEnter: Enter runs onCheckAnswer instead of onNext while it is provided', async () => {
    const onNext = vi.fn();
    const onCheckAnswer = vi.fn();
    mockStudyConfig = { uiConfig: { ...mockStudyConfig.uiConfig, nextOnEnter: true } };
    await act(async () => {
      render(<NextButton checkAnswer={null} onCheckAnswer={onCheckAnswer} onNext={onNext} />);
    });
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    expect(onCheckAnswer).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  test('nextOnEnter: Enter runs onCheckAnswer even while the Next button is disabled', async () => {
    const onNext = vi.fn();
    const onCheckAnswer = vi.fn();
    mockStudyConfig = { uiConfig: { ...mockStudyConfig.uiConfig, nextOnEnter: true } };
    await act(async () => {
      render(<NextButton checkAnswer={null} onCheckAnswer={onCheckAnswer} onNext={onNext} disabled />);
    });
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    expect(onCheckAnswer).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  test('nextOnEnter: the enable timer gates onNext but not onCheckAnswer', async () => {
    const onNext = vi.fn();
    const onCheckAnswer = vi.fn();
    mockStudyConfig = {
      uiConfig: { ...mockStudyConfig.uiConfig, nextOnEnter: true, nextButtonEnableTime: 5000 },
    };
    let rerender!: ReturnType<typeof render>['rerender'];
    await act(async () => {
      ({ rerender } = render(<NextButton checkAnswer={null} onCheckAnswer={onCheckAnswer} onNext={onNext} />));
    });
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    expect(onCheckAnswer).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
    await act(async () => {
      rerender(<NextButton checkAnswer={null} onNext={onNext} />);
    });
    await act(async () => { fireEvent.keyDown(window, { key: 'Enter' }); });
    expect(onNext).not.toHaveBeenCalled();
  });

  test('resets auto-advance state when the current identifier changes', async () => {
    const config = {
      type: 'questionnaire',
      response: [],
      nextButtonAutoAdvanceTime: 1000,
    } as unknown as IndividualComponent;

    vi.useFakeTimers();
    let rerender!: ReturnType<typeof render>['rerender'];

    await act(async () => {
      ({ rerender } = render(
        <NextButton
          config={config}
          checkAnswer={null}
          onNext={vi.fn()}
        />,
      ));
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(mockGoToNextStep).toHaveBeenCalledTimes(1);
    expect(mockGoToNextStep).toHaveBeenLastCalledWith(false);

    mockIdentifier = 'intro_0_followup_1';

    await act(async () => {
      rerender(
        <NextButton
          config={config}
          checkAnswer={null}
          onNext={vi.fn()}
        />,
      );
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(mockGoToNextStep).toHaveBeenCalledTimes(2);
    expect(mockGoToNextStep).toHaveBeenLastCalledWith(false);
    vi.useRealTimers();
  });
});
