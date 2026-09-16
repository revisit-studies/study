import { ReactNode } from 'react';
import * as Mantine from '@mantine/core';
import * as ReactRouter from 'react-router';
import { Provider } from 'react-redux';
import {
  render, act, cleanup, screen, fireEvent,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach, beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { ImageComponent, IndividualComponent } from '../../parser/types';
import { NextButton } from '../NextButton';
import { ImageController } from '../../controllers/ImageController';
import { useNextStep } from '../../store/hooks/useNextStep';
import { useStudyConfig } from '../../store/hooks/useStudyConfig';
import { WindowEventsContext } from '../../store/hooks/useWindowEvents';
import { StudyStoreContext, studyStoreCreator } from '../../store/store';
import { makeStorageEngine, makeStudyConfig } from '../../tests/utils';
import { encryptIndex } from '../../utils/encryptDecryptIndex';

// ── mutable state ─────────────────────────────────────────────────────────────

let mockIsNextDisabled = false;
let mockIdentifier = 'intro_0';
const mockGoToNextStep = vi.fn();
const mockNavigate = vi.fn();
const mockStorageEngine = makeStorageEngine();
let mockStudyConfig: {
  uiConfig: {
    nextButtonDisableTime: number | undefined;
    nextButtonEnableTime: number | undefined;
    nextButtonAlignment?: 'left' | 'center' | 'right';
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

vi.mock('../../store/hooks/useNextStep', async () => {
  const actual = await vi.importActual<{ useNextStep: typeof useNextStep }>('../../store/hooks/useNextStep');
  return { useNextStep: vi.fn(actual.useNextStep) };
});

vi.mock('../../store/hooks/useStudyConfig', async () => {
  const actual = await vi.importActual<{ useStudyConfig: typeof useStudyConfig }>('../../store/hooks/useStudyConfig');
  return { useStudyConfig: vi.fn(actual.useStudyConfig) };
});

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router');
  return { ...actual, useNavigate: vi.fn(actual.useNavigate) };
});

vi.mock('../../routes/utils', () => ({
  useCurrentIdentifier: () => mockIdentifier,
  useCurrentComponent: () => 'image',
  useCurrentStep: () => 0,
  useStudyId: () => 'study',
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('../PreviousButton', () => ({
  PreviousButton: ({ label }: { label?: string }) => (
    <button type="button" data-testid="prev-btn">{label ?? 'Previous'}</button>
  ),
}));

vi.mock('@mantine/core', async () => ({
  ...await vi.importActual<typeof Mantine>('@mantine/core'),
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
  Group: ({ children, justify }: { children: ReactNode; justify?: string }) => (
    <div data-justify={justify}>{children}</div>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconAlertTriangle: () => null,
  IconInfoCircle: () => null,
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('NextButton', () => {
  beforeEach(() => {
    vi.mocked(useNextStep).mockImplementation(() => ({ isNextDisabled: mockIsNextDisabled, goToNextStep: mockGoToNextStep }));
    vi.mocked(useStudyConfig).mockImplementation(() => makeStudyConfig({ uiConfig: mockStudyConfig.uiConfig }));
    vi.mocked(ReactRouter.useNavigate).mockReturnValue(mockNavigate);
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
    vi.mocked(useNextStep).mockReset();
    vi.mocked(useStudyConfig).mockReset();
    vi.mocked(ReactRouter.useNavigate).mockReset();
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

  test('right-aligns the action group by default', () => {
    const html = renderToStaticMarkup(<NextButton checkAnswer={null} onNext={vi.fn()} />);
    expect(html).toContain('data-justify="flex-end"');
  });

  test.each([
    ['left', 'flex-start'],
    ['center', 'center'],
    ['right', 'flex-end'],
  ] as const)('uses the global %s alignment', (alignment, justify) => {
    mockStudyConfig = {
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        nextButtonAlignment: alignment,
      },
    };

    const html = renderToStaticMarkup(<NextButton checkAnswer={null} onNext={vi.fn()} />);
    expect(html).toContain(`data-justify="${justify}"`);
  });

  test('component alignment overrides the global alignment', () => {
    mockStudyConfig = {
      uiConfig: {
        ...mockStudyConfig.uiConfig,
        nextButtonAlignment: 'left',
      },
    };

    const html = renderToStaticMarkup(
      <NextButton
        config={{
          type: 'questionnaire', response: [], nextButtonAlignment: 'center',
        }}
        checkAnswer={null}
        onNext={vi.fn()}
      />,
    );
    expect(html).toContain('data-justify="center"');
  });

  test.each(['sidebar', 'aboveStimulus', 'belowStimulus'] as const)(
    'keeps Previous, Check Answer, and Next in order at %s',
    (location) => {
      const html = renderToStaticMarkup(
        <NextButton
          config={{ type: 'questionnaire', response: [], previousButton: true }}
          location={location}
          checkAnswer={<button type="button">Check Answer</button>}
          onNext={vi.fn()}
        />,
      );

      expect(html.indexOf('Previous')).toBeLessThan(html.indexOf('Check Answer'));
      expect(html.indexOf('Check Answer')).toBeLessThan(html.indexOf('Next'));
    },
  );

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
    expect(screen.getByRole('button', { name: 'Proceed' }).hasAttribute('data-html2canvas-ignore'))
      .toBe(false);
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

function AssetTrial({ config }: { config: ImageComponent }) {
  const { goToNextStep } = useNextStep();
  const location = ReactRouter.useLocation();
  return (
    <>
      <ImageController currentConfig={config} />
      <NextButton config={config} checkAnswer={null} onNext={goToNextStep} />
      <output aria-label="Current route">{location.pathname}</output>
    </>
  );
}

async function renderTrial(overrides: Partial<ImageComponent> = {}) {
  const component: ImageComponent = {
    type: 'image', path: 'image.png', response: [], nextOnEnter: true, ...overrides,
  };
  const config = makeStudyConfig({
    components: { image: component, next: { type: 'questionnaire', response: [] } },
    sequence: { order: 'fixed', components: ['image', 'next'] },
  });
  const studyStore = await studyStoreCreator(
    'study',
    config,
    {
      order: 'fixed', orderPath: 'root', components: ['image', 'next'], skip: [],
    },
    {
      userAgent: '', resolution: {}, language: '', ip: null,
    },
    {},
    { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false },
    'participant',
    false,
    false,
  );
  const view = render(
    <Provider store={studyStore.store}>
      <StudyStoreContext.Provider value={studyStore}>
        <ReactRouter.MemoryRouter initialEntries={[`/study/${encryptIndex(0)}`]}>
          <Mantine.MantineProvider env="test">
            <WindowEventsContext.Provider value={{ current: [] }}>
              <AssetTrial config={component} />
            </WindowEventsContext.Provider>
          </Mantine.MantineProvider>
        </ReactRouter.MemoryRouter>
      </StudyStoreContext.Provider>
    </Provider>,
  );
  const image = view.container.querySelector('img')!;
  return { ...studyStore, image };
}

function expectNoAdvancement() {
  expect(screen.getByLabelText('Current route').textContent).toBe(`/study/${encryptIndex(0)}`);
  expect(mockStorageEngine.saveAnswers).not.toHaveBeenCalled();
}

describe('NextButton asset validation integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIdentifier = 'image_0';
    vi.mocked(useNextStep).mockReset();
    vi.mocked(useStudyConfig).mockReset();
    vi.mocked(ReactRouter.useNavigate).mockReset();
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('blocks Enter while loading and allows it after the image loads', async () => {
    const { image, store } = await renderTrial();
    expect(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(window, { key: 'Enter' });
    expectNoAdvancement();

    fireEvent.load(image);
    expect(store.getState().trialValidation.image_0.assetStatus).toBe('ready');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByLabelText('Current route').textContent).toBe(`/study/${encryptIndex(1)}`);
    expect(mockStorageEngine.saveAnswers).toHaveBeenCalledTimes(1);
  });

  test('keeps Enter blocked after the image fails', async () => {
    const { image, store } = await renderTrial();
    fireEvent.error(image);
    expect(store.getState().trialValidation.image_0.assetStatus).toBe('error');
    expect(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(window, { key: 'Enter' });
    expectNoAdvancement();
  });

  test('defers auto-advance until the image loads even after the deadline', async () => {
    const { image } = await renderTrial({ nextButtonAutoAdvanceTime: 1000 });
    act(() => vi.advanceTimersByTime(1500));
    expectNoAdvancement();

    fireEvent.load(image);
    expect(screen.getByLabelText('Current route').textContent).toBe(`/study/${encryptIndex(1)}`);
    expect(mockStorageEngine.saveAnswers).toHaveBeenCalledTimes(1);
  });

  test('does not auto-advance a failed image', async () => {
    const { image } = await renderTrial({ nextButtonAutoAdvanceTime: 1000 });
    fireEvent.error(image);
    act(() => vi.advanceTimersByTime(1500));
    expectNoAdvancement();
  });

  test('keeps timeout Proceed disabled until the image loads', async () => {
    const { image } = await renderTrial({ nextButtonDisableTime: 1000 });
    act(() => vi.advanceTimersByTime(1500));
    const proceed = screen.getByRole('button', { name: 'Proceed' });
    expect(proceed.hasAttribute('disabled')).toBe(true);
    fireEvent.click(proceed);
    expectNoAdvancement();

    fireEvent.load(image);
    expect(proceed.hasAttribute('disabled')).toBe(false);
    fireEvent.click(proceed);
    expect(screen.getByLabelText('Current route').textContent).toBe(`/study/${encryptIndex(1)}`);
    expect(mockStorageEngine.saveAnswers).toHaveBeenCalledTimes(1);
  });

  test('keeps timeout Proceed disabled after the image fails', async () => {
    const { image } = await renderTrial({ nextButtonDisableTime: 1000 });
    fireEvent.error(image);
    act(() => vi.advanceTimersByTime(1500));
    const proceed = screen.getByRole('button', { name: 'Proceed' });
    expect(proceed.hasAttribute('disabled')).toBe(true);
    fireEvent.click(proceed);
    expectNoAdvancement();
  });
});
