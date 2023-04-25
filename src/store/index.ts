import { type PayloadAction } from '@reduxjs/toolkit';
import { configureTrrackableStore, createTrrackableSlice } from '@trrack/redux';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { initFirebase } from '../firebase/init';
import { StudyComponent, StudyConfig } from '../parser/types';
import { RootState, State, Step, StudyIdentifiers } from './types';
import {addExpToUser, saveSurveyToFB, saveTrialToFB} from '../firebase/queries';

export const STUDY_ID  = 'STUDY_ID';
export const PID  = 'PARTICIPANT_ID';
export const SESSION_ID  = 'SESSION_ID';

export const DEBUG = true;

export const FIREBASE = initFirebase();

const initialState: State = {
  studyIdentifiers: null,
  config: null,
  consent: undefined,
  steps: {},
  practice: {},
  trials: {},
  survey: {}
};

const studySlice = createTrrackableSlice({
  name: 'studySlice',
  initialState,
  reducers: {
    setStudyIdentifiers(state, { payload }: PayloadAction<StudyIdentifiers>) {
      state.studyIdentifiers = payload;
    },
    saveConfig(state, config: PayloadAction<StudyConfig>) {
      const { payload } = config;
      // Set the config
      state.config = payload;

      // Create steps record to store complete status
      const steps: Record<string, Step> = {};
      payload.sequence.forEach((id, idx, arr) => {
        const component = payload.components[id];
        steps[id] = {
          ...component,
          complete: false,
          next: arr[idx + 1] || null,
        };
      });
      state.steps = steps;

      // Create answers record for trail type steps
      const trialSteps = payload.sequence.filter(
        (step) => payload.components[step].type === 'trials'
      );
      trialSteps.forEach((trialName) => {
        state.trials[trialName] = {};
      });

      // Create answers record for practice type steps
      const practiceSteps = payload.sequence.filter(
        (step) => payload.components[step].type === 'practice'
      );
      practiceSteps.forEach((trialName) => {
        state.practice[trialName] = {};
      });
    },
    completeStep(state, step) {
      state.steps[step.payload].complete = true;
    },
    saveConsent: (
      state,
      response: PayloadAction<{ signature: string, timestamp: number }>
    ) => {
      state.consent = response.payload;
      addExpToUser(FIREBASE.fStore, state.studyIdentifiers?.study_id || 'test',
          state.studyIdentifiers?.pid || 'test', response.payload.signature as string);
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
        if(identifier){
          saveTrialToFB(FIREBASE.fStore,identifier.pid, identifier.study_id,
              payload.trialId, payload.trialName, payload.answer, payload.type);
        }

      }
    },
    saveSurvey(state, { payload }: PayloadAction<Record<string, string|number>>) {
      state.survey = payload;
      //add to firebase
      const identifier = state.studyIdentifiers;
      if(identifier){
        saveSurveyToFB(FIREBASE.fStore,identifier.pid, identifier.study_id, payload);
      }
    }
  },
});

export const {
  saveSurvey,
  saveConfig,
  completeStep,
  saveTrialAnswer,
  setStudyIdentifiers,
  saveConsent
} = studySlice.actions;

export const { store, trrack, trrackStore } = configureTrrackableStore({
  reducer: {
    study: studySlice.reducer,
  },
  slices: [studySlice],
});

export const useAppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
