import { createSlice, configureStore, type PayloadAction } from '@reduxjs/toolkit';
import { createContext, useContext } from 'react';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { ResponseBlockLocation, StudyConfig } from '../parser/types';
import {
  StoredAnswer, TrialValidation, TrrackedProvenance, StoreState,
} from './types';

export async function studyStoreCreator(
  studyId: string,
  config: StudyConfig,
  sequence: string[],
  answers: Record<string, StoredAnswer>,
) {
  const emptyAnswers = { ...sequence.map((id) => ({ [id]: {} })) };
  const emptyValidation: TrialValidation = Object.assign(
    {},
    ...sequence.map((id, idx) => ({ [`${id}_${idx}`]: { aboveStimulus: { valid: false, values: {} }, belowStimulus: { valid: false, values: {} }, sidebar: { valid: false, values: {} } } })),
  );
  const allValid = Object.assign(
    {},
    ...sequence.map((id, idx) => ({
      [`${id}_${idx}`]: {
        aboveStimulus: true, belowStimulus: true, sidebar: true, values: {},
      },
    })),
  );

  const initialState: StoreState = {
    studyId,
    answers: answers || emptyAnswers,
    sequence,
    config,
    showAdmin: false,
    showHelpText: false,
    alertModal: { show: false, message: '' },
    trialValidation: answers ? allValid : emptyValidation,
    iframeAnswers: [] as string[],
  };

  const storeSlice = createSlice({
    name: 'storeSlice',
    initialState,
    reducers: {
      setConfig(state, payload: PayloadAction<StudyConfig>) {
        state.config = payload.payload;
      },
      toggleShowAdmin: (state) => {
        state.showAdmin = !state.showAdmin;
      },
      toggleShowHelpText: (state) => {
        state.showHelpText = !state.showHelpText;
      },
      setAlertModal: (state, action: PayloadAction<{ show: boolean; message: string }>) => {
        state.alertModal = action.payload;
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
          identifier: string;
          status: boolean;
          values: object;
          provenanceGraph?: TrrackedProvenance;
        }>,
      ) => {
        if (!state.trialValidation[payload.identifier]) {
          state.trialValidation[payload.identifier] = {
            aboveStimulus: { valid: false, values: {} },
            belowStimulus: { valid: false, values: {} },
            sidebar: { valid: false, values: {} },
            provenanceGraph: undefined,
          };
        }
        state.trialValidation[payload.identifier][payload.location] = { valid: payload.status, values: payload.values };

        if (payload.provenanceGraph) {
          state.trialValidation[payload.identifier].provenanceGraph = payload.provenanceGraph;
        }
      },
      saveTrialAnswer(
        state,
        {
          payload,
        }: PayloadAction<{ identifier: string } & StoredAnswer>,
      ) {
        const {
          identifier, answer, startTime, endTime, provenanceGraph, windowEvents,
        } = payload;
        state.answers[identifier] = {
          answer,
          startTime,
          endTime,
          provenanceGraph,
          windowEvents,
        };
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
    const valid = Object.values(state.trialValidation[id]).every((x) => {
      if (typeof x === 'object' && 'valid' in x) {
        return x.valid;
      }
      return true;
    });

    if (!valid) return false;

    return Object.values(valid).every((x) => x);
  });
}
