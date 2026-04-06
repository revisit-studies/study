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

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../utils/handleComponentInheritance', () => ({
  studyComponentToIndividualComponent: (_comp: unknown, _config: unknown) => ({
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
    withProgressBar: false,
    withSidebar: false,
    sidebarWidth: 0,
    studyEndMsg: '',
    windowEventDebounceTime: 100,
    navigationBar: 'sidebar',
    showTitleBar: false,
  },
  components: {
    intro: { type: 'markdown' as const, path: 'intro.md', response: [] },
  },
  sequence: {
    id: 'root',
    orderPath: 'root',
    order: 'fixed',
    components: ['intro', 'end'],
    skip: [],
  },
} as unknown as StudyConfig;

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
    const choiceOptions = [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }] as never[];
    // First check (empty existing)
    store.dispatch(actions.setMatrixAnswersCheckbox({
      responseId: 'r1', questionKey: 'q1', value: 'A', label: 'A', isChecked: true, choiceOptions,
    }));
    expect(store.getState().matrixAnswers.r1.q1).toBe('A');
    // Second check (existing + new)
    store.dispatch(actions.setMatrixAnswersCheckbox({
      responseId: 'r1', questionKey: 'q1', value: 'B', label: 'B', isChecked: true, choiceOptions,
    }));
    expect(store.getState().matrixAnswers.r1.q1).toContain('B');
    // Uncheck
    store.dispatch(actions.setMatrixAnswersCheckbox({
      responseId: 'r1', questionKey: 'q1', value: 'A', label: 'A', isChecked: false, choiceOptions,
    }));
    expect(store.getState().matrixAnswers.r1.q1).not.toContain('A');
    // Null clears
    store.dispatch(actions.setMatrixAnswersCheckbox(null));
    expect(store.getState().matrixAnswers).toEqual({});
  });

  test('emptyAnswers skips components not in config (return null path)', async () => {
    // getSequenceFlatMap mock returns ['intro', 'end'] - 'end' is filtered out so line 37
    // is not reached. Add a component not in config to the flatSequence to cover it.
    const { getSequenceFlatMap: mockGSFM } = await import('../utils/getSequenceFlatMap');
    (mockGSFM as ReturnType<typeof vi.fn>).mockReturnValueOnce(['intro', 'dynamicComp', 'end']);
    const { store } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    // 'dynamicComp' is not in minimalConfig.components → return null at line 37
    // 'intro' IS in components → answer is created
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
    // 'intro_0' should be in trialValidation from the initial setup
    store.dispatch(actions.updateResponseBlockValidation({
      location: 'stimulus',
      identifier: 'intro_0',
      status: true,
      values: { r1: 'A' },
    }));
    expect(store.getState().trialValidation.intro_0?.stimulus?.valid).toBe(true);
    // Also cover the empty values branch and provenanceGraph branch
    store.dispatch(actions.updateResponseBlockValidation({
      location: 'aboveStimulus',
      identifier: 'intro_0',
      status: false,
      values: {},
      provenanceGraph: {
        aboveStimulus: null, belowStimulus: null, stimulus: null, sidebar: null,
      } as never,
    }));
    expect(store.getState().trialValidation.intro_0?.aboveStimulus?.valid).toBe(false);
    // Unknown identifier returns early (line 301-302)
    store.dispatch(actions.updateResponseBlockValidation({
      location: 'stimulus',
      identifier: 'unknown_99',
      status: true,
      values: {},
    }));
  });

  test('saveTrialAnswer updates answers state', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    store.dispatch(actions.saveTrialAnswer({
      identifier: 'intro_0',
      componentName: 'intro',
      answer: { q1: 'yes' },
      startTime: 0,
      endTime: 100,
      trialOrder: '0',
      incorrectAnswers: {},
      provenanceGraph: {} as never,
      windowEvents: [],
    } as never));
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
    // Second dispatch covers non-null incorrectAnswers branch
    store.dispatch(actions.saveIncorrectAnswer({ question: 'intro_0', identifier: 'attempt_1', answer: 'wrong2' }));
    expect(store.getState().answers.intro_0?.incorrectAnswers?.attempt_1?.value).toContain('wrong2');
  });

  test('deleteDynamicBlockAnswers removes matching answers and funcSequence', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    // Manually add a funcSequence and matching answer via pushToFuncSequence-like setup
    // Use deleteDynamicBlockAnswers with no matching keys (covers loop with no matches)
    store.dispatch(actions.deleteDynamicBlockAnswers({ currentStep: 0, funcIndex: 0, funcName: 'myFunc' }));
    expect(store.getState().funcSequence.myFunc).toBeUndefined();
  });

  test('pushToFuncSequence creates entry and returns early on duplicate funcIndex (covers lines 150-199)', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    // First call: creates funcSequence entry and answer (covers lines 150-198)
    store.dispatch(actions.pushToFuncSequence({
      component: 'intro', funcName: 'myFunc', index: 5, funcIndex: 0, parameters: undefined, correctAnswer: undefined,
    }));
    expect(store.getState().funcSequence.myFunc).toEqual(['intro']);
    expect(store.getState().answers.myFunc_5_intro_0).toBeDefined();
    // Second call with same funcIndex: length (1) > funcIndex (0) → early return (covers lines 154-155)
    store.dispatch(actions.pushToFuncSequence({
      component: 'intro', funcName: 'myFunc', index: 5, funcIndex: 0, parameters: undefined, correctAnswer: undefined,
    }));
    expect(store.getState().funcSequence.myFunc).toEqual(['intro']); // unchanged
  });

  test('saveIncorrectAnswer initializes incorrectAnswers when undefined (covers lines 339-340)', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    // Overwrite intro_0 without incorrectAnswers to simulate old config import
    store.dispatch(actions.saveTrialAnswer({
      identifier: 'intro_0',
      componentName: 'intro',
      answer: {},
      startTime: 0,
      endTime: 100,
      trialOrder: '0',
      incorrectAnswers: undefined as never,
      provenanceGraph: {} as never,
      windowEvents: [],
    } as never));
    store.dispatch(actions.saveIncorrectAnswer({ question: 'intro_0', identifier: 'attempt_1', answer: 'wrong' }));
    expect(store.getState().answers.intro_0?.incorrectAnswers?.attempt_1?.value).toContain('wrong');
  });

  test('deleteDynamicBlockAnswers with matching answers and funcSequence cleanup (covers lines 356-357, 362-363, 366-367)', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    // Use pushToFuncSequence to create funcSequence and a matching answer key
    store.dispatch(actions.pushToFuncSequence({
      component: 'intro', funcName: 'myFunc', index: 5, funcIndex: 0, parameters: undefined, correctAnswer: undefined,
    }));
    expect(store.getState().answers.myFunc_5_intro_0).toBeDefined();
    // Delete: regex .*_5_.*_0 matches myFunc_5_intro_0; funcSequence becomes empty → deleted
    store.dispatch(actions.deleteDynamicBlockAnswers({ currentStep: 5, funcIndex: 0, funcName: 'myFunc' }));
    expect(store.getState().answers.myFunc_5_intro_0).toBeUndefined();
    expect(store.getState().funcSequence.myFunc).toBeUndefined();
  });
});

