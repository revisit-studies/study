import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { useNextStep } from '../useNextStep';
import type { Answer } from '../../../parser/types';

const mockNavigate = vi.fn();
const mockShowNotification = vi.fn();
const mockSaveAnswers = vi.fn();
const mockSaveProvenance = vi.fn(() => Promise.resolve());
const mockSaveTrialAnswer = vi.fn((payload) => ({ type: 'saveTrialAnswer', payload }));
const mockSetReactiveAnswers = vi.fn((payload) => ({ type: 'setReactiveAnswers', payload }));
const mockSetMatrixAnswersCheckbox = vi.fn((payload) => ({ type: 'setMatrixAnswersCheckbox', payload }));
const mockSetMatrixAnswersRadio = vi.fn((payload) => ({ type: 'setMatrixAnswersRadio', payload }));
const mockSetRankingAnswers = vi.fn((payload) => ({ type: 'setRankingAnswers', payload }));
const mockSetAlertModal = vi.fn((payload) => ({ type: 'setAlertModal', payload }));

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
  correctAnswer: Answer[];
  optionOrders: Record<string, string>;
  questionOrders: Record<string, string>;
  assetIdentifier?: string;
  recordingSegments?: string[];
  responseSubmitAttempted?: boolean;
};

let mockAnswers: Record<string, unknown>;
let mockCurrentIdentifier = 'intro_0';
let capturedGoToNextStep: ((collectData?: boolean) => Promise<void>) | undefined;
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
  uiConfig: Record<string, unknown>;
};
let mockTrialValidation: Record<string, unknown>;
let capturedIsNextDisabled: boolean | undefined;
let mockScreenCaptureActive = false;
let mockWindowEvents: { current: never[]; visitFinalizing: boolean };

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

vi.mock('../../store', async (importOriginal) => ({
  ...(await importOriginal() as object),
  useStoreSelector: (selector: (state: Record<string, unknown>) => unknown) => selector({
    trialValidation: mockTrialValidation,
    sequence: mockSequence,
    answers: mockAnswers,
    modes: { dataCollectionEnabled: true },
    clickedPrevious: false,
    responseSubmitAttempted: { intro_0: true },
    checkAnswer: {},
  }),
  useStoreActions: () => ({
    saveTrialAnswer: mockSaveTrialAnswer,
    setReactiveAnswers: mockSetReactiveAnswers,
    setMatrixAnswersRadio: mockSetMatrixAnswersRadio,
    setMatrixAnswersCheckbox: mockSetMatrixAnswersCheckbox,
    setRankingAnswers: mockSetRankingAnswers,
    setAlertModal: mockSetAlertModal,
  }),
  useStoreDispatch: () => mockDispatch,
  useAreResponsesValid: () => true,
  useFlatSequence: () => mockFlatSequence,
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentIdentifier: () => mockCurrentIdentifier,
  useCurrentStep: () => 0,
  useStudyId: () => 'study-1',
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: {
      saveAnswers: mockSaveAnswers,
      saveProvenance: mockSaveProvenance,
    },
  }),
}));

vi.mock('../useStoredAnswer', () => ({
  useStoredAnswer: () => mockStoredAnswer,
}));

vi.mock('../useTrialAssetIdentifier', () => ({ useTrialAssetSegments: () => ['intro_screen_visit'] }));
vi.mock('../useRecording', () => ({
  useOptionalRecordingContext: () => ({ hasActiveVerifiedScreenCapture: () => mockScreenCaptureActive }),
}));

vi.mock('../useWindowEvents', () => ({
  useWindowEvents: () => mockWindowEvents,
}));

vi.mock('../useGlobalStore', () => ({ useGlobalStore: () => ({}) }));

vi.mock('../useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('../useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (value: number) => String(value),
  decryptIndex: (value: string) => Number(value),
}));

