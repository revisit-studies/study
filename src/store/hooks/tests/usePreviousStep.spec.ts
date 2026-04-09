import { act, renderHook } from '@testing-library/react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { usePreviousStep } from '../usePreviousStep';

// --- module mocks ---
const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
const mockDeleteDynamicBlockAnswers = vi.fn(() => ({ type: 'deleteDynamicBlockAnswers' }));

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
  useStoreSelector: vi.fn((selector: (s: { answers: Record<string, unknown> }) => unknown) => selector({ answers: {} })),
}));

vi.mock('../../../utils/encryptDecryptIndex', () => ({
  encryptIndex: (n: number) => String(n),
  decryptIndex: (s: string) => parseInt(s, 10),
}));

// Helper to change what useParams returns mid-test
const useParamsMock = await import('react-router').then((m) => m.useParams) as ReturnType<typeof vi.fn>;
const useCurrentStepMock = await import('../../../routes/utils').then((m) => m.useCurrentStep) as ReturnType<typeof vi.fn>;
const useIsAnalysisMock = await import('../useIsAnalysis').then((m) => m.useIsAnalysis) as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  useParamsMock.mockReturnValue({});
  useCurrentStepMock.mockReturnValue(1);
  useIsAnalysisMock.mockReturnValue(false);
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

  test('is true when in analysis mode', () => {
    useIsAnalysisMock.mockReturnValue(true);
    const { result } = renderHook(() => usePreviousStep());
    expect(result.current.isPreviousDisabled).toBe(true);
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
});
