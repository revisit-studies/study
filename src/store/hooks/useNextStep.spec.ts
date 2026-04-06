import { renderHook, act } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import { findBlockForStep } from '../../utils/getSequenceFlatMap';
import { useNextStep } from './useNextStep';

// ── stable mocks ──────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
let mockFuncIndex: string | undefined;
let mockTrialValidation: Record<string, unknown> = {};
let mockAnswers: Record<string, unknown> = {};
let mockStorageEngine: { saveAnswers: (a: Record<string, unknown>) => void } | null = null;

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ studyId: 'test-study', index: '0', funcIndex: mockFuncIndex }),
}));

vi.mock('../store', () => ({
  useStoreSelector: (selector: (s: Record<string, unknown>) => unknown) => selector({
    trialValidation: mockTrialValidation,
    sequence: {
      id: 'root',
      orderPath: 'root',
      order: 'fixed',
      components: ['intro', 'end'],
      skip: [],
    },
    answers: mockAnswers,
    reactiveAnswers: {},
    modes: { dataCollectionEnabled: true, developmentModeEnabled: false },
    clickedPrevious: false,
    config: {
      components: {
        intro: { type: 'markdown', path: 'intro.md', response: [] },
      },
      sequence: {
        order: 'fixed', components: ['intro', 'end'], orderPath: 'root', skip: [],
      },
    },
  }),
  useStoreActions: () => ({
    saveTrialAnswer: vi.fn(),
    setReactiveAnswers: vi.fn(),
    setMatrixAnswersRadio: vi.fn(),
    setMatrixAnswersCheckbox: vi.fn(),
    setRankingAnswers: vi.fn(),
  }),
  useStoreDispatch: () => mockDispatch,
  useAreResponsesValid: () => ({ valid: true, invalidIds: [] }),
  useFlatSequence: () => ['intro', 'end'],
}));

vi.mock('../../routes/utils', () => ({
  useCurrentIdentifier: () => 'intro_0',
  useCurrentStep: () => 0,
  useStudyId: () => 'test-study',
}));

vi.mock('../../storage/storageEngineHooks', () => ({
  useStorageEngine: () => ({ storageEngine: mockStorageEngine }),
}));

vi.mock('./useStoredAnswer', () => ({
  useStoredAnswer: () => ({
    answer: {},
    startTime: 0,
    endTime: -1,
    provenanceGraph: {},
    windowEvents: [],
    componentName: 'intro_0',
    identifier: 'intro_0',
  }),
}));

vi.mock('./useWindowEvents', () => ({
  useWindowEvents: () => [],
}));

vi.mock('../../utils/getSequenceFlatMap', () => ({
  findBlockForStep: vi.fn(() => null),
  findIndexOfBlock: vi.fn(() => -1),
}));

vi.mock('./useStudyConfig', () => ({
  useStudyConfig: () => ({
    components: {
      intro: { type: 'markdown', path: 'intro.md', response: [] },
    },
    sequence: {
      order: 'fixed', components: ['intro', 'end'], orderPath: 'root', skip: [],
    },
  }),
}));

vi.mock('../../utils/encryptDecryptIndex', () => ({
  decryptIndex: (s: string) => parseInt(s, 10),
  encryptIndex: (i: number) => String(i),
}));

vi.mock('./useIsAnalysis', () => ({
  useIsAnalysis: () => false,
}));

vi.mock('../../utils/correctAnswer', () => ({
  componentAnswersAreCorrect: vi.fn(() => true),
}));

// ── tests ─────────────────────────────────────────────────────────────────────

