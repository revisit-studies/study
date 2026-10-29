import { renderHook, act } from '@testing-library/react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { Response, StudyConfig } from '../../../parser/types';
import type {
  AssetStatus, CheckAnswerState, Sequence, StoredAnswer, StoreState, TrialValidation, TrrackedProvenance,
} from '../../types';
import { makeStudyConfig } from '../../../tests/utils';
import { areComponentAnswersCorrect, getSkipConditionCorrectAnswers } from '../useNextStep.utils';
import { useNextStep } from '../useNextStep';
import { findBlockForStep } from '../../../utils/getSequenceFlatMap';

// ── mutable state ────────────────────────────────────────────────────────────

const defaultSequence: Sequence = {
  id: 'root', orderPath: 'root', order: 'fixed', components: ['trial1', 'attentionCheck', 'end'], skip: [],
};
const defaultStoredAnswer = { endTime: -1 } as StoredAnswer;

let mockCurrentStep: number | string = 0;
let mockIdentifier = 'trial1_0';
let mockFlatSequence = ['trial1', 'attentionCheck', 'end'];
let mockAnswers: Record<string, StoredAnswer> = {};
let mockTrialValidation: TrialValidation = {};
let mockCheckAnswer: Record<string, CheckAnswerState> = {};
let mockSequence = defaultSequence;
let mockModes = { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false };
let mockNavigate = vi.fn();
let mockFuncIndex: string | null = null;
let mockAreResponsesValid = true;
let mockClickedPrevious = false;
let mockIsAnalysis = false;
let mockStoredAnswer = defaultStoredAnswer;
let mockStudyConfig: StudyConfig | null = null;
let mockSaveAnswers = vi.fn();
let mockSaveProvenance = vi.fn();
let mockFlushPendingParticipantData = vi.fn();
let mockDispatch = vi.fn();
let mockSaveTrialAnswer = vi.fn((payload) => ({ type: 'saveTrialAnswer', payload }));
const mockSetReactiveAnswers = vi.fn((payload) => ({ type: 'setReactiveAnswers', payload }));
const mockSetMatrixAnswersCheckbox = vi.fn((payload) => ({ type: 'setMatrixAnswersCheckbox', payload }));
const mockSetMatrixAnswersRadio = vi.fn((payload) => ({ type: 'setMatrixAnswersRadio', payload }));
const mockSetRankingAnswers = vi.fn((payload) => ({ type: 'setRankingAnswers', payload }));

// ── module mocks ─────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ funcIndex: mockFuncIndex }),
}));

vi.mock('../../store', async (importOriginal) => ({
  ...(await importOriginal() as object),
  useStoreSelector: <T>(selector: (s: StoreState) => T) => selector({
    trialValidation: mockTrialValidation,
    sequence: mockSequence,
    answers: mockAnswers,
    modes: mockModes,
    clickedPrevious: mockClickedPrevious,
    responseSubmitAttempted: { [mockIdentifier]: true },
    checkAnswer: mockCheckAnswer,
  } as StoreState),
  useStoreDispatch: () => mockDispatch,
  useStoreActions: () => ({
    saveTrialAnswer: mockSaveTrialAnswer,
    setReactiveAnswers: mockSetReactiveAnswers,
    setMatrixAnswersCheckbox: mockSetMatrixAnswersCheckbox,
    setMatrixAnswersRadio: mockSetMatrixAnswersRadio,
    setRankingAnswers: mockSetRankingAnswers,
  }),
  useAreResponsesValid: () => mockAreResponsesValid,
  useFlatSequence: () => mockFlatSequence,
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentStep: () => mockCurrentStep,
  useCurrentIdentifier: () => mockIdentifier,
  useStudyId: () => 'test-study',
}));

vi.mock('../../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({
    storageEngine: {
      saveAnswers: mockSaveAnswers,
      saveProvenance: mockSaveProvenance,
      flushPendingParticipantData: mockFlushPendingParticipantData,
    },
  }),
}));

