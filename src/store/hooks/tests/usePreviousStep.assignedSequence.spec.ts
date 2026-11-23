import { act, renderHook } from '@testing-library/react';
import {
  beforeEach, expect, test, vi,
} from 'vitest';
import { parseStudyConfig } from '../../../parser/parser';
import { generateSequenceArray } from '../../../utils/handleRandomSequences';
import { getSequenceFlatMap } from '../../../utils/getSequenceFlatMap';
import { encryptIndex } from '../../../utils/encryptDecryptIndex';
import { usePreviousStep } from '../usePreviousStep';
import type { StudyConfig } from '../../../parser/types';
import type { StoreState } from '../../types';

const context = vi.hoisted(() => ({
  config: {} as StudyConfig,
  state: {} as StoreState,
  step: 2,
  params: {} as { funcIndex?: string },
  navigate: vi.fn(),
  dispatch: vi.fn(),
  windowEvents: undefined as undefined | { finalizeVisit?: (beforeComplete?: () => Promise<void>) => Promise<boolean> },
  deleteDynamicBlockAnswers: vi.fn((payload) => ({ type: 'deleteDynamicBlockAnswers', payload })),
}));

vi.mock('react-router', () => ({
  useParams: () => context.params,
  useNavigate: () => context.navigate,
}));
vi.mock('react-redux', () => ({
}));
vi.mock('../../../routes/utils', () => ({
  useCurrentStep: () => context.step,
  useStudyId: () => 'assigned-study',
}));
vi.mock('../useIsAnalysis', () => ({ useIsAnalysis: () => false }));
vi.mock('../useStudyConfig', () => ({ useStudyConfig: () => context.config }));
vi.mock('../../store', () => ({
  useStoreSelector: (selector: (state: StoreState) => unknown) => selector(context.state),
  useStoreDispatch: () => context.dispatch,
  useStoreActions: () => ({ deleteDynamicBlockAnswers: context.deleteDynamicBlockAnswers }),
}));
vi.mock('../useWindowEvents', () => ({ useOptionalWindowEvents: () => context.windowEvents }));

beforeEach(() => {
  vi.clearAllMocks();
  context.windowEvents = undefined;
  context.step = 2;
  context.params = {};
});

async function prepareParticipant(filtered: boolean) {
  const config: StudyConfig = {
    $schema: '',
    studyMetadata: {
      title: 'Assigned sequence', version: '1', authors: [], date: '', description: '', organizations: [],
    },
    uiConfig: {
      logoPath: '', contactEmail: '', withProgressBar: false, withSidebar: false, numSequences: 2,
    },
    factors: { arm: [1, 2] },
    ...(filtered ? { betweenSubjects: ['arm'] } : {}),
    components: {
      intro: { type: 'questionnaire', response: [] },
      question: { type: 'questionnaire', response: [] },
      final: { type: 'questionnaire', response: [], previousButton: true },
    },
    baseComponents: { trial: { type: 'questionnaire', response: [] } },
    sequence: {
      order: 'fixed',
      components: [
        filtered ? {
          type: 'factor', id: 'trials', factor: 'arm', components: 'trial',
        } : 'intro',
        { order: 'dynamic', id: 'adaptive', functionPath: 'test-global-store/assets/dynamic.tsx' },
        'final',
      ],
    },
  };
  const parsed = await parseStudyConfig(JSON.stringify(config));
  expect(parsed.errors).toEqual([]);
  const assigned = generateSequenceArray(parsed)[0];
  context.config = parsed;
  context.state = {
    sequence: assigned,
    answers: {
      adaptive_1_question_0: {
        componentName: 'question', trialOrder: '1_0', startTime: 1, endTime: 2,
      },
      adaptive_1_question_1: {
        componentName: 'question', trialOrder: '1_1', startTime: 2, endTime: 3,
      },
    },
  } as unknown as StoreState;
  expect(getSequenceFlatMap(assigned).slice(1)).toEqual(['adaptive', 'final', 'end']);
  expect(getSequenceFlatMap(parsed.sequence)).toHaveLength(filtered ? 4 : 3);
}

test.each([false, true])('Previous returns to the last dynamic iteration (filtered=%s)', async (filtered) => {
  await prepareParticipant(filtered);
  const answersBefore = structuredClone(context.state.answers);
  const { result } = renderHook(() => usePreviousStep());

  await act(async () => { await result.current.goToPreviousStep(); });

  expect(context.navigate).toHaveBeenCalledExactlyOnceWith(`/assigned-study/${encryptIndex(1)}/${encryptIndex(1)}`);
  expect(context.dispatch).not.toHaveBeenCalled();
  expect(context.state.answers).toEqual(answersBefore);
});

test.each([false, true])('Previous within a dynamic block cleans up its assigned block (filtered=%s)', async (filtered) => {
  await prepareParticipant(filtered);
  context.step = 1;
  context.params = { funcIndex: encryptIndex(1) };
  const { result } = renderHook(() => usePreviousStep());

  await act(async () => { await result.current.goToPreviousStep(); });

  expect(context.deleteDynamicBlockAnswers).toHaveBeenCalledExactlyOnceWith({
    currentStep: 1, funcIndex: 1, funcName: 'adaptive',
  });
  expect(context.dispatch).toHaveBeenCalledExactlyOnceWith({
    type: 'deleteDynamicBlockAnswers', payload: { currentStep: 1, funcIndex: 1, funcName: 'adaptive' },
  });
  expect(context.navigate).toHaveBeenCalledExactlyOnceWith(`/assigned-study/${encryptIndex(1)}/${encryptIndex(0)}`);
});

test('Previous finalizes the recording before navigating away', async () => {
  await prepareParticipant(false);
  context.step = 1;
  context.params = { funcIndex: encryptIndex(0) };
  context.windowEvents = { finalizeVisit: vi.fn(async () => true) };
  const { result } = renderHook(() => usePreviousStep());

  await act(async () => { await result.current.goToPreviousStep(); });

  expect(context.windowEvents?.finalizeVisit).toHaveBeenCalledOnce();
  expect(context.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'deleteDynamicBlockAnswers' }));
  expect(context.navigate).toHaveBeenCalledExactlyOnceWith(`/assigned-study/${encryptIndex(0)}`);
});

test('Previous keeps its invocation lock while recording finalization is pending', async () => {
  await prepareParticipant(false);
  context.step = 1;
  context.params = { funcIndex: encryptIndex(0) };
  let completeFinalization!: (saved: boolean) => void;
  context.windowEvents = {
    finalizeVisit: vi.fn(() => new Promise<boolean>((resolve) => { completeFinalization = resolve; })),
  };
  const { result } = renderHook(() => usePreviousStep());

  let previousNavigation!: Promise<void>;
  act(() => { previousNavigation = result.current.goToPreviousStep(); });
  await act(async () => { await result.current.goToPreviousStep(); });

  expect(context.windowEvents.finalizeVisit).toHaveBeenCalledOnce();
  expect(context.navigate).not.toHaveBeenCalled();

  await act(async () => { completeFinalization(true); await previousNavigation; });
  expect(context.deleteDynamicBlockAnswers).toHaveBeenCalledOnce();
  expect(context.navigate).toHaveBeenCalledOnce();
});
