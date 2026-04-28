import { renderToStaticMarkup } from 'react-dom/server';
import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { usePreviousStep } from './usePreviousStep';

const mockNavigate = vi.fn();
const mockDeleteDynamicBlockAnswers = vi.fn((payload) => ({ type: 'deleteDynamicBlockAnswers', payload }));
const mockDispatch = vi.fn();

let mockCurrentStep = 1;
let mockFuncIndex: string | undefined;
let mockIsAnalysis = false;
let capturedHook: ReturnType<typeof usePreviousStep> | undefined;

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ funcIndex: mockFuncIndex }),
}));

vi.mock('../../routes/utils', () => ({
  useCurrentStep: () => mockCurrentStep,
  useStudyId: () => 'study-1',
}));

vi.mock('./useIsAnalysis', () => ({
  useIsAnalysis: () => mockIsAnalysis,
}));

vi.mock('./useStudyConfig', () => ({
  useStudyConfig: () => ({
    sequence: {
      order: 'fixed',
      components: ['intro', 'dynamic-block', 'end'],
    },
  }),
}));

vi.mock('../../utils/getSequenceFlatMap', () => ({
  getSequenceFlatMap: () => ['intro', 'dynamic-block', 'end'],
  findFuncBlock: (componentId: string) => (componentId === 'dynamic-block' ? { id: 'dynamic-block' } : null),
}));

vi.mock('../../utils/encryptDecryptIndex', () => ({
  decryptIndex: (value: string) => Number(value),
  encryptIndex: (value: number) => `enc-${value}`,
}));

vi.mock('../store', () => ({
  useStoreDispatch: () => mockDispatch,
  useStoreActions: () => ({
    deleteDynamicBlockAnswers: mockDeleteDynamicBlockAnswers,
  }),
  useStoreSelector: (selector: (state: { answers: Record<string, { trialOrder: string }> }) => unknown) => selector({
    answers: {
      dynamicBlock_1_component_0: { trialOrder: '1_0' },
      dynamicBlock_1_component_1: { trialOrder: '1_1' },
    },
  }),
}));

function HookHarness() {
  capturedHook = usePreviousStep();
  return null;
}

describe('usePreviousStep', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockDeleteDynamicBlockAnswers.mockClear();
    mockDispatch.mockReset();
    mockCurrentStep = 1;
    mockFuncIndex = undefined;
    mockIsAnalysis = false;
    capturedHook = undefined;

    vi.stubGlobal('window', {
      location: { search: '?participantId=p-1' },
    });
  });

  test('keeps the previous button enabled during analysis replay', () => {
    mockIsAnalysis = true;

    renderToStaticMarkup(<HookHarness />);

    expect(capturedHook?.isPreviousDisabled).toBe(false);
  });

  test('does not delete dynamic replay answers when moving backward in analysis replay', () => {
    mockIsAnalysis = true;
    mockFuncIndex = '1';

    renderToStaticMarkup(<HookHarness />);

    capturedHook?.goToPreviousStep();

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/study-1/enc-1/enc-0?participantId=p-1');
  });
});