vi.mock('../useStoredAnswer', () => ({
  useStoredAnswer: () => mockStoredAnswer,
}));

vi.mock('../useWindowEvents', () => ({
  useWindowEvents: () => ({ current: [] }),
}));

vi.mock('../../../utils/getSequenceFlatMap', () => ({
  findBlockForStep: vi.fn(() => null),
  findIndexOfBlock: vi.fn(() => -1),
}));

function createStudyConfig(): StudyConfig {
  return makeStudyConfig({
    baseComponents: {
      trial: {
        type: 'questionnaire',
        response: [
          {
            id: 'q1', type: 'radio', prompt: 'Favorite color', options: ['Blue', 'Red'],
          },
          {
            id: 'q2', type: 'radio', prompt: 'Favorite animal', options: ['Cat', 'Dog'],
          },
        ],
      },
    },
    components: {
      trial1: {
        baseComponent: 'trial',
        correctAnswer: [{ id: 'q1', answer: 'Blue' }, { id: 'q2', answer: 'Cat' }],
      },
      attentionCheck: {
        type: 'questionnaire',
        response: [
          {
            id: 'q1', type: 'radio', prompt: 'Are you paying attention?', options: ['Yes', 'No'],
          },
        ],
        correctAnswer: [{ id: 'q1', answer: 'Yes' }],
      },
    },
    sequence: {
      order: 'fixed',
      components: ['trial1', 'attentionCheck'],
    },
  });
}

vi.mock('../useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig ?? createStudyConfig(),
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  decryptIndex: (x: string) => parseInt(x, 10),
  encryptIndex: (x: number) => String(x),
}));

vi.mock('../useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

describe('areComponentAnswersCorrect', () => {
  test('returns true when component has no correctAnswer', () => {
    const config = createStudyConfig();
    const noCorrectAnswer = { type: 'questionnaire' as const, response: [] };
    config.components.noAnswer = noCorrectAnswer;

    expect(areComponentAnswersCorrect({ q1: 'anything' }, config.components.noAnswer, config)).toBe(true);
  });

  test('returns true when all answers match correctAnswer', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'Blue', q2: 'Cat' }, config.components.trial1, config)).toBe(true);
  });

  test('returns false when an answer is wrong', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'Red', q2: 'Cat' }, config.components.trial1, config)).toBe(false);
  });

  test('returns false when an answer is missing', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'Blue' }, config.components.trial1, config)).toBe(false);
  });

  test('returns true for attention check with correct answer', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'Yes' }, config.components.attentionCheck, config)).toBe(true);
  });

  test('returns false for attention check with wrong answer', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'No' }, config.components.attentionCheck, config)).toBe(false);
  });
});

describe('getSkipConditionCorrectAnswers', () => {
  test('uses each candidate component config when counting block correctness', () => {
    const studyConfig = createStudyConfig();

    const correctAnswers = getSkipConditionCorrectAnswers([
      ['trial1_0', { answer: { q1: 'Blue', q2: 'Cat' } }],
      ['attentionCheck_1', { answer: { q1: 'No' } }],
    ], studyConfig);

    expect(correctAnswers).toEqual([true, false]);
  });

  test('returns empty array for empty input', () => {
    const config = createStudyConfig();
    expect(getSkipConditionCorrectAnswers([], config)).toEqual([]);
  });

  test('returns all true when every answer is correct', () => {
    const config = createStudyConfig();
    const result = getSkipConditionCorrectAnswers([
      ['trial1_0', { answer: { q1: 'Blue', q2: 'Cat' } }],
      ['attentionCheck_1', { answer: { q1: 'Yes' } }],
    ], config);
    expect(result).toEqual([true, true]);
  });

  test('returns all false when every answer is wrong', () => {
    const config = createStudyConfig();
    const result = getSkipConditionCorrectAnswers([
      ['trial1_0', { answer: { q1: 'Red', q2: 'Dog' } }],
      ['attentionCheck_1', { answer: { q1: 'No' } }],
    ], config);
    expect(result).toEqual([false, false]);
  });

  test('extracts component name correctly with multiple underscores', () => {
    const config = createStudyConfig();
    const result = getSkipConditionCorrectAnswers([
      ['trial1_5', { answer: { q1: 'Blue', q2: 'Cat' } }],
    ], config);
    expect(result).toEqual([true]);
  });
});

