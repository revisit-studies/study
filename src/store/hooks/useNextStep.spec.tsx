import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { useNextStep } from './useNextStep';

const mockNavigate = vi.fn();
const mockShowNotification = vi.fn();
const mockSaveAnswers = vi.fn();
const mockSaveTrialAnswer = vi.fn((payload) => ({ type: 'saveTrialAnswer', payload }));
const mockSetReactiveAnswers = vi.fn((payload) => ({ type: 'setReactiveAnswers', payload }));
const mockSetMatrixAnswersCheckbox = vi.fn((payload) => ({ type: 'setMatrixAnswersCheckbox', payload }));
const mockSetMatrixAnswersRadio = vi.fn((payload) => ({ type: 'setMatrixAnswersRadio', payload }));
const mockSetRankingAnswers = vi.fn((payload) => ({ type: 'setRankingAnswers', payload }));

let mockStoredAnswer: {
  answer: Record<string, string>;
  componentName: string;
  identifier: string;
  trialOrder: string;
  incorrectAnswers: Record<string, string>;
  startTime: number;
  endTime: number;
  provenanceGraph: {
    aboveStimulus: undefined;
    belowStimulus: undefined;
    stimulus: undefined;
    sidebar: undefined;
  };
  windowEvents: never[];
  timedOut: boolean;
  helpButtonClickedCount: number;
  parameters: Record<string, string>;
  correctAnswer: never[];
  optionOrders: Record<string, string>;
  questionOrders: Record<string, string>;
  responseSubmitAttempted?: boolean;
};

let mockAnswers: Record<string, unknown>;
let capturedGoToNextStep: ((collectData?: boolean) => Promise<void>) | undefined;
let capturedIsNextDisabled: boolean | undefined;
let mockTrialValidation: Record<string, unknown>;

const mockDispatch = vi.fn((action) => {
  if (action.type === 'saveTrialAnswer') {
    mockStoredAnswer.endTime = action.payload.endTime;
    mockAnswers = {
      ...mockAnswers,
      [action.payload.identifier]: action.payload,
    };
  }
});

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ funcIndex: undefined }),
}));

vi.mock('../store', () => ({
  useStoreSelector: (selector: (state: {
    trialValidation: Record<string, unknown>;
    sequence: {
      id: string;
      orderPath: string;
      order: 'fixed';
      components: string[];
      skip: never[];
    };
    answers: Record<string, unknown>;
    modes: { dataCollectionEnabled: boolean };
    clickedPrevious: boolean;
    responseSubmitAttempted: Record<string, boolean>;
  }) => unknown) => selector({
    trialValidation: mockTrialValidation,
    sequence: {
      id: 'root',
      orderPath: 'root',
      order: 'fixed',
      components: ['intro'],
      skip: [],
    },
    answers: mockAnswers,
    modes: { dataCollectionEnabled: true },
    clickedPrevious: false,
    responseSubmitAttempted: { intro_0: true },
  }),
  useStoreActions: () => ({
    saveTrialAnswer: mockSaveTrialAnswer,
    setReactiveAnswers: mockSetReactiveAnswers,
    setMatrixAnswersRadio: mockSetMatrixAnswersRadio,
    setMatrixAnswersCheckbox: mockSetMatrixAnswersCheckbox,
    setRankingAnswers: mockSetRankingAnswers,
  }),
  useStoreDispatch: () => mockDispatch,
  useFlatSequence: () => ['intro'],
}));

vi.mock('../../routes/utils', () => ({
  useCurrentIdentifier: () => 'intro_0',
  useCurrentStep: () => 0,
  useStudyId: () => 'study-1',
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: {
      saveAnswers: mockSaveAnswers,
    },
  }),
}));

vi.mock('./useStoredAnswer', () => ({
  useStoredAnswer: () => mockStoredAnswer,
}));

vi.mock('./useWindowEvents', () => ({
  useWindowEvents: () => ({ current: [] }),
}));

vi.mock('./useStudyConfig', () => ({
  useStudyConfig: () => ({
    components: {
      intro: {},
    },
  }),
}));

vi.mock('./useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../../utils/notifications', () => ({
  showNotification: (...args: unknown[]) => mockShowNotification(...args),
}));

function HookHarness() {
  const { goToNextStep, isNextDisabled } = useNextStep();
  capturedGoToNextStep = goToNextStep;
  capturedIsNextDisabled = isNextDisabled;
  return null;
}

describe('useNextStep', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockNavigate.mockReset();
    mockShowNotification.mockReset();
    mockSaveAnswers.mockReset();
    mockSaveTrialAnswer.mockClear();
    mockSetReactiveAnswers.mockClear();
    mockSetMatrixAnswersCheckbox.mockClear();
    mockSetMatrixAnswersRadio.mockClear();
    mockSetRankingAnswers.mockClear();
    mockDispatch.mockClear();
    mockAnswers = {};
    mockTrialValidation = {
      intro_0: {
        aboveStimulus: { valid: false, values: {} },
        belowStimulus: { valid: false, values: {} },
        sidebar: { valid: false, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          stimulus: undefined,
          sidebar: undefined,
        },
      },
    };
    mockStoredAnswer = {
      answer: {},
      componentName: 'intro',
      identifier: 'intro_0',
      trialOrder: '0',
      incorrectAnswers: {},
      startTime: 0,
      endTime: -1,
      provenanceGraph: {
        aboveStimulus: undefined,
        belowStimulus: undefined,
        stimulus: undefined,
        sidebar: undefined,
      },
      windowEvents: [],
      timedOut: false,
      helpButtonClickedCount: 0,
      parameters: {},
      correctAnswer: [],
      optionOrders: {},
      questionOrders: {},
      responseSubmitAttempted: false,
    };
    capturedGoToNextStep = undefined;
    capturedIsNextDisabled = undefined;

    vi.stubGlobal('window', {
      location: { search: '' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('continues locally and shows an error when persistence fails', async () => {
    mockSaveAnswers
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(undefined);

    renderToStaticMarkup(<HookHarness />);

    expect(capturedGoToNextStep).toBeDefined();

    await capturedGoToNextStep?.();
    await Promise.resolve();

    expect(mockSaveAnswers).toHaveBeenCalledTimes(1);
    expect(mockSaveTrialAnswer).toHaveBeenCalledTimes(1);
    expect(mockSaveTrialAnswer).toHaveBeenCalledWith(expect.objectContaining({
      responseSubmitAttempted: true,
    }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith({
      title: 'Failed to Save Response',
      message: 'Your response could not be saved. Please check your connection and try again.',
      color: 'red',
    });
    expect(mockStoredAnswer.endTime).toBeGreaterThan(-1);

    await capturedGoToNextStep?.();

    expect(mockSaveAnswers).toHaveBeenCalledTimes(1);
    expect(mockSaveTrialAnswer).toHaveBeenCalledTimes(1);
    expect(mockStoredAnswer.endTime).toBeGreaterThan(-1);
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  test('only disables next when stimulus validation fails', () => {
    renderToStaticMarkup(<HookHarness />);

    expect(capturedIsNextDisabled).toBe(false);

    mockTrialValidation = {
      intro_0: {
        aboveStimulus: { valid: false, values: {} },
        belowStimulus: { valid: false, values: {} },
        sidebar: { valid: false, values: {} },
        stimulus: { valid: false, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          stimulus: undefined,
          sidebar: undefined,
        },
      },
    };

    renderToStaticMarkup(<HookHarness />);

    expect(capturedIsNextDisabled).toBe(true);
  });
});