describe('useNextStep', () => {
  test('returns an object with goToNextStep function', () => {
    mockTrialValidation = {};
    mockAnswers = {};
    const { result } = renderHook(() => useNextStep());
    expect(typeof result.current.goToNextStep).toBe('function');
  });

  test('returns isNextDisabled boolean', () => {
    const { result } = renderHook(() => useNextStep());
    expect(typeof result.current.isNextDisabled).toBe('boolean');
  });

  test('goToNextStep dispatches store actions and navigates', () => {
    mockTrialValidation = {};
    mockAnswers = {};
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('goToNextStep with collectData=false still navigates', () => {
    mockTrialValidation = {};
    mockAnswers = {};
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(false); });
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('goToNextStep with funcIndex navigates to funcIndex+1 path', () => {
    mockFuncIndex = '1';
    mockTrialValidation = {};
    mockAnswers = {};
    mockNavigate.mockClear();
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/2'));
    mockFuncIndex = undefined;
  });

  test('goToNextStep with trialValidation entries containing values covers reduce paths', () => {
    // Covers lines 89-93: trialValidationCopy reduce with/without `values` key
    mockTrialValidation = {
      intro_0: {
        block1: { values: { r1: 'A' } }, // hasOwn 'values' branch
        block2: { status: 'valid' }, // no 'values' branch
      },
    };
    mockAnswers = {};
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalled();
    mockTrialValidation = {};
  });

  test('goToNextStep with storageEngine saves answers', () => {
    // Covers lines 120-122: storageEngine.saveAnswers call
    const mockSaveAnswers = vi.fn();
    mockStorageEngine = { saveAnswers: mockSaveAnswers };
    mockTrialValidation = {};
    mockAnswers = {};
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockSaveAnswers).toHaveBeenCalled();
    mockStorageEngine = null;
  });

  test('goToNextStep with skip block that has no matching components exits early', () => {
    mockTrialValidation = {};
    mockAnswers = {};
    vi.mocked(findBlockForStep).mockReturnValueOnce([
      {
        currentBlock: {
          id: 'root',
          orderPath: 'root',
          order: 'fixed' as const,
          components: [],
          skip: [{
            name: 'nonexistent',
            check: 'response' as const,
            responseId: 'r1',
            comparison: 'equal' as const,
            value: 'yes',
            to: 'end',
          }],
        },
        firstIndex: 0,
        lastIndex: 1,
      },
    ]);
    mockNavigate.mockClear();
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    // navigates to next step (skip condition not triggered since no matching answers)
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('goToNextStep with response check skip condition (condition not triggered)', () => {
    // Covers lines 175-180: response check path (condition.check === 'response')
    mockTrialValidation = {};
    mockAnswers = {};
    vi.mocked(findBlockForStep).mockReturnValueOnce([
      {
        currentBlock: {
          id: 'root',
          orderPath: 'root',
          order: 'fixed' as const,
          components: ['intro', 'end'],
          skip: [{
            name: 'intro', // matches 'intro_0' component
            check: 'response' as const,
            responseId: 'r1',
            comparison: 'equal' as const,
            value: 'yes', // won't match since answer is {}
            to: 'end',
          }],
        },
        firstIndex: 0,
        lastIndex: 1,
      },
    ]);
    mockNavigate.mockClear();
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('goToNextStep with response check skip condition (condition triggered, jumps to target)', () => {
    // Covers lines 200-205: conditionIsTriggered = true, nextStep updated
    mockTrialValidation = {};
    mockAnswers = {};
    vi.mocked(findBlockForStep).mockReturnValueOnce([
      {
        currentBlock: {
          id: 'root',
          orderPath: 'root',
          order: 'fixed' as const,
          components: ['intro', 'end'],
          skip: [{
            name: 'intro',
            check: 'response' as const,
            responseId: 'r1',
            comparison: 'notEqual' as const,
            value: 'yes', // 'yes' !== undefined → triggered
            to: 'end',
          }],
        },
        firstIndex: 0,
        lastIndex: 1,
      },
    ]);
    mockNavigate.mockClear();
    const { result } = renderHook(() => useNextStep());
    act(() => { result.current.goToNextStep(); });
    // Should navigate to 'end' (index 1 in ['intro', 'end'])
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/1'));
  });
});