// ── useNextStep hook tests ──────────────────────────────────────────────────

describe('useNextStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentStep = 0;
    mockIdentifier = 'trial1_0';
    mockFlatSequence = ['trial1', 'attentionCheck', 'end'];
    mockAnswers = {};
    mockTrialValidation = {};
    mockSequence = defaultSequence;
    mockModes = { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false };
    mockNavigate = vi.fn();
    mockFuncIndex = null;
    mockAreResponsesValid = true;
    mockIsAnalysis = false;
    mockStoredAnswer = defaultStoredAnswer;
    mockClickedPrevious = false;
    mockStudyConfig = null;
    mockSaveAnswers = vi.fn().mockResolvedValue(undefined);
    mockSaveProvenance = vi.fn().mockResolvedValue(undefined);
    mockFlushPendingParticipantData = vi.fn().mockResolvedValue(undefined);
    mockDispatch = vi.fn();
    mockSaveTrialAnswer = vi.fn((payload) => ({ type: 'saveTrialAnswer', payload }));
    mockCheckAnswer = {};
    mockSetReactiveAnswers.mockClear();
    mockSetMatrixAnswersCheckbox.mockClear();
    mockSetMatrixAnswersRadio.mockClear();
    mockSetRankingAnswers.mockClear();
  });

  test('isNextDisabled is false when step is a number, not analysis, and responses are valid', () => {
    const { result } = renderHook(() => useNextStep());
    expect(result.current.isNextDisabled).toBe(false);
  });

  test.each<{ status: AssetStatus | undefined; disabled: boolean }>([
    { status: 'loading', disabled: true },
    { status: 'error', disabled: true },
    { status: 'missing', disabled: false },
    { status: 'ready', disabled: false },
    { status: undefined, disabled: false },
  ])('asset status $status sets disabled=$disabled and guards navigation', async ({ status, disabled }) => {
    mockTrialValidation = {
      trial1_0: {
        assetStatus: status,
        stimulus: { valid: true, values: {} },
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: {} },
        sidebar: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined, belowStimulus: undefined, stimulus: undefined, sidebar: undefined,
        },
      },
    };
    const { result } = renderHook(() => useNextStep());

    expect(result.current.isNextDisabled).toBe(disabled);
    await act(async () => { await result.current.goToNextStep(); });

    if (disabled) {
      // Automatic advancement must respect the same asset gate.
      await act(async () => { await result.current.goToNextStep(false); });
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockSaveAnswers).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    } else {
      expect(mockNavigate).toHaveBeenCalledWith('/test-study/1');
      expect(mockSaveAnswers).toHaveBeenCalled();
    }
  });

  test('isNextDisabled is true when currentStep is a string', () => {
    mockCurrentStep = 'reviewer-0';
    const { result } = renderHook(() => useNextStep());
    expect(result.current.isNextDisabled).toBe(true);
  });

  test('isNextDisabled is true when isAnalysis is true', () => {
    mockIsAnalysis = true;
    const { result } = renderHook(() => useNextStep());
    expect(result.current.isNextDisabled).toBe(true);
  });

  test('isNextDisabled does not depend on response validity', () => {
    mockAreResponsesValid = false;
    const { result } = renderHook(() => useNextStep());
    expect(result.current.isNextDisabled).toBe(false);
  });

  test('retains original visit timing and window events when saving a later visit', async () => {
    const originalEvent = [100, 'mousedown', [1, 2]] as StoredAnswer['windowEvents'][number];
    mockStoredAnswer = {
      ...defaultStoredAnswer, startTime: 50, endTime: 200, windowEvents: [originalEvent],
    };
    // A trial reached through Previous is eligible to be saved again.
    mockClickedPrevious = true;
    const { result } = renderHook(() => useNextStep());
    await act(async () => { result.current.goToNextStep(); });
    const saved = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(saved.startTime).toBe(50);
    expect(saved.endTime).toBeGreaterThan(200);
    expect(saved.windowEvents[0]).toEqual(originalEvent);
  });

  test('goToNextStep navigates to next step', async () => {
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalledWith('/test-study/1');
  });

  test('goToNextStep dispatches saveTrialAnswer and clears form state', async () => {
    mockStoredAnswer = defaultStoredAnswer;
    mockClickedPrevious = false;
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockSaveTrialAnswer).toHaveBeenCalled();
  });

  test('goToNextStep saves answers to storage engine', async () => {
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockSaveAnswers).toHaveBeenCalled();
  });

  test('goToNextStep does nothing when currentStep is not a number', async () => {
    mockCurrentStep = 'reviewer-0';
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('goToNextStep persists checkAnswer state with the saved answer', async () => {
    mockCheckAnswer = { trial1_0: { attemptsUsed: 2, correct: true, responses: { q1: true } } };
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as Record<string, unknown>;
    expect(savedPayload.checkAnswer).toEqual({ attemptsUsed: 2, correct: true, responses: { q1: true } });
  });

  test('goToNextStep persists custom scorer results when a correct answer is configured', async () => {
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { q1: { score: 5 } } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const response = {
      id: 'q1', type: 'custom' as const, prompt: 'Score', path: 'test-response-functions/assets/CustomPartialScore.tsx',
    };
    const { result } = renderHook(() => useNextStep([response], [{ id: 'q1', answer: { score: 10 } }]));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toMatchObject({
      scores: { q1: 0.5 },
      answerSnapshot: { q1: { score: 5 } },
    });
  });

  test('submission keeps a required scorer-only response unresolved when its scorer returns null', async () => {
    mockCheckAnswer = {
      trial1_0: { attemptsUsed: 1, correct: true, responses: { scored: true } },
    };
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { scored: 5 } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const response: Response = {
      id: 'scored',
      type: 'numerical',
      prompt: '',
      path: 'test-response-functions/assets/PartialScore.response.ts',
    };
    const { result } = renderHook(() => useNextStep([response]));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toMatchObject({
      correct: false,
      responses: { scored: false },
    });
  });

  test('goToNextStep persists standalone scorer results without a correct answer', async () => {
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { q1: { score: 5 } } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const response = {
      id: 'q1', type: 'custom' as const, prompt: 'Score', path: 'test-response-functions/assets/CustomPartialScore.tsx',
    };
    const { result } = renderHook(() => useNextStep([response], []));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toMatchObject({
      correct: false,
      responses: {},
      scores: { q1: 0.5 },
      answerSnapshot: { q1: { score: 5 } },
    });
  });

  test('a scorer failure prevents another correct response from making submission correct', async () => {
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { ordinary: 'correct', unavailable: 5 } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const responses: Response[] = [{
      id: 'ordinary', type: 'shortText', prompt: 'Ordinary answer',
    }, {
      id: 'unavailable', type: 'numerical', prompt: 'Scored answer', path: 'missing.response.ts',
    }];
    const correctAnswers = [{ id: 'ordinary', answer: 'correct' }, { id: 'unavailable', answer: 5 }];
    const { result } = renderHook(() => useNextStep(responses, correctAnswers));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toMatchObject({
      correct: false,
    });
    expect(savedPayload.checkAnswer?.scores).toBeUndefined();
  });

  test('a missing standalone scorer cannot be skipped when another response is correct', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { ordinary: 'correct', unavailable: 5 } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const responses: Response[] = [{
      id: 'ordinary', type: 'shortText', prompt: 'Ordinary answer',
    }, {
      id: 'unavailable', type: 'numerical', prompt: 'Standalone scorer', path: 'missing.response.ts',
    }];
    const { result } = renderHook(() => useNextStep(responses, [{ id: 'ordinary', answer: 'correct' }]));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toMatchObject({ correct: false });
    consoleError.mockRestore();
  });

  test('submission keeps a required scorer-only I do not know response incorrect', async () => {
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: {
          valid: true,
          values: { ordinary: 'correct', scored: 10, 'scored-dontKnow': true },
        },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const responses: Response[] = [{
      id: 'ordinary', type: 'shortText', prompt: 'Ordinary answer',
    }, {
      id: 'scored',
      type: 'numerical',
      prompt: 'Scored answer',
      withDontKnow: true,
      path: 'test-response-functions/assets/GameScore.ts',
    }];
    const { result } = renderHook(() => useNextStep(responses, [{ id: 'ordinary', answer: 'correct' }]));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toMatchObject({ correct: false });
  });

  test('keeps Check Answer correctness when only an optional expected response is blank', async () => {
    mockCheckAnswer = {
      trial1_0: { attemptsUsed: 1, correct: true, responses: {} },
    };
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { optional: '' } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const response: Response = {
      id: 'optional', type: 'shortText', prompt: 'Optional answer', required: false,
    };
    const { result } = renderHook(() => useNextStep([response], [{ id: 'optional', answer: 'expected' }]));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toMatchObject({
      attemptsUsed: 1,
      correct: true,
      responses: {},
    });
  });

  test('does not mark a cleared last-scored optional answer correct at submission', async () => {
    mockCheckAnswer = {
      trial1_0: {
        attemptsUsed: 1,
        correct: true,
        responses: { optional: true },
        scores: { optional: 1 },
        answerSnapshot: { optional: 'previous answer' },
      },
    };
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { optional: '' } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const response: Response = {
      id: 'optional', type: 'shortText', prompt: 'Optional answer', required: false,
    };
    const { result } = renderHook(() => useNextStep([response], [{ id: 'optional', answer: 'expected' }]));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toMatchObject({
      correct: false,
      responses: {},
    });
    expect(savedPayload.checkAnswer?.scores).toBeUndefined();
  });

  test.each([
    { name: 'empty string', values: { q1: '' } },
    { name: 'empty array', values: { q1: [] } },
    { name: 'null', values: { q1: null } },
    { name: 'missing key', values: {} },
  ])('does not persist standalone scores for unanswered values ($name)', async ({ values }) => {
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const response = {
      id: 'q1', type: 'numerical' as const, prompt: 'Even number', path: 'test-response-functions/assets/EvenNumber.response.ts',
    };
    const { result } = renderHook(() => useNextStep([response], []));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toBeUndefined();
  });

  test.each([
    {
      name: 'custom object default',
      response: {
        id: 'q1',
        type: 'custom',
        prompt: 'Custom',
        required: false,
        default: {},
        path: 'test-response-functions/assets/CustomPartialScore.tsx',
      } as Response,
      value: {},
    },
    {
      name: 'matrix rows',
      response: {
        id: 'q1',
        type: 'matrix-radio',
        prompt: 'Matrix',
        required: false,
        answerOptions: ['A', 'B'],
        questionOptions: ['row'],
        default: { row: '' },
        path: 'test-response-functions/assets/EvenNumber.response.ts',
      } as Response,
      value: { row: '' },
    },
  ])('does not persist scores for recursively empty $name values', async ({ response, value }) => {
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { q1: value } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const { result } = renderHook(() => useNextStep([response], []));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toBeUndefined();
  });

  test('resubmission preserves a matching saved expected-answer score without a current validator', async () => {
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { q1: 5, choice: 'A', 'choice-other': '' } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    mockCheckAnswer = {
      trial1_0: {
        attemptsUsed: 1,
        correct: true,
        responses: { q1: true },
        scores: { q1: 0.9 },
        answerSnapshot: { q1: 5, choice: 'A' },
      },
    };
    const responses = [{
      id: 'q1', type: 'numerical' as const, prompt: 'Answer', path: 'missing.response.ts',
    }, {
      id: 'choice', type: 'radio' as const, prompt: 'Choice', options: ['A', 'other'], withOther: true,
    }];
    const { result } = renderHook(() => useNextStep(responses, [{ id: 'q1', answer: 10 }]));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.answer).toEqual({ q1: 5, choice: 'A' });
    expect(savedPayload.checkAnswer).toMatchObject({
      scores: { q1: 0.9 },
      answerSnapshot: { q1: 5, choice: 'A' },
    });
  });

  test('direct callers preserve an empty dynamic correct-answer override', async () => {
    const config = createStudyConfig();
    config.components.trial1 = {
      type: 'questionnaire',
      response: [{
        id: 'q1', type: 'numerical', prompt: 'Answer', path: 'test-response-functions/assets/PartialScore.response.ts',
      }],
      correctAnswer: [{ id: 'q1', answer: 10 }],
    };
    mockStudyConfig = config;
    mockStoredAnswer = { ...defaultStoredAnswer, componentName: 'trial1', correctAnswer: [] } as StoredAnswer;
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { q1: 5 } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined, belowStimulus: undefined, sidebar: undefined, stimulus: undefined,
        },
      },
    };

    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.correctAnswer).toEqual([]);
    expect(savedPayload.checkAnswer?.scores).toBeUndefined();
    expect(savedPayload.answer).toEqual({ q1: 5 });
  });

  test('direct callers resolve configured responses and persist their scores with the answer', async () => {
    const config = createStudyConfig();
    config.components.trial1 = {
      type: 'questionnaire',
      response: [{
        id: 'q1',
        type: 'custom',
        prompt: 'Score',
        path: 'test-response-functions/assets/CustomPartialScore.tsx',
      }],
      correctAnswer: [],
    };
    mockStudyConfig = config;
    mockStoredAnswer = { ...defaultStoredAnswer, componentName: 'trial1', correctAnswer: [] } as StoredAnswer;
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { q1: { score: 5 } } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };

    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.answer).toEqual({ q1: { score: 5 } });
    expect(savedPayload.checkAnswer).toMatchObject({
      scores: { q1: 0.5 },
      answerSnapshot: { q1: { score: 5 } },
    });
  });

  test('goToNextStep does not persist grading data for ordinary equality responses without Check Answer', async () => {
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { q1: 'expected' } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    const response = { id: 'q1', type: 'shortText' as const, prompt: 'Answer' };
    const { result } = renderHook(() => useNextStep([response], [{ id: 'q1', answer: 'expected' }]));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toBeUndefined();
  });

  test('goToNextStep replaces a checked score when the answer changed before submission', async () => {
    mockTrialValidation = {
      trial1_0: {
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: { q1: 5 } },
        sidebar: { valid: true, values: {} },
        stimulus: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          sidebar: undefined,
          stimulus: undefined,
        },
      },
    };
    mockCheckAnswer = {
      trial1_0: {
        attemptsUsed: 1, correct: true, responses: { q1: true }, scores: { q1: 1 }, answerSnapshot: { q1: 10 },
      },
    };
    const response = {
      id: 'q1', type: 'numerical' as const, prompt: 'Score', path: 'test-response-functions/assets/PartialScore.response.ts',
    };
    const correctAnswer = [{ id: 'q1', answer: 10 }];
    const { result } = renderHook(() => useNextStep([response], correctAnswer));
    await act(async () => { await result.current.goToNextStep(); });

    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as StoredAnswer;
    expect(savedPayload.checkAnswer).toMatchObject({
      attemptsUsed: 1,
      correct: false,
      responses: { q1: false },
      scores: { q1: 0.5 },
      answerSnapshot: { q1: 5 },
    });
  });

  test('goToNextStep(false) marks answer as timed out', async () => {
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(false); });
    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as Record<string, object | boolean>;
    expect(savedPayload.timedOut).toBe(true);
    expect(savedPayload.answer).toEqual({});
  });

  test('goToNextStep collects answers from trialValidation', async () => {
    mockTrialValidation = {
      trial1_0: {
        stimulus: { valid: true, values: { q1: 'Blue' } },
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: {} },
        sidebar: { valid: true, values: { q2: 'Cat' } },
        provenanceGraph: {
          aboveStimulus: undefined, belowStimulus: undefined, stimulus: undefined, sidebar: undefined,
        },
      },
    };
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as Record<string, object | boolean>;
    expect(savedPayload.answer).toEqual({ q1: 'Blue', q2: 'Cat' });
  });

  test('goToNextStep snapshots the provenance graph before saving it', async () => {
    const liveGraph: TrrackedProvenance = {
      root: 'a',
      current: 'a',
      nodes: {
        a: {
          id: 'a',
          label: 'Root',
          event: 'Root',
          createdOn: 0,
          artifacts: [],
          meta: { annotation: [], bookmark: [] },
          children: [],
          state: { type: 'checkpoint', val: {} },
          level: 0,
        },
      },
    };
    mockTrialValidation = {
      trial1_0: {
        stimulus: { valid: true, values: {} },
        aboveStimulus: { valid: true, values: { q1: 'Blue' } },
        belowStimulus: { valid: true, values: {} },
        sidebar: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: liveGraph, belowStimulus: undefined, stimulus: undefined, sidebar: undefined,
        },
      },
    };
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    const savedGraph = mockSaveProvenance.mock.calls[0][0] as TrialValidation[string]['provenanceGraph'];
    expect(savedGraph.aboveStimulus).toEqual(liveGraph);
    expect(savedGraph.aboveStimulus).not.toBe(liveGraph);
  });

  test('goToNextStep navigates with funcIndex increment when funcIndex is set', async () => {
    mockFuncIndex = '0';
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalledWith('/test-study/0/1');
  });

  test('goToNextStep skips saving when data collection is disabled', async () => {
    mockModes = { dataCollectionEnabled: false, developmentModeEnabled: false, dataSharingEnabled: false };
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockSaveTrialAnswer).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('goToNextStep skips saving when answer already has endTime > -1', async () => {
    mockStoredAnswer = { endTime: 100 } as StoredAnswer;
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockSaveTrialAnswer).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('goToNextStep evaluates response skip condition and navigates to skip target', async () => {
    vi.mocked(findBlockForStep).mockReturnValue([{
      currentBlock: {
        id: 'root',
        orderPath: 'root',
        order: 'fixed',
        components: ['trial1', 'attentionCheck', 'end'],
        skip: [{
          name: 'trial1',
          check: 'response',
          responseId: 'q1',
          value: 'Blue',
          comparison: 'equal',
          to: 'end',
        }],
      },
      firstIndex: 0,
      lastIndex: 2,
    }]);
    mockFlatSequence = ['trial1', 'attentionCheck', 'end'];
    mockTrialValidation = {
      trial1_0: {
        stimulus: { valid: true, values: { q1: 'Blue' } },
        aboveStimulus: { valid: true, values: {} },
        belowStimulus: { valid: true, values: {} },
        sidebar: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: undefined, belowStimulus: undefined, stimulus: undefined, sidebar: undefined,
        },
      },
    };
    mockAnswers = {};

    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalledWith('/test-study/2');
  });
});

vi.mock('../useGlobalStore', () => ({ useGlobalStore: () => ({}), useGlobalStoreUpdaterRegistration: () => () => () => undefined }));
