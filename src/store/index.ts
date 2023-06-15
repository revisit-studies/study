import { type PayloadAction } from '@reduxjs/toolkit';
import { configureTrrackableStore, createTrrackableSlice } from '@trrack/redux';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import localforage from 'localforage';
import { createContext, useContext } from 'react';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { StudyComponent, StudyConfig } from '../parser/types';
import { ProvenanceStorage } from '../storage/types';
import { flagsStore, setTrrackExists } from './flags';
import { RootState, State, Step, TrialRecord } from './types';

export const PID = 'PARTICIPANT_ID';
export const SESSION_ID = 'SESSION_ID';

export const __ACTIVE_SESSION = '__active_session';

function getSteps({ sequence, components }: StudyConfig): Record<string, Step> {
  const steps: Record<string, Step> = {};
  sequence.forEach((id, idx, arr) => {
    const component = components[id];
    steps[id] = {
      ...component,
      complete: false,
      next: arr[idx + 1] || 'end',
    } as Step;
  });

  return steps;
}



export async function studyStoreCreator(
  studyId: string,
  config: StudyConfig,
  firebase: ProvenanceStorage
) {
  const lf = localforage.createInstance({
    name: 'sessions',
  });

  const steps = getSteps(config);
  const stepsToAnswers = Object.assign({}, ...Object.keys(steps).map((id) => ({[id]: {}})));
  const initialState: State = {
    studyIdentifiers: {
      pid: firebase.pid,
      study_id: studyId,
      session_id: crypto.randomUUID(),
    },
    config,
    steps,
    ...stepsToAnswers,
  };

  const studySlice = createTrrackableSlice({
    name: 'studySlice',
    initialState,
    reducers: {
      completeStep(state, step) {
        state.steps[step.payload].complete = true;
      },
      saveTrialAnswer(
        state,
        {
          payload,
        }: PayloadAction<{
          trialName: string;
          trialId: string;
          answer: string | object;
          startTime: number;
          endTime: number;
          type?: StudyComponent['type'];
        }>
      ) {
        if (payload.type === 'container') {
          (state[payload.trialName] as TrialRecord)[payload.trialId] = {
            complete: true,
            answer: payload.answer,
            startTime: payload.startTime,
            endTime: payload.endTime,
          };
        } else {
          (state[payload.trialName] as TrialRecord) = ({
            complete: true,
            answer: payload.answer,
            startTime: payload.startTime,
            endTime: payload.endTime,
          } as any);
        }
      },
    },
  });

  const { store, trrack, trrackStore } = configureTrrackableStore({
    reducer: {
      study: studySlice.reducer,
    },
    slices: [studySlice],
  });

  // Check local/fb
  // is trrack instance in local storage?
  const savedSessionId = (await getFromLS(lf, studyId)) || trrack.root.id;

  const trrackExists = await firebase.initialize(
    studyId,
    savedSessionId,
    trrack
  );

  if (!trrackExists) {
    await saveToLS(lf, studyId, trrack.root.id);
  }

  flagsStore.dispatch(setTrrackExists(!!trrackExists));

  trrack.currentChange((trigger: any) => {
    if (trigger === 'new') {
      firebase.saveNewProvenanceNode(trrack);
    }
  });

  return {
    store,
    trrack,
    trrackStore,
    actions: studySlice.actions,
    async clearCache() {
      await terminate(firebase.firestore);
      await clearIndexedDbPersistence(firebase.firestore);
      firebase.startFirestore();
      await lf.clear();
    },
    restoreSession() {
      if (!trrackExists) {
        return;
      }

      trrackExists.restoreSession();
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

export const MainStoreContext = createContext<StudyStore>(null!);

export function useCreatedStore() {
  return useContext(MainStoreContext);
}

export function useStoreActions() {
  return useCreatedStore().actions;
}

// Hooks
type AppDispatch = StudyStore['store']['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export function useStudySelector() {
  return useAppSelector((s) => s.study);
}
