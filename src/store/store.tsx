import { createSlice, configureStore, type PayloadAction } from '@reduxjs/toolkit';
import { createContext, useContext } from 'react';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { ResponseBlockLocation, StudyConfig } from '../parser/types';
import {
  StoredAnswer, TrialValidation, TrrackedProvenance, StoreState, Sequence, ParticipantMetadata,
} from './types';
import { getSequenceFlatMap } from '../utils/getSequenceFlatMap';

export async function studyStoreCreator(
  studyId: string,
  config: StudyConfig,
  sequence: Sequence,
  metadata: ParticipantMetadata,
  answers: Record<string, StoredAnswer>,
  isAdmin: boolean,
) {
  const flatSequence = getSequenceFlatMap(sequence);

  const emptyAnswers = Object.fromEntries(flatSequence.filter((id) => id !== 'end').map((id, idx) => [`${id}_${idx}`, { answer: {} }])) as Record<string, StoredAnswer>;
  const emptyValidation: TrialValidation = Object.assign(
    {},
    ...flatSequence.map((id, idx) => ({ [`${id}_${idx}`]: { aboveStimulus: { valid: false, values: {} }, belowStimulus: { valid: false, values: {} }, sidebar: { valid: false, values: {} } } })),
  );
  const allValid = Object.assign(
    {},
    ...flatSequence.map((id, idx) => ({
      [`${id}_${idx}`]: {
        aboveStimulus: true, belowStimulus: true, sidebar: true, values: {},
      },
    })),
  );

  const initialState: StoreState = {
    studyId,
    answers: Object.keys(answers).length > 0 ? answers : emptyAnswers,
    sequence,
    config,
    showStudyBrowser: import.meta.env.VITE_REVISIT_MODE === 'public' || isAdmin,
    showHelpText: false,
    alertModal: { show: false, message: '' },
    trialValidation: answers ? allValid : emptyValidation,
    iframeAnswers: {},
    iframeProvenance: null,
    metadata,
  };

  const storeSlice = createSlice({
    name: 'storeSlice',
    initialState,
    reducers: {
      setConfig(state, payload: PayloadAction<StudyConfig>) {
        state.config = payload.payload;
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
      setIframeAnswers: (state, action: PayloadAction<Record<string, unknown>>) => {
        state.iframeAnswers = action.payload;
      },
      setIframeProvenance: (state, action: PayloadAction<TrrackedProvenance | null>) => {
        state.iframeProvenance = action.payload;
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

export function useFlatSequence(): string[] {
  return useStoreSelector((state) => getSequenceFlatMap(state.sequence));
}
