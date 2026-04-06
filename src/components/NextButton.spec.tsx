import { ReactNode } from 'react';
import {
  render, act, cleanup, screen,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import { NextButton } from './NextButton';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockIsNextDisabled = false;
const mockGoToNextStep = vi.fn();
let mockStudyConfig = {
  uiConfig: {
    nextButtonDisableTime: undefined as number | undefined,
    nextButtonEnableTime: undefined as number | undefined,
    nextOnEnter: false,
    previousButtonText: 'Previous',
    timeoutReject: false,
  },
};

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../store/hooks/useNextStep', () => ({
  useNextStep: () => ({
    isNextDisabled: mockIsNextDisabled,
    goToNextStep: mockGoToNextStep,
  }),
}));

vi.mock('../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('./PreviousButton', () => ({
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
  });

  test('renders Next button with default label', () => {
    const html = renderToStaticMarkup(<NextButton checkAnswer={null} />);
    expect(html).toContain('Next');
  });

  test('renders button with custom label', () => {
    const html = renderToStaticMarkup(<NextButton label="Continue" checkAnswer={null} />);
    expect(html).toContain('Continue');
  });

  test('does not render PreviousButton when config.previousButton is false', () => {
    const html = renderToStaticMarkup(<NextButton config={{ previousButton: false } as never} checkAnswer={null} />);
    expect(html).not.toContain('data-testid="prev-btn"');
  });

  test('renders PreviousButton when config.previousButton is true', () => {
    const html = renderToStaticMarkup(
      <NextButton config={{ previousButton: true, previousButtonText: 'Back' } as never} checkAnswer={null} />,
    );
    expect(html).toContain('data-testid="prev-btn"');
    expect(html).toContain('Back');
  });

  test('button is disabled when disabled prop is true', () => {
    const html = renderToStaticMarkup(<NextButton disabled checkAnswer={null} />);
    expect(html).toContain('disabled');
  });

  test('button is disabled when isNextDisabled is true', () => {
    mockIsNextDisabled = true;
    const html = renderToStaticMarkup(<NextButton checkAnswer={null} />);
    expect(html).toContain('disabled');
  });

  test('renders checkAnswer element when provided', () => {
    const html = renderToStaticMarkup(
      <NextButton checkAnswer={<div data-testid="check">Check Answer</div>} />,
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
      render(<NextButton checkAnswer={null} />);
    });
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Please wait')).toBeDefined();
  });

  test('does not show "Please wait" alert when no enable time is configured', async () => {
    await act(async () => {
      render(<NextButton checkAnswer={null} />);
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
      render(<NextButton checkAnswer={null} />);
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
      render(<NextButton checkAnswer={null} />);
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
      render(<NextButton checkAnswer={null} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(9500);
    });
    vi.useRealTimers();
    expect(screen.queryByText('Next button disabled')).toBeNull();
  });

  test('nextOnEnter: pressing Enter calls goToNextStep', async () => {
    mockStudyConfig = {
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        nextOnEnter: true,
      },
    };
    await act(async () => {
      render(<NextButton checkAnswer={null} />);
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(mockGoToNextStep).toHaveBeenCalled();
  });
});
