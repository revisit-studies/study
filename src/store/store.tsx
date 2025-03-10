import {
  createSlice, configureStore, type PayloadAction, createSelector,
} from '@reduxjs/toolkit';
import { createContext, useContext } from 'react';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import {
  ResponseBlockLocation, StudyConfig, StringOption, ValueOf, Answer,
} from '../parser/types';
import {
  StoredAnswer, TrialValidation, TrrackedProvenance, StoreState, Sequence, ParticipantMetadata,
} from './types';
import { getSequenceFlatMap } from '../utils/getSequenceFlatMap';
import { REVISIT_MODE } from '../storage/engines/StorageEngine';
import { studyComponentToIndividualComponent } from '../utils/handleComponentInheritance';

export async function studyStoreCreator(
  studyId: string,
  config: StudyConfig,
  sequence: Sequence,
  metadata: ParticipantMetadata,
  answers: Record<string, StoredAnswer>,
  modes: Record<REVISIT_MODE, boolean>,
  participantId: string,
) {
  const flatSequence = getSequenceFlatMap(sequence);

  const emptyAnswers: Record<string, StoredAnswer> = Object.fromEntries(flatSequence.filter((id) => id !== 'end')
    .map((id, idx) => {
      const componentConfig = studyComponentToIndividualComponent(config.components[id] || {}, config);

      return [
        `${id}_${idx}`,
        {

          answer: {},
          incorrectAnswers: {},
          startTime: 0,
          endTime: -1,
          provenanceGraph: {
            aboveStimulus: undefined,
            belowStimulus: undefined,
            stimulus: undefined,
            sidebar: undefined,
          },
          windowEvents: [],
          timedOut: false,
          helpButtonClickedCount: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parameters: Object.hasOwn(componentConfig, 'parameters') ? (componentConfig as any).parameters : {},
          correctAnswer: Object.hasOwn(componentConfig, 'correctAnswer') ? componentConfig.correctAnswer! : [],
        },
      ];
    }));
  const emptyValidation: TrialValidation = Object.assign(
    {},
    ...flatSequence.map((id, idx): TrialValidation => {
      const componentConfig = studyComponentToIndividualComponent(config.components[id] || { response: [] }, config);

      return {
        [`${id}_${idx}`]: {
          aboveStimulus: { valid: false, values: {} },
          belowStimulus: { valid: false, values: {} },
          sidebar: { valid: false, values: {} },
          stimulus: { valid: !(componentConfig.response.some((response) => response.type === 'reactive' && response.required !== false)), values: {} },
          provenanceGraph: {
            aboveStimulus: undefined,
            belowStimulus: undefined,
            stimulus: undefined,
            sidebar: undefined,
          },
        },
      };
    }),
  );
  const allValid = Object.assign(
    {},
    ...flatSequence.map((id, idx) => ({
      [`${id}_${idx}`]: {
        aboveStimulus: true,
        belowStimulus: true,
        sidebar: true,
        stimulus: true,
        provenanceGraph: {
          aboveStimulus: undefined,
          belowStimulus: undefined,
          stimulus: undefined,
          sidebar: undefined,
        },
      },
    })),
  );

  const initialState: StoreState = {
    studyId,
    isRecording: false,
    answers: Object.keys(answers).length > 0 ? answers : emptyAnswers,
    sequence,
    config,
    showStudyBrowser: true,
    showHelpText: false,
    alertModal: { show: false, message: '' },
    trialValidation: Object.keys(answers).length > 0 ? allValid : emptyValidation,
    reactiveAnswers: {},
    metadata,
    analysisProvState: {
      aboveStimulus: undefined,
      belowStimulus: undefined,
      stimulus: undefined,
      sidebar: undefined,

    },
    analysisIsPlaying: false,
    analysisHasAudio: false,
    analysisHasProvenance: false,
    modes,
    matrixAnswers: {},
    participantId,
    funcSequence: {},
  };

  const storeSlice = createSlice({
    name: 'storeSlice',
    initialState,
    reducers: {
      setConfig(state, payload: PayloadAction<StudyConfig>) {
        state.config = payload.payload;
      },
      setIsRecording(state, payload: PayloadAction<boolean>) {
        state.isRecording = payload.payload;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pushToFuncSequence(state, payload: PayloadAction<{component: string, funcName: string, index: number, funcIndex: number, parameters: Record<string, any>, correctAnswer: Answer[]}>) {
        if (!state.funcSequence[payload.payload.funcName]) {
          state.funcSequence[payload.payload.funcName] = [];
        }
        if (state.funcSequence[payload.payload.funcName].length > payload.payload.funcIndex) {
          return;
        }

        const componentConfig = studyComponentToIndividualComponent(state.config.components[payload.payload.component] || { response: [] }, config);

        state.funcSequence[payload.payload.funcName].push(payload.payload.component);
        state.answers[`${payload.payload.funcName}_${payload.payload.index}_${payload.payload.component}_${payload.payload.funcIndex}`] = {
          answer: {},
          incorrectAnswers: {},
          startTime: 0,
          endTime: -1,
          provenanceGraph: {
            aboveStimulus: undefined,
            belowStimulus: undefined,
            stimulus: undefined,
            sidebar: undefined,
          },
          windowEvents: [],
          timedOut: false,
          helpButtonClickedCount: 0,
          parameters: payload.payload.parameters,
          correctAnswer: payload.payload.correctAnswer,
        };
        state.trialValidation[`${payload.payload.funcName}_${payload.payload.index}_${payload.payload.component}_${payload.payload.funcIndex}`] = {
          aboveStimulus: { valid: false, values: {} },
          belowStimulus: { valid: false, values: {} },
          stimulus: { valid: componentConfig.response.every((response) => response.type !== 'reactive'), values: {} },
          sidebar: { valid: false, values: {} },
          provenanceGraph: {
            aboveStimulus: undefined,
            belowStimulus: undefined,
            stimulus: undefined,
            sidebar: undefined,
          },
        };
      },
      toggleStudyBrowser: (state) => {
        state.showStudyBrowser = !state.showStudyBrowser;
      },
      toggleShowHelpText: (state) => {
        state.showHelpText = !state.showHelpText;
      },
      setAlertModal: (state, action: PayloadAction<{ show: boolean; message: string }>) => {
        state.alertModal = action.payload;
      },
      setReactiveAnswers: (state, action: PayloadAction<Record<string, ValueOf<StoredAnswer['answer']>>>) => {
        state.reactiveAnswers = action.payload;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      saveAnalysisState(state, { payload }: PayloadAction<{prov: any, location: ResponseBlockLocation}>) {
        state.analysisProvState[payload.location] = payload.prov;
      },
      setAnalysisIsPlaying(state, { payload }: PayloadAction<boolean>) {
        state.analysisIsPlaying = payload;
      },
      setAnalysisHasAudio(state, { payload }: PayloadAction<boolean>) {
        state.analysisHasAudio = payload;
      },
      setAnalysisHasProvenance(state, { payload }: PayloadAction<boolean>) {
        state.analysisHasProvenance = payload;
      },
      setMatrixAnswersRadio: (state, action: PayloadAction<{ questionKey: string, responseId: string, val: string } | null>) => {
        if (action.payload) {
          const { responseId, questionKey, val } = action.payload;

          // Set state
          state.matrixAnswers = {
            ...state.matrixAnswers,
            [responseId]: {
              ...state.matrixAnswers[responseId],
              [questionKey]: val,
            },
          };
        } else {
          state.matrixAnswers = {};
        }
      },
      setMatrixAnswersCheckbox: (state, action: PayloadAction<{ questionKey: string, responseId: string, value: string, label: string, isChecked: boolean, choiceOptions: StringOption[] } | null>) => {
        if (action.payload) {
          const {
            responseId, questionKey, value, isChecked, choiceOptions,
          } = action.payload;

          const currentAnswer = state.matrixAnswers[responseId]?.[questionKey] ?? '';
          let newAnswer = '';
          if (isChecked) {
            if (currentAnswer.length > 0) {
              newAnswer = [...currentAnswer.split('|'), value].sort((a, b) => choiceOptions.map((entry) => entry.value).indexOf(a) - choiceOptions.map((entry) => entry.value).indexOf(b))
                .join('|');
            } else {
              newAnswer = `${value}`;
            }
          } else {
            newAnswer = currentAnswer.split('|').filter((entry) => entry !== value).join('|');
          }

          // Set state
          state.matrixAnswers = {
            ...state.matrixAnswers,
            [responseId]: {
              ...state.matrixAnswers[responseId],
              [questionKey]: newAnswer,
            },
          };
        } else {
          state.matrixAnswers = {};
        }
      },
      updateResponseBlockValidation: (
        state,
        {
          payload,
        }: PayloadAction<{
          location: ResponseBlockLocation;
          identifier: string;
          status: boolean;
          values: object;
          provenanceGraph?: TrrackedProvenance;
        }>,
      ) => {
        if (!state.trialValidation[payload.identifier]) {
          return;
        }
        const currentValues = state.trialValidation[payload.identifier]?.[payload.location]?.values;

        if (Object.keys(payload.values).length > 0) {
          state.trialValidation[payload.identifier][payload.location] = { valid: payload.status, values: { ...currentValues, ...payload.values } };
        } else {
          state.trialValidation[payload.identifier][payload.location] = { valid: payload.status, values: currentValues || {} };
        }

        if (payload.provenanceGraph) {
          state.trialValidation[payload.identifier].provenanceGraph[payload.location] = payload.provenanceGraph;
        }
      },
      saveTrialAnswer(state, { payload }: PayloadAction<{ identifier: string } & StoredAnswer>) {
        state.answers[payload.identifier] = { ...payload };
      },
      incrementHelpCounter(
        state,
        {
          payload,
        }: PayloadAction<{ identifier: string }>,
      ) {
        state.answers[payload.identifier].helpButtonClickedCount += 1;
      },
      saveIncorrectAnswer(
        state,
        {
          payload,
        }: PayloadAction<{ question: string, identifier: string, answer: unknown }>,
      ) {
        const {
          identifier, answer, question,
        } = payload;

        // This handles the case that we import a participants answers from an old config version
        if (!state.answers[question].incorrectAnswers) {
          state.answers[question].incorrectAnswers = {};
        }

        if (!state.answers[question].incorrectAnswers[identifier]) {
          state.answers[question].incorrectAnswers[identifier] = { id: identifier, value: [] };
        }

        state.answers[question].incorrectAnswers[identifier].value.push(answer);
      },
    },
  });

  const store = configureStore(
    {
      reducer: storeSlice.reducer,
      preloadedState: initialState,
    },
  );

  return { store, actions: storeSlice.actions };
}

export type StudyStore = Awaited<ReturnType<typeof studyStoreCreator>>;

export const StudyStoreContext = createContext<StudyStore>(null!);

export function useStoreActions() {
  return useContext(StudyStoreContext).actions;
}

// Hooks
type StoreDispatch = StudyStore['store']['dispatch'];

export const useStoreDispatch: () => StoreDispatch = useDispatch;
export const useStoreSelector: TypedUseSelectorHook<StoreState> = useSelector;

export function useAreResponsesValid(id: string) {
  return useStoreSelector((state) => {
    if (id.includes('reviewer-')) {
      return true;
    }
    const valid = !(state.trialValidation[id]) ? true : Object.values(state.trialValidation[id]).every((x) => {
      if (typeof x === 'object' && 'valid' in x) {
        return x.valid;
      }
      return true;
    });
    if (!valid) return false;

    // Valid seems to not be an object, just a boolean (you're using 'every').
    // Was this originally something else? Should just be "return valid"
    // instead of "if (!valid) return false" and then the stuff below
    return Object.values(valid).every((x) => x);
  });
}

const flatSequenceSelector = createSelector(
  (state) => state.sequence,
  (sequence) => getSequenceFlatMap(sequence),
);

export function useFlatSequence() {
  return useStoreSelector(flatSequenceSelector);
}
