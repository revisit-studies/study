import { createElement } from 'react';
import { Provider } from 'react-redux';
import { renderHook } from '@testing-library/react';
import {
  describe, expect, test, vi,
} from 'vitest';
import {
  studyStoreCreator, useAreResponsesValid, useFlatSequence, useStoreActions, StudyStoreContext,
} from './store';
import type { StudyConfig } from '../parser/types';
import type { Sequence } from './types';
import type { ParticipantData } from '../storage/types';
import type { REVISIT_MODE } from '../storage/engines/types';
import { makeStoredAnswer } from '../tests/utils';

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: (_comp: object, _config: object) => ({
    response: [],
    correctAnswer: [],
  }),
}));

vi.mock('../utils/handleResponseRandomization', () => ({
  randomizeOptions: vi.fn(() => ({})),
  randomizeQuestionOrder: vi.fn(() => ({})),
  randomizeForm: vi.fn(() => []),
}));

vi.mock('../utils/getSequenceFlatMap', () => ({
  getSequenceFlatMap: vi.fn(() => ['intro', 'end']),
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const minimalConfig: StudyConfig = {
  $schema: '',
  studyMetadata: {
    title: 'Test',
    version: '1.0',
    authors: [],
    date: '2024-01-01',
    description: '',
    organizations: [],
  },
  uiConfig: {
    contactEmail: 'test@test.com',
    logoPath: '',
    withProgressBar: false,
    withSidebar: false,
    sidebarWidth: 0,
    studyEndMsg: '',
    windowEventDebounceTime: 100,
    showTitleBar: false,
  },
  components: {
    intro: { type: 'markdown' as const, path: 'intro.md', response: [] },
  },
  sequence: {
    order: 'fixed',
    components: ['intro', 'end'],
  },
};

const minimalSequence: Sequence = {
  id: 'root',
  orderPath: 'root',
  order: 'fixed',
  components: ['intro', 'end'],
  skip: [],
};

const emptyAnswers: ParticipantData['answers'] = {};

const modes: Record<REVISIT_MODE, boolean> = {
  dataCollectionEnabled: true,
  developmentModeEnabled: false,
  dataSharingEnabled: false,
};

const metadata = {
  userAgent: 'test-agent',
  resolution: { width: 1920, height: 1080 },
  language: 'en',
  ip: null,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('studyStoreCreator', () => {
  test('creates a store with dispatch and getState', async () => {
    const { store } = await studyStoreCreator(
      'test-study',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'participant-1',
      false,
      false,
    );
    expect(typeof store.dispatch).toBe('function');
    expect(typeof store.getState).toBe('function');
  });

  test('initial state has the correct studyId', async () => {
    const { store } = await studyStoreCreator(
      'my-study',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'participant-1',
      false,
      false,
    );
    expect(store.getState().studyId).toBe('my-study');
  });

  test('initial state has showStudyBrowser=true', async () => {
    const { store } = await studyStoreCreator(
      'test',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'p1',
      false,
      false,
    );
    expect(store.getState().showStudyBrowser).toBe(true);
  });

  test('actions object is defined', async () => {
    const { actions } = await studyStoreCreator(
      'test',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'p1',
      false,
      false,
    );
    expect(typeof actions.saveTrialAnswer).toBe('function');
    expect(typeof actions.toggleStudyBrowser).toBe('function');
    expect(typeof actions.setReactiveAnswers).toBe('function');
  });

  test('toggleStudyBrowser action toggles showStudyBrowser', async () => {
    const { store, actions } = await studyStoreCreator(
      'test',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'p1',
      false,
      false,
    );
    expect(store.getState().showStudyBrowser).toBe(true);
    store.dispatch(actions.toggleStudyBrowser());
    expect(store.getState().showStudyBrowser).toBe(false);
    store.dispatch(actions.toggleStudyBrowser());
    expect(store.getState().showStudyBrowser).toBe(true);
  });

  test('setAnalysisIsPlaying action updates analysisIsPlaying', async () => {
    const { store, actions } = await studyStoreCreator(
      'test',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'p1',
      false,
      false,
    );
    store.dispatch(actions.setAnalysisIsPlaying(true));
    expect(store.getState().analysisIsPlaying).toBe(true);
  });

  test('setMatrixAnswersRadio sets matrix answer', async () => {
    const { store, actions } = await studyStoreCreator(
      'test',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'p1',
      false,
      false,
    );
    store.dispatch(actions.setMatrixAnswersRadio({ responseId: 'r1', questionKey: 'q1', val: 'A' }));
    expect(store.getState().matrixAnswers.r1.q1).toBe('A');
  });

  test('setMatrixAnswersRadio with null clears matrix answers', async () => {
    const { store, actions } = await studyStoreCreator(
      'test',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'p1',
      false,
      false,
    );
    store.dispatch(actions.setMatrixAnswersRadio({ responseId: 'r1', questionKey: 'q1', val: 'A' }));
    store.dispatch(actions.setMatrixAnswersRadio(null));
    expect(store.getState().matrixAnswers).toEqual({});
  });

  test('setRankingAnswers sets ranking answer', async () => {
    const { store, actions } = await studyStoreCreator(
      'test',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'p1',
      false,
      false,
    );
    store.dispatch(actions.setRankingAnswers({ responseId: 'rank1', values: { item1: '1', item2: '2' } }));
    expect(store.getState().rankingAnswers.rank1).toEqual({ item1: '1', item2: '2' });
  });

  test('setParticipantCompleted action updates completed', async () => {
    const { store, actions } = await studyStoreCreator(
      'test',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'p1',
      false,
      false,
    );
    store.dispatch(actions.setParticipantCompleted(true));
    expect(store.getState().completed).toBe(true);
  });

  test('setClickedPrevious action updates clickedPrevious', async () => {
    const { store, actions } = await studyStoreCreator(
      'test',
      minimalConfig,
      minimalSequence,
      metadata,
      emptyAnswers,
      modes,
      'p1',
      false,
      false,
    );
    store.dispatch(actions.setClickedPrevious(true));
    expect(store.getState().clickedPrevious).toBe(true);
  });

  test('setConfig action updates config', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.setConfig(minimalConfig));
    expect(store.getState().config).toEqual(minimalConfig);
  });

  test('toggleShowHelpText action toggles showHelpText', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.toggleShowHelpText());
    expect(store.getState().showHelpText).toBe(true);
  });

  test('setAlertModal action updates alertModal', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.setAlertModal({ show: true, message: 'Test', title: 'Alert' }));
    expect(store.getState().alertModal).toEqual({ show: true, message: 'Test', title: 'Alert' });
  });

  test('setReactiveAnswers action updates reactiveAnswers', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.setReactiveAnswers({ r1: 'A' }));
    expect(store.getState().reactiveAnswers).toEqual({ r1: 'A' });
  });

  test('saveAnalysisState action updates analysisProvState', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.saveAnalysisState({ prov: { nodes: [] }, location: 'stimulus' }));
    expect(store.getState().analysisProvState.stimulus).toEqual({ nodes: [] });
  });

  test('setAnalysisHasAudio, HasScreenRecording, CanPlayScreenRecording, HasProvenance', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.setAnalysisHasAudio(true));
    expect(store.getState().analysisHasAudio).toBe(true);
    store.dispatch(actions.setAnalysisHasScreenRecording(true));
    expect(store.getState().analysisHasScreenRecording).toBe(true);
    store.dispatch(actions.setAnalysisCanPlayScreenRecording(true));
    expect(store.getState().analysisCanPlayScreenRecording).toBe(true);
    store.dispatch(actions.setAnalysisHasProvenance(true));
    expect(store.getState().analysisHasProvenance).toBe(true);
  });

  test('setProvenanceJumpTime action updates provenanceJumpTime', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.setProvenanceJumpTime(42));
    expect(store.getState().provenanceJumpTime).toBe(42);
  });

  test('setMatrixAnswersCheckbox sets and clears checkbox answers', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    const choiceOptions = [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }];
    store.dispatch(actions.setMatrixAnswersCheckbox({
      responseId: 'r1', questionKey: 'q1', value: 'A', label: 'A', isChecked: true, choiceOptions,
    }));
    expect(store.getState().matrixAnswers.r1.q1).toBe('A');
    store.dispatch(actions.setMatrixAnswersCheckbox({
      responseId: 'r1', questionKey: 'q1', value: 'B', label: 'B', isChecked: true, choiceOptions,
    }));
    expect(store.getState().matrixAnswers.r1.q1).toContain('B');
    store.dispatch(actions.setMatrixAnswersCheckbox({
      responseId: 'r1', questionKey: 'q1', value: 'A', label: 'A', isChecked: false, choiceOptions,
    }));
    expect(store.getState().matrixAnswers.r1.q1).not.toContain('A');
    store.dispatch(actions.setMatrixAnswersCheckbox(null));
    expect(store.getState().matrixAnswers).toEqual({});
  });

  test('emptyAnswers skips components not in config (return null path)', async () => {
    const { getSequenceFlatMap: mockGSFM } = await import('../utils/getSequenceFlatMap');
    (mockGSFM as ReturnType<typeof vi.fn>).mockReturnValueOnce(['intro', 'dynamicComp', 'end']);
    const { store } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    expect(store.getState().answers.intro_0).toBeDefined();
    expect(store.getState().answers.dynamicComp_1).toBeUndefined();
  });

  test('setRankingAnswers with null clears ranking answers', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.setRankingAnswers({ responseId: 'r1', values: { a: '1' } }));
    store.dispatch(actions.setRankingAnswers(null));
    expect(store.getState().rankingAnswers).toEqual({});
  });

  test('updateResponseBlockValidation updates trialValidation for known identifier', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.updateResponseBlockValidation({
      location: 'stimulus',
      identifier: 'intro_0',
      status: true,
      values: { r1: 'A' },
    }));
    expect(store.getState().trialValidation.intro_0?.stimulus?.valid).toBe(true);
    store.dispatch(actions.updateResponseBlockValidation({
      location: 'aboveStimulus',
      identifier: 'intro_0',
      status: false,
      values: {},
    }));
    expect(store.getState().trialValidation.intro_0?.aboveStimulus?.valid).toBe(false);
    store.dispatch(actions.updateResponseBlockValidation({
      location: 'stimulus',
      identifier: 'unknown_99',
      status: true,
      values: {},
    }));
  });

  test('saveTrialAnswer updates answers state', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.saveTrialAnswer(makeStoredAnswer({
      identifier: 'intro_0',
      componentName: 'intro',
      answer: { q1: 'yes' },
      startTime: 0,
      endTime: 100,
      trialOrder: '0',
    })));
    expect(store.getState().answers.intro_0?.answer).toEqual({ q1: 'yes' });
  });

  test('incrementHelpCounter increments helpButtonClickedCount', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.incrementHelpCounter({ identifier: 'intro_0' }));
    expect(store.getState().answers.intro_0?.helpButtonClickedCount).toBe(1);
  });

  test('saveIncorrectAnswer adds to incorrectAnswers', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.saveIncorrectAnswer({ question: 'intro_0', identifier: 'attempt_1', answer: 'wrong' }));
    expect(store.getState().answers.intro_0?.incorrectAnswers?.attempt_1?.value).toContain('wrong');
    store.dispatch(actions.saveIncorrectAnswer({ question: 'intro_0', identifier: 'attempt_1', answer: 'wrong2' }));
    expect(store.getState().answers.intro_0?.incorrectAnswers?.attempt_1?.value).toContain('wrong2');
  });

  test('deleteDynamicBlockAnswers removes matching answers and funcSequence', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.deleteDynamicBlockAnswers({ currentStep: 0, funcIndex: 0, funcName: 'myFunc' }));
    expect(store.getState().funcSequence.myFunc).toBeUndefined();
  });

  test('pushToFuncSequence creates entry and returns early on duplicate funcIndex', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.pushToFuncSequence({
      component: 'intro', funcName: 'myFunc', index: 5, funcIndex: 0, parameters: {}, correctAnswer: [],
    }));
    expect(store.getState().funcSequence.myFunc).toEqual(['intro']);
    expect(store.getState().answers.myFunc_5_intro_0).toBeDefined();
    store.dispatch(actions.pushToFuncSequence({
      component: 'intro', funcName: 'myFunc', index: 5, funcIndex: 0, parameters: {}, correctAnswer: [],
    }));
    expect(store.getState().funcSequence.myFunc).toEqual(['intro']); // unchanged
  });

  test('saveIncorrectAnswer initializes incorrectAnswers when missing', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    const answerWithoutIncorrect = makeStoredAnswer({
      identifier: 'intro_0', componentName: 'intro', answer: {}, startTime: 0, endTime: 100, trialOrder: '0',
    });
    // Simulates old config import where incorrectAnswers was not present
    delete (answerWithoutIncorrect as { incorrectAnswers?: unknown }).incorrectAnswers;
    store.dispatch(actions.saveTrialAnswer(answerWithoutIncorrect));
    store.dispatch(actions.saveIncorrectAnswer({ question: 'intro_0', identifier: 'attempt_1', answer: 'wrong' }));
    expect(store.getState().answers.intro_0?.incorrectAnswers?.attempt_1?.value).toContain('wrong');
  });

  test('deleteDynamicBlockAnswers with matching answers and funcSequence cleanup', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.pushToFuncSequence({
      component: 'intro', funcName: 'myFunc', index: 5, funcIndex: 0, parameters: {}, correctAnswer: [],
    }));
    expect(store.getState().answers.myFunc_5_intro_0).toBeDefined();
    store.dispatch(actions.deleteDynamicBlockAnswers({ currentStep: 5, funcIndex: 0, funcName: 'myFunc' }));
    expect(store.getState().answers.myFunc_5_intro_0).toBeUndefined();
    expect(store.getState().funcSequence.myFunc).toBeUndefined();
  });
});

