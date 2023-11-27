import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { configureTrrackableStore, createTrrackableSlice } from '@trrack/redux';
import { createContext, useContext } from 'react';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { ResponseBlockLocation, StudyConfig } from '../parser/types';
import { RootState, StoredAnswer, TrialValidation, TrrackedProvenance, TrrackedState, UnTrrackedState } from './types';

export async function studyStoreCreator(
  studyId: string,
  config: StudyConfig,
  sequence: string[],
  answers: Record<string, StoredAnswer>,
) {
  const emptyAnswers = Object.assign({}, sequence.map((id) => ({[id]: {}})));
  const emptyValidation: TrialValidation = Object.assign(
    {},
    ...sequence.map((id) => ({[id]: { aboveStimulus: { valid: false, values: {} }, belowStimulus: { valid: false, values: {} }, sidebar: { valid: false, values: {} } }}))
  );

  const initialTrrackedState: TrrackedState = {
    studyId,
    answers: answers || emptyAnswers,
    sequence,
  };

  const initialUntrrackedState: UnTrrackedState = {
    config,
    showAdmin: false,
    showHelpText: false,
    trialValidation: emptyValidation,
    trrackExists: false,
    iframeAnswers: [] as string[],
  };

  const studySlice = createTrrackableSlice({
    name: 'trrackedStudySlice',
    initialState: initialTrrackedState,
    reducers: {
      saveTrialAnswer(
        state,
        {
          payload,
        }: PayloadAction<{
          currentStep: string;
          answer: Record<string, Record<string, unknown>>;
          startTime: number;
          endTime: number;
          provenanceGraph?: TrrackedProvenance;
        }>
      ) {
        const { currentStep, answer, startTime, endTime, provenanceGraph } = payload;

        state.answers[currentStep] = {
          answer: answer,
          startTime: startTime,
          endTime: endTime,
          provenanceGraph,
        };
      },
    },
  });


  const configSlice = createSlice({
    name: 'studySlice',
    initialState: initialUntrrackedState,
    reducers: {
      setConfig (state, payload: PayloadAction<StudyConfig>) {
        state.config = payload.payload;
      },
      setTrrackExists: (state, action: PayloadAction<boolean>) => {
        state.trrackExists = action.payload;
      },
      toggleShowAdmin: (state) => {
        state.showAdmin = !state.showAdmin;
      },
      toggleShowHelpText: (state) => {
        state.showHelpText = !state.showHelpText;
      },
      setIframeAnswers: (state, action: PayloadAction<string[]>) => {
        state.iframeAnswers = action.payload;
      },
      updateResponseBlockValidation: (
        state,
        {
          payload,
        }: PayloadAction<{
          location: ResponseBlockLocation;
          currentStep: string | undefined;
          status: boolean;
          values: object;
          provenanceGraph?: TrrackedProvenance;
        }>
      ) => {
        if (!payload.currentStep || payload.currentStep.length === 0) return state;
  
        if (!state.trialValidation[payload.currentStep]) {
          state.trialValidation[payload.currentStep] = {
            aboveStimulus: { valid: false, values: {} },
            belowStimulus: { valid: false, values: {} },
            sidebar: { valid: false, values: {} },
            provenanceGraph: undefined,
          };
        }
        state.trialValidation[payload.currentStep][payload.location] = { valid: payload.status, values: payload.values };

        if (payload.provenanceGraph) {
          state.trialValidation[payload.currentStep].provenanceGraph = payload.provenanceGraph;
        }
      },
    },
  });

  const { store, trrack, trrackStore } = configureTrrackableStore({
    reducer: {
      trrackedSlice: studySlice.reducer,
      unTrrackedSlice: configSlice.reducer
    },
    slices: [studySlice, configSlice],
  });

  return {
    store,
    trrack,
    trrackStore,
    actions: studySlice.actions,
    unTrrackedActions: configSlice.actions,
  };
}

export type StudyStore = Awaited<ReturnType<typeof studyStoreCreator>>;
export type StudyProvenance = StudyStore['trrack'];
export type StudyState = ReturnType<StudyStore['store']['getState']>;

export const StudyStoreContext = createContext<StudyStore>(null!);

export function useCreatedStore() {
  return useContext(StudyStoreContext);
}

export function useTrrackedActions() {
  return useCreatedStore().actions;
}

export function useUntrrackedActions() {
  return useCreatedStore().unTrrackedActions;
}

// Hooks
type StoreDispatch = StudyStore['store']['dispatch'];

export const useStoreDispatch: () => StoreDispatch = useDispatch;
export const useStoreSelector: TypedUseSelectorHook<RootState> = useSelector;
export function useStudySelector() {
  return useStoreSelector((s) => s.trrackedSlice);
}

export function useAreResponsesValid(id?: string) {
  return useStoreSelector((state) => {
    if (id === undefined || id.length === 0) return true;

    const valid = Object.values(state.unTrrackedSlice.trialValidation[id]).every((x) => {
      if (typeof x === 'object' && 'valid' in x) {
        return x.valid;
      }
      return true;
    });

    if (!valid) return false;

    return Object.values(valid).every((x) => x);
  });
}
