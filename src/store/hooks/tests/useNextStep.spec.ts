import { renderHook, act } from '@testing-library/react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { StudyConfig } from '../../../parser/types';
import type { Sequence, StoredAnswer, StoreState } from '../../types';
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
let mockTrialValidation: Record<string, Record<string, object>> = {};
let mockCheckAnswer: Record<string, { attemptsUsed: number; correct: boolean; responses: Record<string, boolean> }> = {};
let mockSequence = defaultSequence;
let mockModes = { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false };
let mockNavigate = vi.fn();
let mockFuncIndex: string | null = null;
let mockAreResponsesValid = true;
let mockIsAnalysis = false;
let mockStoredAnswer = defaultStoredAnswer;
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

vi.mock('../../store', () => ({
  useStoreSelector: (selector: (s: StoreState) => unknown) => selector({
    trialValidation: mockTrialValidation,
    sequence: mockSequence,
    answers: mockAnswers,
    modes: mockModes,
    clickedPrevious: false,
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
  useStudyConfig: () => createStudyConfig(),
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

  test('goToNextStep navigates to next step', async () => {
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalledWith('/test-study/1');
  });

  test('goToNextStep dispatches saveTrialAnswer and clears form state', async () => {
    mockStoredAnswer = defaultStoredAnswer;
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
          aboveStimulus: null, belowStimulus: null, stimulus: null, sidebar: null,
        },
      },
    };
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as Record<string, object | boolean>;
    expect(savedPayload.answer).toEqual({ q1: 'Blue', q2: 'Cat' });
  });

  test('goToNextStep snapshots the provenance graph before saving it', async () => {
    const liveGraph = { nodes: { a: { id: 'a' } } };
    mockTrialValidation = {
      trial1_0: {
        stimulus: { valid: true, values: {} },
        aboveStimulus: { valid: true, values: { q1: 'Blue' } },
        belowStimulus: { valid: true, values: {} },
        sidebar: { valid: true, values: {} },
        provenanceGraph: {
          aboveStimulus: liveGraph, belowStimulus: null, stimulus: null, sidebar: null,
        },
      },
    };
    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    const savedGraph = mockSaveProvenance.mock.calls[0][0] as Record<string, object | null>;
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
          aboveStimulus: null, belowStimulus: null, stimulus: null, sidebar: null,
        },
      },
    };
    mockAnswers = {};

    const { result } = renderHook(() => useNextStep());
    await act(async () => { await result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalledWith('/test-study/2');
  });
});