describe('useStoreActions hook', () => {
  test('returns actions from store context', async () => {
    const studyStore = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    function Wrapper({ children }: { children: React.ReactNode }) {
      // eslint-disable-next-line react/no-children-prop
      return createElement(Provider, { store: studyStore.store, children: createElement(StudyStoreContext.Provider, { value: studyStore }, children) });
    }
    const { result } = renderHook(() => useStoreActions(), { wrapper: Wrapper });
    expect(typeof result.current.saveTrialAnswer).toBe('function');
  });
});

describe('useAreResponsesValid', () => {
  async function makeWrapper() {
    const { store } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    function Wrapper({ children }: { children: React.ReactNode }) {
      // eslint-disable-next-line react/no-children-prop
      return createElement(Provider, { store, children });
    }
    return { store, Wrapper };
  }

  test('returns true when id includes "reviewer-"', async () => {
    const { Wrapper } = await makeWrapper();
    const { result } = renderHook(() => useAreResponsesValid('reviewer-1'), { wrapper: Wrapper });
    expect(result.current).toBe(true);
  });

  test('returns true when trialValidation has no entry for id', async () => {
    const { Wrapper } = await makeWrapper();
    const { result } = renderHook(() => useAreResponsesValid('nonexistent_0'), { wrapper: Wrapper });
    expect(result.current).toBe(true);
  });

  test('invokes every callback and returns false when some entries are invalid', async () => {
    const { Wrapper } = await makeWrapper();
    const { result } = renderHook(() => useAreResponsesValid('intro_0'), { wrapper: Wrapper });
    expect(result.current).toBe(false);
  });

  test('every callback hits return true branch when entry has no valid key', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    function Wrapper({ children }: { children: React.ReactNode }) {
      // eslint-disable-next-line react/no-children-prop
      return createElement(Provider, { store, children });
    }
    (['aboveStimulus', 'belowStimulus', 'sidebar', 'stimulus'] as const).forEach((loc) => {
      store.dispatch(actions.updateResponseBlockValidation({
        location: loc, identifier: 'intro_0', status: true, values: {},
      }));
    });
    const { result } = renderHook(() => useAreResponsesValid('intro_0'), { wrapper: Wrapper });
    expect(result.current).toBe(true);
  });
});

describe('useFlatSequence', () => {
  test('returns array from flat sequence', async () => {
    const { store } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    function Wrapper({ children }: { children: React.ReactNode }) {
      // eslint-disable-next-line react/no-children-prop
      return createElement(Provider, { store, children });
    }
    const { result } = renderHook(() => useFlatSequence(), { wrapper: Wrapper });
    expect(Array.isArray(result.current)).toBe(true);
  });
});
