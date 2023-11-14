import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { configureTrrackableStore, createTrrackableSlice } from '@trrack/redux';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import localforage from 'localforage';
import { createContext, useContext } from 'react';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { ResponseBlockLocation, StudyConfig } from '../parser/types';
import { RootState, Step, TrrackedAnswer, TrrackedState } from './types';
import { ProvenanceGraph } from '@trrack/core/graph/graph-slice';
import { ParticipantData } from '../storage/types';
import { NodeId } from '@trrack/core';

export const PID = 'PARTICIPANT_ID';
export const SESSION_ID = 'SESSION_ID';

export const __ACTIVE_SESSION = '__active_session';


type TrialRecord = Record<
  string,
  {
    valid: {
      aboveStimulus: boolean;
      belowStimulus: boolean;
      sidebar: boolean;
    };
    answers: TrrackedAnswer;
    provenanceGraph: ProvenanceGraph<any, any, any> | null,
  }
>;

interface UnTrrackedState {
  // Three identifiers given by the study platform
  steps: Record<string, Step>;
  config: StudyConfig;
  showAdmin: boolean;
  showHelpText: boolean;
  trialRecord: TrialRecord;
  trrackExists: boolean;
  iframeAnswers: string[];
}

function getSteps(sequence: string[]): Record<string, Step> {
  const steps: Record<string, Step> = {};
  (sequence).forEach((id, idx, arr) => {
    steps[id] = {
      complete: false,
      next: arr[idx + 1] || 'end',
    } as Step;
  });

  return steps;
}

export async function studyStoreCreator(
  studyId: string,
  config: StudyConfig,
  sequence: string[],
  answers: TrrackedAnswer,
) {
  const lf = localforage.createInstance({
    name: 'sessions',
  });

  const steps = getSteps(sequence);
  const emptyAnswers = Object.assign({}, ...Object.keys(steps).map((id) => ({[id]: {}})));


  const initialTrrackedState: TrrackedState = {
    studyIdentifiers: {
      study_id: studyId,
      session_id: crypto.randomUUID(),
    },
    answers: answers || emptyAnswers,
    sequence,
  };

  const initialUntrrackedState: UnTrrackedState = {
    steps,
    config,
    showAdmin: false,
    showHelpText: false,
    trialRecord: {} as TrialRecord,
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
          trialName: string;
          trialId: string;
          answer: string | object;
          startTime: number;
          provenanceRoot?: NodeId,
          endTime: number;
        }>
      ) {

        (state[payload.trialName] as TrialRecord) = ({
          complete: true,
          answer: payload.answer,
          startTime: payload.startTime,
          provenanceRoot: payload.provenanceRoot,
          endTime: payload.endTime,
        } as any);
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
      completeStep(state, step) {
        state.steps[step.payload].complete = true;
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
          trialId: string;
          status: boolean;
          provenanceGraph?: ProvenanceGraph<any, any, any>
          answers: Record<string, any>;
        }>
      ) => {
        if (payload.trialId.length === 0) return state;
  
        if (!state.trialRecord[payload.trialId]) {
          state.trialRecord[payload.trialId] = {
            valid: {
              aboveStimulus: false,
              belowStimulus: false,
              sidebar: false,
            },
            answers: {},
            provenanceGraph: null,
          };
        }
        state.trialRecord[payload.trialId].valid[payload.location] =
          payload.status;
        const prev = state.trialRecord[payload.trialId].answers;
  
        if(payload.provenanceGraph !== undefined) {
          state.trialRecord[payload.trialId].provenanceGraph = payload.provenanceGraph;
        }
  
        state.trialRecord[payload.trialId].answers = {
          ...prev,
          ...payload.answers,
        };
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

  // Check local/fb
  // is trrack instance in local storage?
  const savedSessionId = (await getFromLS(lf, studyId)) || trrack.root.id;

  return {
    store,
    trrack,
    trrackStore,
    actions: studySlice.actions,
    unTrrackedActions: configSlice.actions,
    async clearCache() {
      await terminate(firebase.firestore);
      await clearIndexedDbPersistence(firebase.firestore);
      firebase.startFirestore();
      await lf.clear();
    },
    startNewSession() {
      if (!trrackExists) {
        return;
      }

      trrackExists.createNew().then(() => {
        return saveToLS(lf, studyId, trrack.root.id);
      });
    },
    loadGraph(graph: string) {
      trrack.import(graph);
    },
  };
}

async function saveToLS(lf: LocalForage, studyId: string, sessionId: string) {
  const sessionsObject: Record<string, string> =
    (await lf.getItem(__ACTIVE_SESSION)) || {};

  sessionsObject[studyId] = sessionId;

  lf.setItem(__ACTIVE_SESSION, sessionsObject);
}

async function getFromLS(lf: LocalForage, studyId: string) {
  const sessionsObject: Record<string, string> =
    (await lf.getItem(__ACTIVE_SESSION)) || {};

  return sessionsObject && sessionsObject[studyId];
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

export function useAreResponsesValid(id: string) {
  return useStoreSelector((state) => {
    if (id.length === 0) return true;

    const valid = state.unTrrackedSlice.trialRecord[id]?.valid;

    if (!valid) return false;

    return Object.values(valid).every((x) => x);
  });
}

export function useAggregateResponses(id: string) {
return useStoreSelector((state) => {
  if (id.length === 0) return null;

  const answers = state.unTrrackedSlice.trialRecord[id]?.answers;
  if (!answers) return null;

  return answers; // Test
});
}

