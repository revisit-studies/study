import { type PayloadAction } from '@reduxjs/toolkit';
import { configureTrrackableStore, createTrrackableSlice } from '@trrack/redux';
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
    };
  });

  return steps;
}

function getTrialSteps(
  { sequence, components }: StudyConfig,
  _for: 'trials' | 'practice'
): Record<string, TrialRecord> {
  const steps: Record<string, TrialRecord> = {};

  const trialSteps = sequence.filter((step) => components[step].type === _for);

  trialSteps.forEach((trialName) => {
    steps[trialName] = {};
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

  const studySlice = createTrrackableSlice({
    name: 'studySlice',
    initialState: {
      studyIdentifiers: {
        pid: firebase.pid,
        study_id: studyId,
        session_id: crypto.randomUUID(),
      },
      config,
      consent: undefined,
      steps: getSteps(config),
      practice: getTrialSteps(config, 'practice'),
      trials: getTrialSteps(config, 'trials'),
      survey: {},
      isStudyComplete: false,
      isStudyEnded: false,
    } as State,
    reducers: {
      completeStep(state, step) {
        state.steps[step.payload].complete = true;
      },
      saveConsent: (
        state,
        response: PayloadAction<{ signature: string; timestamp: number }>
      ) => {
        state.consent = response.payload;
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
        if (payload.type === 'trials' || payload.type === 'practice') {
          state[payload.type][payload.trialName][payload.trialId] = {
            complete: true,
            answer: payload.answer,
            startTime: payload.startTime,
            endTime: payload.endTime,
          };
        }
      },
      saveSurvey(
        state,
        { payload }: PayloadAction<Record<string, string | number>>
      ) {
        state.survey = payload;
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
    clearCache() {
      return lf.clear();
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
