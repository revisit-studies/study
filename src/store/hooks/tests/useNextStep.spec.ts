import { renderHook, act } from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { StudyConfig } from '../../../parser/types';
import type { Sequence, StoredAnswer } from '../../types';
import { areComponentAnswersCorrect, getSkipConditionCorrectAnswers } from '../useNextStep.utils';
import { useNextStep } from '../useNextStep';

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
let mockSequence = defaultSequence;
let mockModes = { dataCollectionEnabled: true, developmentModeEnabled: false, dataSharingEnabled: false };
let mockNavigate = vi.fn();
let mockFuncIndex: string | null = null;
let mockAreResponsesValid = true;
let mockIsAnalysis = false;
let mockStoredAnswer = defaultStoredAnswer;
let mockSaveAnswers = vi.fn();
let mockDispatch = vi.fn();
let mockSaveTrialAnswer = vi.fn();

// ── module mocks ─────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ funcIndex: mockFuncIndex }),
}));

vi.mock('../../store', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  useStoreSelector: (selector: Function) => selector({
    trialValidation: mockTrialValidation,
    sequence: mockSequence,
    answers: mockAnswers,
    modes: mockModes,
    clickedPrevious: false,
  }),
  useStoreDispatch: () => mockDispatch,
  useStoreActions: () => ({
    saveTrialAnswer: mockSaveTrialAnswer,
    setReactiveAnswers: vi.fn(),
    setMatrixAnswersCheckbox: vi.fn(),
    setMatrixAnswersRadio: vi.fn(),
    setRankingAnswers: vi.fn(),
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
  useStorageEngine: () => ({ storageEngine: { saveAnswers: mockSaveAnswers } }),
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

vi.mock('../useStudyConfig', () => ({
  // eslint-disable-next-line no-use-before-define
  useStudyConfig: () => createStudyConfig(),
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  decryptIndex: (x: string) => parseInt(x, 10),
  encryptIndex: (x: number) => String(x),
}));

vi.mock('../useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

function createStudyConfig(): StudyConfig {
  return {
    $schema: '',
    studyMetadata: {
      title: 'Skip logic regression test',
      version: '1.0.0',
      authors: ['Test'],
      date: '2026-03-25',
      description: 'Regression coverage for block skip correctness',
      organizations: ['Test Org'],
    },
    uiConfig: {
      contactEmail: 'test@test.com',
      helpTextPath: '',
      logoPath: '',
      withProgressBar: true,
      autoDownloadStudy: false,
      withSidebar: true,
    },
    baseComponents: {
      trial: {
        type: 'questionnaire',
        response: [
          {
            id: 'q1',
            type: 'radio',
            prompt: 'Favorite color',
            options: ['Blue', 'Red'],
          },
          {
            id: 'q2',
            type: 'radio',
            prompt: 'Favorite animal',
            options: ['Cat', 'Dog'],
          },
        ],
      },
    },
    components: {
      trial1: {
        baseComponent: 'trial',
        correctAnswer: [
          {
            id: 'q1',
            answer: 'Blue',
          },
          {
            id: 'q2',
            answer: 'Cat',
          },
        ],
      },
      attentionCheck: {
        type: 'questionnaire',
        response: [
          {
            id: 'q1',
            type: 'radio',
            prompt: 'Are you paying attention?',
            options: ['Yes', 'No'],
          },
        ],
        correctAnswer: [
          {
            id: 'q1',
            answer: 'Yes',
          },
        ],
      },
    },
    sequence: {
      order: 'fixed',
      components: ['trial1', 'attentionCheck'],
    },
  };
}

describe('areComponentAnswersCorrect', () => {
  it('returns true when component has no correctAnswer', () => {
    const config = createStudyConfig();
    const noCorrectAnswer = { type: 'questionnaire' as const, response: [] };
    config.components.noAnswer = noCorrectAnswer;

    expect(areComponentAnswersCorrect({ q1: 'anything' }, config.components.noAnswer, config)).toBe(true);
  });

  it('returns true when all answers match correctAnswer', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'Blue', q2: 'Cat' }, config.components.trial1, config)).toBe(true);
  });

  it('returns false when an answer is wrong', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'Red', q2: 'Cat' }, config.components.trial1, config)).toBe(false);
  });

  it('returns false when an answer is missing', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'Blue' }, config.components.trial1, config)).toBe(false);
  });

  it('returns true for attention check with correct answer', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'Yes' }, config.components.attentionCheck, config)).toBe(true);
  });

  it('returns false for attention check with wrong answer', () => {
    const config = createStudyConfig();
    expect(areComponentAnswersCorrect({ q1: 'No' }, config.components.attentionCheck, config)).toBe(false);
  });
});