vi.mock('../../../utils/notifications', () => ({
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
    mockSaveAnswers.mockReset().mockResolvedValue(undefined);
    mockSaveProvenance.mockClear();
    mockSaveTrialAnswer.mockClear();
    mockSetReactiveAnswers.mockClear();
    mockSetMatrixAnswersCheckbox.mockClear();
    mockSetMatrixAnswersRadio.mockClear();
    mockSetRankingAnswers.mockClear();
    mockSetAlertModal.mockClear();
    mockDispatch.mockClear();
    mockAnswers = {};
    mockCurrentIdentifier = 'intro_0';
    mockTrialValidation = {
      intro_0: {
        aboveStimulus: { valid: false, values: {} },
        belowStimulus: { valid: false, values: { response: 'saved-answer' } },
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
      uiConfig: {},
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
      responseSubmitAttempted: false,
    };
    capturedGoToNextStep = undefined;
    capturedIsNextDisabled = undefined;
    mockScreenCaptureActive = false;
    mockWindowEvents = { current: [], visitFinalizing: false };

    vi.stubGlobal('window', {
      location: { search: '' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('shows the storage modal after a direct answer persistence failure', async () => {
    mockSaveAnswers.mockRejectedValueOnce(new Error('write failed'));

    renderToStaticMarkup(<HookHarness />);

    expect(capturedGoToNextStep).toBeDefined();

    capturedGoToNextStep?.();
    await Promise.resolve();

    expect(mockSaveAnswers).toHaveBeenCalledTimes(1);
    expect(mockSaveTrialAnswer).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockSetAlertModal).toHaveBeenCalledWith({
      show: true,
      message: 'Your response could not be saved because the connection to the server was interrupted. Please check your internet connection, then click Retry. You can continue once your response is fully saved.',
      title: 'Failed to Save Response',
    });
    expect(mockShowNotification).not.toHaveBeenCalled();
    expect(mockStoredAnswer.endTime).toBeGreaterThan(-1);
  });

  test('rejects Next while Previous is finalizing the current visit', async () => {
    mockWindowEvents.visitFinalizing = true;
    renderToStaticMarkup(<HookHarness />);

    expect(capturedIsNextDisabled).toBe(true);
    await capturedGoToNextStep?.();

    expect(mockSaveAnswers).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('persists full-screen metadata from an accepted non-global revisit without replacing its answer', async () => {
    mockStudyConfig.uiConfig = { requireEntireScreen: true, recordScreen: true };
    mockScreenCaptureActive = true;
    mockStoredAnswer = {
      ...mockStoredAnswer,
      answer: { response: 'accepted-answer' },
      assetIdentifier: 'previous-screen-segment',
      recordingSegments: ['previous-screen-segment'],
      startTime: 100,
      endTime: 200,
    };
    mockAnswers = { intro_0: mockStoredAnswer };
    renderToStaticMarkup(<HookHarness />);

    await capturedGoToNextStep?.();

    expect(mockSaveAnswers).toHaveBeenCalledWith(expect.objectContaining({
      intro_0: expect.objectContaining({
        answer: { response: 'accepted-answer' },
        assetIdentifier: 'intro_screen_visit',
        endTime: 200,
        recordingSegments: expect.arrayContaining(['previous-screen-segment', 'intro_screen_visit']),
        recordingSegmentRanges: expect.arrayContaining([expect.objectContaining({ assetIdentifier: 'intro_screen_visit' })]),
      }),
    }));
    expect(mockNavigate).toHaveBeenCalledOnce();
  });

  test('submits a required unanswered response as incorrect when its threshold is zero', async () => {
    const correctAnswer = [{ id: 'response', answer: 10, correctnessThreshold: 0 }];
    mockStoredAnswer.correctAnswer = correctAnswer;
    mockTrialValidation = {
      intro_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: {
          valid: true,
          values: { response: '' },
        },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          stimulus: undefined,
          sidebar: undefined,
        },
      },
    };
    mockStudyConfig = {
      components: {
        intro: {
          type: 'questionnaire',
          response: [{
            id: 'response', type: 'numerical', prompt: 'Number', required: true,
          }],
          correctAnswer,
        },
      },
      uiConfig: {},
    };

    renderToStaticMarkup(<HookHarness />);
    capturedGoToNextStep?.();

    expect(mockSaveTrialAnswer).toHaveBeenCalledWith(expect.objectContaining({
      checkAnswer: expect.objectContaining({
        correct: false,
      }),
    }));
  });

  test('shows the storage modal after a provenance persistence failure', async () => {
    mockSaveAnswers.mockResolvedValueOnce(undefined);
    mockSaveProvenance.mockRejectedValueOnce(new Error('provenance write failed'));
    mockTrialValidation = {
      intro_0: {
        ...(mockTrialValidation.intro_0 as Record<string, unknown>),
        provenanceGraph: { nodes: {} },
      },
    };

    renderToStaticMarkup(<HookHarness />);

    capturedGoToNextStep?.();
    await Promise.resolve();

    expect(mockSaveProvenance).toHaveBeenCalledTimes(1);
    expect(mockSaveTrialAnswer).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockSetAlertModal).toHaveBeenCalledWith(expect.objectContaining({
      show: true,
      title: 'Failed to Save Response',
    }));
  });

  test('schedules the queued write and navigates without flushing it', async () => {
    mockSaveAnswers.mockResolvedValueOnce(undefined);

    renderToStaticMarkup(<HookHarness />);

    capturedGoToNextStep?.();

    expect(mockSaveAnswers).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockSetAlertModal).not.toHaveBeenCalled();
  });

  test('blocks participant submission when whole-screen capture is no longer active', async () => {
    mockStudyConfig = {
      components: { intro: { recordScreen: true } },
      uiConfig: { recordScreen: true, requireEntireScreen: true },
    };
    mockScreenCaptureActive = false;
    renderToStaticMarkup(<HookHarness />);

    expect(capturedIsNextDisabled).toBe(true);
    await capturedGoToNextStep?.();
    expect(mockSaveTrialAnswer).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('saves the current whole-screen asset key and keeps prior segment keys', async () => {
    mockStudyConfig = {
      components: { intro: { recordScreen: true } },
      uiConfig: { recordScreen: true, requireEntireScreen: true },
    };
    mockStoredAnswer = {
      ...mockStoredAnswer,
      assetIdentifier: 'intro_previous_screen_segment',
      recordingSegments: ['intro_previous_screen_segment'],
    };
    mockScreenCaptureActive = true;
    renderToStaticMarkup(<HookHarness />);

    await capturedGoToNextStep?.();
    expect(mockSaveTrialAnswer).toHaveBeenCalledWith(expect.objectContaining({
      assetIdentifier: 'intro_screen_visit',
      recordingSegments: ['intro_previous_screen_segment', 'intro_screen_visit'],
    }));
  });

  test('does not create recording metadata when whole-screen recording is disabled for the task', async () => {
    mockStudyConfig = {
      components: {
        intro: { recordScreen: false, recordAudio: false, recordWebcam: false },
      },
      uiConfig: {
        recordScreen: true, recordAudio: true, recordWebcam: true, requireEntireScreen: true,
      },
    };
    mockCurrentIdentifier = 'adaptive_0_intro_0';
    mockStoredAnswer = {
      ...mockStoredAnswer, componentName: 'intro', identifier: mockCurrentIdentifier, trialOrder: '0_0',
    };
    mockAnswers = { [mockCurrentIdentifier]: mockStoredAnswer };
    mockTrialValidation = { [mockCurrentIdentifier]: mockTrialValidation.intro_0 };
    mockScreenCaptureActive = false;
    renderToStaticMarkup(<HookHarness />);

    await capturedGoToNextStep?.();

    expect(mockSaveTrialAnswer).toHaveBeenCalledWith(expect.not.objectContaining({
      assetIdentifier: expect.any(String),
      recordingSegments: expect.any(Array),
      recordingSegmentRanges: expect.any(Array),
    }));
  });

  test('retains an audio-only segment without inventing a screen recording range', async () => {
    mockScreenCaptureActive = true;
    mockStudyConfig = {
      components: {
        intro: { recordScreen: false, recordAudio: true, recordWebcam: false },
      },
      uiConfig: {
        recordScreen: true, recordAudio: false, recordWebcam: false, requireEntireScreen: true,
      },
    };
    mockStoredAnswer = { ...mockStoredAnswer, componentName: 'intro' };
    renderToStaticMarkup(<HookHarness />);

    await capturedGoToNextStep?.();

    expect(mockSaveTrialAnswer).toHaveBeenCalledWith(expect.objectContaining({
      assetIdentifier: 'intro_screen_visit',
      recordingSegments: ['intro_screen_visit'],
      recordingSegmentRanges: [],
    }));
  });

  test('does not disable next when stimulus validation fails', () => {
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

    expect(capturedIsNextDisabled).toBe(false);
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
      uiConfig: {},
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
      uiConfig: {},
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
