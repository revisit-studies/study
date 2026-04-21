import { renderHook, act } from '@testing-library/react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import { parseTrialOrder } from '../../utils/parseTrialOrder';
import { getComponent } from '../../utils/handleComponentInheritance';
import { decryptIndex } from '../../utils/encryptDecryptIndex';
import type { IndividualComponent } from '../../parser/types';
import { makeStudyConfig } from '../../tests/utils';
import {
  useStudyId, useCurrentStep, useCurrentComponent, useCurrentIdentifier,
} from '../utils';

vi.mock('@trrack/core', () => {
  const mockRegistry = {
    register: vi.fn(() => vi.fn()),
  };
  return {
    initializeTrrack: vi.fn(() => ({ apply: vi.fn(), state: {} })),
    createState: vi.fn(() => ({})),
    Registry: { create: vi.fn(() => mockRegistry) },
  };
});
vi.mock('@visdesignlab/upset2-react', () => ({
  Upset: () => null,
}));

// ── mutable state ─────────────────────────────────────────────────────────────

let mockParams: Record<string, string | undefined> = { studyId: 'test-study' };
let mockSearchParams = new URLSearchParams();
let mockNavigate = vi.fn();
let mockFlatSequence: string[] = ['intro', 'end'];
let mockAnswers: Record<string, Record<string, string | number | undefined>> = {};
const mockStudyConfig = makeStudyConfig({
  sequence: {
    id: 'root', order: 'fixed', components: ['intro', 'end'], skip: [],
  },
});

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

vi.mock('../../store/store', () => ({
  useFlatSequence: () => mockFlatSequence,
  useStoreActions: () => ({ pushToFuncSequence: vi.fn() }),
  useStoreDispatch: () => vi.fn(),
  useStoreSelector: (selector: (s: { answers: typeof mockAnswers }) => string | number | undefined) => selector({ answers: mockAnswers }),
}));

vi.mock('../../utils/encryptDecryptIndex', () => ({
  decryptIndex: vi.fn((x: string) => parseInt(x, 10)),
  encryptIndex: vi.fn((x: number) => String(x)),
}));

vi.mock('../../utils/parseTrialOrder', () => ({
  parseTrialOrder: vi.fn(() => ({ step: null, funcIndex: null })),
}));

vi.mock('../../utils/getSequenceFlatMap', () => ({
  findFuncBlock: vi.fn(() => null),
}));

vi.mock('../../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => mockStudyConfig,
}));

vi.mock('../../utils/handleComponentInheritance', () => ({
  getComponent: vi.fn(() => 'intro'),
  studyComponentToIndividualComponent: vi.fn(() => ({ response: [] })),
}));

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockParams = { studyId: 'test-study' };
  mockSearchParams = new URLSearchParams();
  mockNavigate = vi.fn();
  mockFlatSequence = ['intro', 'end'];
  mockAnswers = {};
  vi.mocked(parseTrialOrder).mockReturnValue({ step: null, funcIndex: null });
  vi.mocked(getComponent).mockReturnValue({ type: 'markdown', path: '/test.md', response: [] } as IndividualComponent);
  vi.mocked(decryptIndex).mockImplementation((x: string) => parseInt(x, 10));
});

describe('useStudyId', () => {
  test('returns the studyId param as a string', () => {
    mockParams = { studyId: 'my-study' };
    const { result } = renderHook(() => useStudyId());
    expect(result.current).toBe('my-study');
  });

  test('returns "undefined" string when studyId param is missing', () => {
    mockParams = {};
    const { result } = renderHook(() => useStudyId());
    expect(result.current).toBe('undefined');
  });
});

describe('useCurrentStep', () => {
  test('returns 0 when index param is undefined', () => {
    mockParams = { studyId: 'test-study' };
    const { result } = renderHook(() => useCurrentStep());
    expect(result.current).toBe(0);
  });

  test('returns the reviewer- prefix unchanged', () => {
    mockParams = { studyId: 'test-study', index: 'reviewer-5' };
    const { result } = renderHook(() => useCurrentStep());
    expect(result.current).toBe('reviewer-5');
  });

  test('returns __ prefix unchanged', () => {
    mockParams = { studyId: 'test-study', index: '__special' };
    const { result } = renderHook(() => useCurrentStep());
    expect(result.current).toBe('__special');
  });

  test('decrypts a normal index', () => {
    mockParams = { studyId: 'test-study', index: '3' };
    const { result } = renderHook(() => useCurrentStep());
    expect(result.current).toBe(3);
  });

  test('returns currentTrialStep when currentTrial search param is set and step is non-null', () => {
    mockSearchParams = new URLSearchParams('currentTrial=intro_0');
    mockAnswers = { intro_0: { trialOrder: '2_0' } };
    vi.mocked(parseTrialOrder).mockReturnValue({ step: 2, funcIndex: 0 });
    const { result } = renderHook(() => useCurrentStep());
    expect(result.current).toBe(2);
  });

  test('falls through to decrypted index when currentTrialStep is null', () => {
    mockSearchParams = new URLSearchParams('currentTrial=intro_0');
    mockAnswers = { intro_0: { trialOrder: undefined } };
    vi.mocked(parseTrialOrder).mockReturnValue({ step: null, funcIndex: null });
    mockParams = { studyId: 'test-study', index: '1' };
    const { result } = renderHook(() => useCurrentStep());
    expect(result.current).toBe(1);
  });
});

