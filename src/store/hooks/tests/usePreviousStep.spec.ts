import { act, renderHook } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { usePreviousStep } from '../usePreviousStep';
import type { StoreState } from '../../types';

// --- module mocks ---
const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
const mockDeleteDynamicBlockAnswers = vi.fn(() => ({ type: 'deleteDynamicBlockAnswers' }));
const mockUseStoreSelector = vi.fn((selector: (s: StoreState) => unknown) => selector({ answers: {} } as StoreState));

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: vi.fn(() => ({})),
}));

vi.mock('../../../routes/utils', () => ({
  useCurrentStep: vi.fn(() => 1),
  useStudyId: vi.fn(() => 'my-study'),
}));

vi.mock('../useIsAnalysis', () => ({
  useIsAnalysis: vi.fn(() => false),
}));

vi.mock('../useStudyConfig', () => ({
  useStudyConfig: vi.fn(() => ({
    sequence: {
      order: 'fixed',
      orderPath: 'root',
      skip: [],
      components: ['intro', 'trial1', 'end'],
    },
  })),
}));

vi.mock('../../store', () => ({
  useStoreDispatch: () => mockDispatch,
  useStoreActions: () => ({ deleteDynamicBlockAnswers: mockDeleteDynamicBlockAnswers }),
  useStoreSelector: mockUseStoreSelector,
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (n: number) => String(n),
  decryptIndex: (s: string) => parseInt(s, 10),
}));

vi.mock('../../../utils/getSequenceFlatMap', () => ({
  getSequenceFlatMap: vi.fn(() => ['intro', 'trial1', 'end']),
  findFuncBlock: vi.fn(() => null),
}));

// Helper to change what useParams returns mid-test
const useParamsMock = await import('react-router').then((m) => m.useParams) as ReturnType<typeof vi.fn>;
const useCurrentStepMock = await import('../../../routes/utils').then((m) => m.useCurrentStep) as ReturnType<typeof vi.fn>;
const useIsAnalysisMock = await import('../useIsAnalysis').then((m) => m.useIsAnalysis) as ReturnType<typeof vi.fn>;
const getSequenceFlatMapMock = await import('../../../utils/getSequenceFlatMap').then((m) => m.getSequenceFlatMap) as ReturnType<typeof vi.fn>;
const findFuncBlockMock = await import('../../../utils/getSequenceFlatMap').then((m) => m.findFuncBlock) as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  useParamsMock.mockReturnValue({});
  useCurrentStepMock.mockReturnValue(1);
  useIsAnalysisMock.mockReturnValue(false);
  mockDispatch.mockReset();
  mockDeleteDynamicBlockAnswers.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isPreviousDisabled', () => {
  test('is false when currentStep is a positive number and not analysis', () => {
    const { result } = renderHook(() => usePreviousStep());
    expect(result.current.isPreviousDisabled).toBe(false);
  });

  test('is true when currentStep is 0', () => {
    useCurrentStepMock.mockReturnValue(0);
    const { result } = renderHook(() => usePreviousStep());
    expect(result.current.isPreviousDisabled).toBe(true);
  });

  test('is true when currentStep is a string (non-number)', () => {
    useCurrentStepMock.mockReturnValue('some-path');
    const { result } = renderHook(() => usePreviousStep());
    expect(result.current.isPreviousDisabled).toBe(true);
  });

  test('is false when in analysis mode with valid step', () => {
    useIsAnalysisMock.mockReturnValue(true);
    useCurrentStepMock.mockReturnValue(1);
    const { result } = renderHook(() => usePreviousStep());
    // isPreviousDisabled is based on step number, not analysis mode
    expect(result.current.isPreviousDisabled).toBe(false);
  });
});

describe('goToPreviousStep', () => {
  test('navigates to the previous step index', () => {
    useCurrentStepMock.mockReturnValue(2);
    const { result } = renderHook(() => usePreviousStep());
    act(() => result.current.goToPreviousStep());
    // previous step = 1; encryptIndex(1) = '1'
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/1'));
  });

  test('does nothing when currentStep is not a number', () => {
    useCurrentStepMock.mockReturnValue('root-path');
    const { result } = renderHook(() => usePreviousStep());
    act(() => result.current.goToPreviousStep());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('dispatches deleteDynamicBlockAnswers and navigates when in a funcIndex block', () => {
    useCurrentStepMock.mockReturnValue(1);
    useParamsMock.mockReturnValue({ funcIndex: '2' }); // funcIndex = '2' → decryptIndex = 2 → not 0 → stays in block
    const { result } = renderHook(() => usePreviousStep());
    act(() => result.current.goToPreviousStep());
    expect(mockDispatch).toHaveBeenCalled();
    // navigates to previous funcIndex: encryptIndex(2 - 1) = '1'
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/1/1'));
  });

  test('exits dynamic block when funcIndex is 0', () => {
    useCurrentStepMock.mockReturnValue(1);
    useParamsMock.mockReturnValue({ funcIndex: '0' }); // decryptIndex = 0
    const { result } = renderHook(() => usePreviousStep());
    act(() => result.current.goToPreviousStep());
    // dispatches delete, then falls through to normal navigate (previous step = 0 which is 'intro', not a func block)
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/0'));
  });

  // --- Analysis-specific tests from original file ---

  test('keeps the previous button enabled during analysis replay', () => {
    useIsAnalysisMock.mockReturnValue(true);
    const { result } = renderHook(() => usePreviousStep());
    expect(result.current.isPreviousDisabled).toBe(false);
  });

  test('keeps previous enabled for the first item inside a dynamic block', () => {
    useCurrentStepMock.mockReturnValue(0);
    useParamsMock.mockReturnValue({ funcIndex: '1' });
    const { result } = renderHook(() => usePreviousStep());
    expect(result.current.isPreviousDisabled).toBe(false);
  });

  test('does not delete dynamic replay answers when moving backward in analysis replay', async () => {
    useIsAnalysisMock.mockReturnValue(true);
    useParamsMock.mockReturnValue({ funcIndex: '1' });
    vi.mocked(getSequenceFlatMapMock).mockReturnValue(['intro', 'dynamic-block', 'end']);
    vi.mocked(findFuncBlockMock).mockReturnValue({ id: 'dynamic-block' } as never);

    const { result } = renderHook(() => usePreviousStep());
    act(() => result.current.goToPreviousStep());

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/1/0'));
  });

  test('skips unanswered dynamic blocks when moving backward in analysis replay', async () => {
    useIsAnalysisMock.mockReturnValue(true);
    useCurrentStepMock.mockReturnValue(2);
    vi.mocked(getSequenceFlatMapMock).mockReturnValue(['intro', 'dynamic-block', 'end']);
    vi.mocked(findFuncBlockMock).mockImplementation((componentId: string) => (
      componentId === 'dynamic-block' ? ({ id: 'dynamic-block' } as never) : null
    ));
    mockUseStoreSelector.mockImplementation((selector: (s: StoreState) => unknown) => selector({
      answers: { intro_0: { trialOrder: '0' } },
    } as unknown as StoreState));

    const { result } = renderHook(() => usePreviousStep());
    act(() => result.current.goToPreviousStep());

    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/0'));
  });
});