describe('useStoreActions hook', () => {
  test('returns actions from store context', async () => {
    const studyStore = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    function Wrapper({ children }: { children: React.ReactNode }) {
      return createElement(
        Provider,
{ store: studyStore.store } as never,
createElement(StudyStoreContext.Provider, { value: studyStore }, children),
      );
    }
    const { result } = renderHook(() => useStoreActions(), { wrapper: Wrapper });
    expect(typeof result.current.saveTrialAnswer).toBe('function');
  });
});

describe('useAreResponsesValid', () => {
  async function makeWrapper() {
    const { store } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    function Wrapper({ children }: { children: React.ReactNode }) {
      return createElement(Provider, { store } as never, children);
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

  test('invokes every callback and returns false when some entries are invalid (covers lines 408-412)', async () => {
    const { Wrapper } = await makeWrapper();
    // intro_0 exists in trialValidation with aboveStimulus/belowStimulus/sidebar.valid=false
    // → enters every callback (lines 408-412); short-circuits on first false → returns false
    const { result } = renderHook(() => useAreResponsesValid('intro_0'), { wrapper: Wrapper });
    expect(result.current).toBe(false);
  });

  test('every callback hits return true branch when entry has no valid key (covers line 411)', async () => {
    const { store, actions } = await studyStoreCreator('test', minimalConfig, minimalSequence, metadata, emptyAnswers, modes, 'p1', false, false);
    function Wrapper({ children }: { children: React.ReactNode }) {
      return createElement(Provider, { store } as never, children);
    }
    // Set all locations to valid so every() reaches provenanceGraph (no 'valid' key → return true)
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
      return createElement(Provider, { store } as never, children);
    }
    const { result } = renderHook(() => useFlatSequence(), { wrapper: Wrapper });
    expect(Array.isArray(result.current)).toBe(true);
  });
});