describe('useCurrentComponent', () => {
  test('returns "end" when flatSequence[currentStep] is "end"', async () => {
    mockParams = { studyId: 'test-study', index: '1' };
    mockFlatSequence = ['intro', 'end'];
    vi.mocked(getComponent).mockReturnValue(null);
    const { result } = renderHook(() => useCurrentComponent());
    expect(result.current).toBe('end');
  });

  test('returns the component name when currentComponent is truthy', async () => {
    mockParams = { studyId: 'test-study', index: '0' };
    mockFlatSequence = ['intro', 'end'];
    vi.mocked(getComponent).mockReturnValue({ type: 'markdown', path: '/test.md', response: [] } as IndividualComponent);
    const { result } = renderHook(() => useCurrentComponent());
    expect(result.current).toBe('intro');
  });

  test('returns stripped name when currentStep is reviewer- string', async () => {
    mockParams = { studyId: 'test-study', index: 'reviewer-intro' };
    vi.mocked(getComponent).mockReturnValue(null);
    const { result } = renderHook(() => useCurrentComponent());
    expect(result.current).toBe('intro');
  });

  test('returns "__dynamicLoading" when no component is resolved', async () => {
    mockParams = { studyId: 'test-study', index: '0' };
    mockFlatSequence = ['myFunc', 'end'];
    vi.mocked(getComponent).mockReturnValue(null);
    const { result } = renderHook(() => useCurrentComponent());
    expect(result.current).toBe('__dynamicLoading');
  });

  test('effect fires navigate when nextFunc is set and no funcIndex', async () => {
    mockParams = { studyId: 'test-study', index: '0' };
    mockFlatSequence = ['myFunc', 'end'];
    vi.mocked(getComponent).mockReturnValue(null);
    await act(async () => {
      renderHook(() => useCurrentComponent());
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('second effect: currentTrialStep === currentStep with funcIndex navigates to strip funcIndex', async () => {
    mockParams = { studyId: 'test-study', index: '2', funcIndex: '0' };
    mockSearchParams = new URLSearchParams('currentTrial=myFunc_2_C_0');
    mockAnswers = { myFunc_2_C_0: { trialOrder: '2_0' } };
    vi.mocked(parseTrialOrder).mockReturnValue({ step: 2, funcIndex: null });
    vi.mocked(decryptIndex).mockReturnValue(0);
    mockFlatSequence = ['myFunc', 'x', 'end'];
    vi.mocked(getComponent).mockReturnValue(null);
    await act(async () => {
      renderHook(() => useCurrentComponent());
    });
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('second effect: decryptedFuncIndex !== currentTrialFuncIndex triggers navigate', async () => {
    mockParams = { studyId: 'test-study', index: '2', funcIndex: '5' };
    mockSearchParams = new URLSearchParams('currentTrial=myFunc_2_C_1');
    mockAnswers = { myFunc_2_C_1: { trialOrder: '2_1' } };
    vi.mocked(parseTrialOrder).mockReturnValue({ step: 2, funcIndex: 1 });
    vi.mocked(decryptIndex).mockReturnValue(99); // decryptedFuncIndex=99 ≠ currentTrialFuncIndex=1
    mockFlatSequence = ['myFunc', 'x', 'end'];
    vi.mocked(getComponent).mockReturnValue(null);
    await act(async () => {
      renderHook(() => useCurrentComponent());
    });
    expect(mockNavigate).toHaveBeenCalled();
  });

  test('third effect: existing answer sets compName', async () => {
    mockParams = { studyId: 'test-study', index: '0', funcIndex: '0' };
    mockFlatSequence = ['myFunc', 'end'];
    mockAnswers = { myFunc_0_CompA_0: { componentName: 'CompA' } };
    vi.mocked(getComponent).mockReturnValue(null);
    vi.mocked(decryptIndex).mockReturnValue(0);
    const { result } = renderHook(() => useCurrentComponent());
    expect(result.current).toBe('CompA');
  });
});

describe('useCurrentIdentifier', () => {
  test('returns identifier with funcIndex when funcIndex is set', () => {
    mockParams = { studyId: 'test-study', index: '0', funcIndex: '0' };
    mockFlatSequence = ['intro', 'end'];
    vi.mocked(getComponent).mockReturnValue({ type: 'markdown', path: '/test.md', response: [] } as IndividualComponent);
    vi.mocked(decryptIndex).mockReturnValue(0);
    const { result } = renderHook(() => useCurrentIdentifier());
    expect(result.current).toBe('intro_0_intro_0');
  });

  test('returns short identifier without funcIndex', () => {
    mockParams = { studyId: 'test-study', index: '0' };
    mockFlatSequence = ['intro', 'end'];
    vi.mocked(getComponent).mockReturnValue({ type: 'markdown', path: '/test.md', response: [] } as IndividualComponent);
    const { result } = renderHook(() => useCurrentIdentifier());
    expect(result.current).toBe('intro_0');
  });
});
