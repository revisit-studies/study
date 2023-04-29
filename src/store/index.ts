import { type PayloadAction } from '@reduxjs/toolkit';
import { configureTrrackableStore, createTrrackableSlice } from '@trrack/redux';
import { createContext, useContext } from 'react';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { initFirebase } from '../firebase/init';
import {
  addExpToUser,
  saveSurveyToFB,
  saveTrialToFB,
} from '../firebase/queries';
import { StudyComponent, StudyConfig } from '../parser/types';
import { getOrSetStudyIdentifiers } from '../utils/getOrSetStudyIdentifiers';
import { RootState, State, Step, TrialRecord } from './types';

export const STUDY_ID = 'STUDY_ID';
export const PID = 'PARTICIPANT_ID';
export const SESSION_ID = 'SESSION_ID';

export const DEBUG = true;

export const FIREBASE = initFirebase();

function getSteps({ sequence, components }: StudyConfig): Record<string, Step> {
  const steps: Record<string, Step> = {};
  sequence.forEach((id, idx, arr) => {
    const component = components[id];
    steps[id] = {
      ...component,
      complete: false,
      next: arr[idx + 1] || null,
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

export function studyStoreCreator(studyId: string, config: StudyConfig) {
  const { pid, study_id, session_id, session } =
    getOrSetStudyIdentifiers(studyId);
  (window as any).sess = session;

  const studySlice = createTrrackableSlice({
    name: 'studySlice',
    initialState: {
      studyIdentifiers: { pid, study_id, session_id },
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
        addExpToUser(
          FIREBASE.fStore,
          state.studyIdentifiers?.study_id || 'test',
          state.studyIdentifiers?.pid || 'test',
          response.payload.signature as string
        );
      },
      saveTrialAnswer(
        state,
        {
          payload,
        }: PayloadAction<{
          trialName: string;
          trialId: string;
          answer: string | object;
          type?: StudyComponent['type'];
        }>
      ) {
        if (payload.type === 'trials' || payload.type === 'practice') {
          state[payload.type][payload.trialName][payload.trialId] = {
            complete: true,
            answer: payload.answer,
          };
          //add to firebase
          const identifier = state.studyIdentifiers;
          if (identifier) {
            saveTrialToFB(
              FIREBASE.fStore,
              identifier.pid,
              identifier.study_id,
              payload.trialId,
              payload.trialName,
              payload.answer,
              payload.type
            );
          }
        }
      },
      saveSurvey(
        state,
        { payload }: PayloadAction<Record<string, string | number>>
      ) {
        state.survey = payload;
        //add to firebase
        const identifier = state.studyIdentifiers;
        if (identifier) {
          saveSurveyToFB(
            FIREBASE.fStore,
            identifier.pid,
            identifier.study_id,
            payload
          );
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

  if (session.info.provenance) {
    trrack.import(session.info.provenance);
  }
  session.sync({ provenance: trrack.export() });

  trrack.currentChange(() => {
    session.sync({ provenance: trrack.export() });
  });

  return {
    store,
    trrack,
    trrackStore,
    session,
    actions: studySlice.actions,
    loadGraph(graph: string) {
      trrack.import(graph);
    },
  };
}

export type MainStoreContextValue = ReturnType<typeof studyStoreCreator>;

export const MainStoreContext = createContext<MainStoreContextValue>(null!);

export function useCreatedStore() {
  return useContext(MainStoreContext);
}

export function useStoreActions() {
  return useCreatedStore().actions;
}

// Hooks
type AppDispatch = ReturnType<typeof studyStoreCreator>['store']['dispatch'];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export function useStudySelector() {
  return useAppSelector((s) => s.study);
}
