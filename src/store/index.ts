import { type PayloadAction } from "@reduxjs/toolkit";
import { configureTrrackableStore, createTrrackableSlice } from "@trrack/redux";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { initFirebase } from "../firebase/init";
import { StudyConfig } from "../parser/types";
import { RootState, State, Step, StudyIdentifiers } from "./types";

export const STUDY_ID = "STUDY_ID";
export const PID = "PARTICIPANT_ID";
export const SESSION_ID = "SESSION_ID";

export const DEBUG = true;

export const FIREBASE = initFirebase();

const initialState: State = {
  studyIdentifiers: null,
  config: null,
  consent: undefined,
  steps: {},
  trials: {},
};

const studySlice = createTrrackableSlice({
  name: "studySlice",
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
        (step) => payload.components[step].type === "trials"
      );
      trialSteps.forEach((trialName) => {
        state.trials[trialName] = {};
      });
    },
    completeStep(state, step) {
      state.steps[step.payload].complete = true;
    },
    saveConsent: (
      state,
      response: PayloadAction<{ signature: unknown; timestamp: number }>
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
      }>
    ) {
      state.trials[payload.trialName][payload.trialId] = {
        complete: true,
        answer: payload.answer,
      };
    },
  },
});

export const {
  saveConfig,
  completeStep,
  saveTrialAnswer,
  setStudyIdentifiers,
} = studySlice.actions;

export const { store, trrack, trrackStore } = configureTrrackableStore({
  reducer: {
    study: studySlice.reducer,
  },
  slices: [studySlice],
});

export const useAppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