describe('getSkipConditionCorrectAnswers', () => {
  it('uses each candidate component config when counting block correctness', () => {
    const studyConfig = createStudyConfig();

    const correctAnswers = getSkipConditionCorrectAnswers([
      ['trial1_0', { answer: { q1: 'Blue', q2: 'Cat' } }],
      ['attentionCheck_1', { answer: { q1: 'No' } }],
    ], studyConfig);

    expect(correctAnswers).toEqual([true, false]);
  });

  it('returns empty array for empty input', () => {
    const config = createStudyConfig();
    expect(getSkipConditionCorrectAnswers([], config)).toEqual([]);
  });

  it('returns all true when every answer is correct', () => {
    const config = createStudyConfig();
    const result = getSkipConditionCorrectAnswers([
      ['trial1_0', { answer: { q1: 'Blue', q2: 'Cat' } }],
      ['attentionCheck_1', { answer: { q1: 'Yes' } }],
    ], config);
    expect(result).toEqual([true, true]);
  });

  it('returns all false when every answer is wrong', () => {
    const config = createStudyConfig();
    const result = getSkipConditionCorrectAnswers([
      ['trial1_0', { answer: { q1: 'Red', q2: 'Dog' } }],
      ['attentionCheck_1', { answer: { q1: 'No' } }],
    ], config);
    expect(result).toEqual([false, false]);
  });

  it('extracts component name correctly with multiple underscores', () => {
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
    mockSaveAnswers = vi.fn();
    mockDispatch = vi.fn();
    mockSaveTrialAnswer = vi.fn();
  });

  it('isNextDisabled is false when step is a number, not analysis, and responses are valid', () => {
    const { result } = renderHook(() => useNextStep());
    expect(result.current.isNextDisabled).toBe(false);
  });

  it('isNextDisabled is true when currentStep is a string', () => {
    mockCurrentStep = 'reviewer-0';
    const { result } = renderHook(() => useNextStep());
    expect(result.current.isNextDisabled).toBe(true);
  });

  it('isNextDisabled is true when isAnalysis is true', () => {
    mockIsAnalysis = true;
    const { result } = renderHook(() => useNextStep());
    expect(result.current.isNextDisabled).toBe(true);
  });

  it('isNextDisabled is true when responses are invalid', () => {
    mockAreResponsesValid = false;
    const { result } = renderHook(() => useNextStep());
    expect(result.current.isNextDisabled).toBe(true);
  });

  it('goToNextStep navigates to next step', () => {
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalledWith('/test-study/1');
  });

  it('goToNextStep dispatches saveTrialAnswer and clears form state', () => {
    mockStoredAnswer = defaultStoredAnswer;
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockSaveTrialAnswer).toHaveBeenCalled();
  });

  it('goToNextStep saves answers to storage engine', () => {
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockSaveAnswers).toHaveBeenCalled();
  });

  it('goToNextStep does nothing when currentStep is not a number', () => {
    mockCurrentStep = 'reviewer-0';
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('goToNextStep(false) marks answer as timed out', () => {
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(false); });
    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as Record<string, object | boolean>;
    expect(savedPayload.timedOut).toBe(true);
    expect(savedPayload.answer).toEqual({});
  });

  it('goToNextStep collects answers from trialValidation', () => {
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
    act(() => { result.current.goToNextStep(); });
    const savedPayload = mockSaveTrialAnswer.mock.calls[0][0] as Record<string, object | boolean>;
    expect(savedPayload.answer).toEqual({ q1: 'Blue', q2: 'Cat' });
  });

  it('goToNextStep navigates with funcIndex increment when funcIndex is set', () => {
    mockFuncIndex = '0';
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalledWith('/test-study/0/1');
  });

  it('goToNextStep skips saving when data collection is disabled', () => {
    mockModes = { dataCollectionEnabled: false, developmentModeEnabled: false, dataSharingEnabled: false };
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockSaveTrialAnswer).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('goToNextStep skips saving when answer already has endTime > -1', () => {
    mockStoredAnswer = { endTime: 100 } as StoredAnswer;
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockSaveTrialAnswer).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('goToNextStep evaluates response skip condition and navigates to skip target', async () => {
    const { findBlockForStep } = await import('../../../utils/getSequenceFlatMap');
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
    act(() => { result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalledWith('/test-study/2');
  });
});
