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
const mockSaveProvenance = vi.fn(() => Promise.resolve());
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
  windowEvents: never[];
  timedOut: boolean;
  helpButtonClickedCount: number;
  parameters: Record<string, string>;
  correctAnswer: never[];
  optionOrders: Record<string, string>;
  questionOrders: Record<string, string>;
};

let mockAnswers: Record<string, unknown>;
let mockSequence: {
  id: string;
  orderPath: string;
  order: 'fixed';
  components: string[];
  skip: unknown[];
};
let mockFlatSequence: string[];
let mockStudyConfig: {
  components: Record<string, unknown>;
};
let mockTrialValidation: Record<string, unknown>;
let capturedGoToNextStep: ((collectData?: boolean) => Promise<void>) | undefined;

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
  useStoreSelector: (selector: (state: Record<string, unknown>) => unknown) => selector({
    trialValidation: mockTrialValidation,
    sequence: mockSequence,
    answers: mockAnswers,
    modes: { dataCollectionEnabled: true },
    clickedPrevious: false,
  }),
  useStoreActions: () => ({
    saveTrialAnswer: mockSaveTrialAnswer,
    setReactiveAnswers: mockSetReactiveAnswers,
    setMatrixAnswersRadio: mockSetMatrixAnswersRadio,
    setMatrixAnswersCheckbox: mockSetMatrixAnswersCheckbox,
    setRankingAnswers: mockSetRankingAnswers,
  }),
  useStoreDispatch: () => mockDispatch,
  useAreResponsesValid: () => true,
  useFlatSequence: () => mockFlatSequence,
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
      saveProvenance: mockSaveProvenance,
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
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('./useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (value: number) => String(value),
  decryptIndex: (value: string) => Number(value),
}));

vi.mock('../../utils/notifications', () => ({
  showNotification: (...args: unknown[]) => mockShowNotification(...args),
}));

function HookHarness() {
  capturedGoToNextStep = useNextStep().goToNextStep;
  return null;
}

describe('useNextStep', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockNavigate.mockReset();
    mockShowNotification.mockReset();
    mockSaveAnswers.mockReset();
    mockSaveProvenance.mockClear();
    mockSaveTrialAnswer.mockClear();
    mockSetReactiveAnswers.mockClear();
    mockSetMatrixAnswersCheckbox.mockClear();
    mockSetMatrixAnswersRadio.mockClear();
    mockSetRankingAnswers.mockClear();
    mockDispatch.mockClear();
    mockAnswers = {};
    mockTrialValidation = {
      intro_0: {
        response: {
          values: {
            response: 'saved-answer',
          },
        },
      },
    };
    mockSequence = {
      id: 'root',
      orderPath: 'root',
      order: 'fixed',
      components: ['intro'],
      skip: [],
    };
    mockFlatSequence = ['intro'];
    mockStudyConfig = {
      components: {
        intro: {},
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
      windowEvents: [],
      timedOut: false,
      helpButtonClickedCount: 0,
      parameters: {},
      correctAnswer: [],
      optionOrders: {},
      questionOrders: {},
    };
    capturedGoToNextStep = undefined;

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

  test('preserves participant query params on next navigation', async () => {
    mockSaveAnswers.mockResolvedValueOnce(undefined);
    vi.stubGlobal('window', {
      location: { search: '?participantId=p-1' },
    });

    renderToStaticMarkup(<HookHarness />);

    await capturedGoToNextStep?.();
    await Promise.resolve();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][0]).toContain('?participantId=p-1');
  });

  test('marks timed out auto-advance answers as empty and does not use cleared answers for skip logic', async () => {
    mockSaveAnswers.mockResolvedValueOnce(undefined);
    mockSequence = {
      id: 'root',
      orderPath: 'root',
      order: 'fixed',
      components: ['intro', 'followup', 'skip-target'],
      skip: [{
        name: 'intro',
        check: 'response',
        responseId: 'response',
        comparison: 'equal',
        value: 'saved-answer',
        to: 'skip-target',
      }],
    };
    mockFlatSequence = ['intro', 'followup', 'skip-target'];
    mockStudyConfig = {
      components: {
        intro: {},
        followup: {},
        'skip-target': {},
      },
    };

    renderToStaticMarkup(<HookHarness />);

    await capturedGoToNextStep?.(false);
    await Promise.resolve();

    expect(mockSaveTrialAnswer).toHaveBeenCalledWith(expect.objectContaining({
      answer: {},
      timedOut: true,
    }));
    expect(mockNavigate).toHaveBeenCalledWith('/study-1/1');
  });

  test('excludes timed out answers from block skip conditions', async () => {
    mockSaveAnswers.mockResolvedValueOnce(undefined);
    mockSequence = {
      id: 'root',
      orderPath: 'root',
      order: 'fixed',
      components: ['intro', 'followup', 'skip-target'],
      skip: [{
        check: 'block',
        condition: 'numIncorrect',
        value: 1,
        to: 'skip-target',
      }],
    };
    mockFlatSequence = ['intro', 'followup', 'skip-target'];
    mockStudyConfig = {
      components: {
        intro: {
          type: 'questionnaire',
          response: [{
            id: 'response',
            type: 'radio',
            prompt: 'Pick one',
            options: ['saved-answer', 'other-answer'],
          }],
          correctAnswer: [{
            id: 'response',
            answer: 'saved-answer',
          }],
        },
        followup: {},
        'skip-target': {},
      },
    };

    renderToStaticMarkup(<HookHarness />);

    await capturedGoToNextStep?.(false);
    await Promise.resolve();

    expect(mockSaveTrialAnswer).toHaveBeenCalledWith(expect.objectContaining({
      answer: {},
      timedOut: true,
    }));
    expect(mockNavigate).toHaveBeenCalledWith('/study-1/1');
  });
});
