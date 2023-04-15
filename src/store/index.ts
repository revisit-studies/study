import { type PayloadAction } from "@reduxjs/toolkit";
import { configureTrrackableStore, createTrrackableSlice } from "@trrack/redux";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import {
  StudyComponent,
  StudyConfig,
  isTrialsComponent,
} from "../parser/types";
import { useCurrentStep } from "../routes";

export interface TrialResult {
  complete: boolean;
  answer: string | object | null;
}

type TrialRecord = Record<string, TrialResult>;

interface Step extends StudyComponent {
  complete: boolean;
  next: string | null;
}

interface State {
  config: StudyConfig | null;
  consent?: { signature: unknown; timestamp: number };
  steps: Record<string, Step>;
  trials: Record<string, TrialRecord>;
}

const initialState: State = {
  config: null,
  consent: undefined,
  steps: {},
  trials: {},
};

const studySlice = createTrrackableSlice({
  name: "studySlice",
  initialState,
  reducers: {
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

export const { saveConfig, completeStep, saveTrialAnswer } = studySlice.actions;

export const { store, trrack, trrackStore } = configureTrrackableStore({
  reducer: {
    study: studySlice.reducer,
  },
  slices: [studySlice],
});

export const useAppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export function useNextStep() {
  const currentStep = useCurrentStep();

  const { config, steps } = useAppSelector((state) => state.study);

  if (currentStep === "end") return null;

  if (!config) return null;

  return steps[currentStep].next || "end";
}

/**
 * Get total number of trials and completed trials for given trial group.
 * Useful for progress calculation.
 * Can write similar function for overall progress
 */
export function useCompletedTrialMetric(trialName: string) {
  const { config, trials } = useAppSelector((state) => state.study);
  const trialConfig = config?.components[trialName];

  if (trialConfig && isTrialsComponent(trialConfig)) {
    const totalTrials = trialConfig.order.length;
    const totalCompleted = Object.values(trials[trialName]).filter(
      (t) => t.complete
    ).length;

    return {
      name: trialName,
      totalTrials,
      completedTrials: totalCompleted,
    };
  }
  return null;
}

/**
 *
 * @returns Returns current trial if any else null
 */
export function useCurrentTrial() {
  const currentStep = useCurrentStep();

  const { config, trials } = useAppSelector((state) => state.study);

  if (
    currentStep.length === 0 ||
    !config ||
    config.components[currentStep]?.type !== "trials"
  )
    return null;

  const trialId = useLocation().pathname.split("/")[2]; // Assumes /<trialname>/:id

  return {
    trailName: currentStep,
    trialId,
  };
}

/**
 *
 * @param trialId Trial id for which to get status
 * @returns TrialResult object with complete status and any answer if present. Returns null if not in trial step
 */
export function useTrialStatus(trialId: string | null): TrialResult | null {
  const currentStep = useCurrentStep();
  const { config, trials } = useAppSelector((state) => state.study);

  if (
    currentStep.length === 0 ||
    !trialId ||
    !config ||
    config.components[currentStep]?.type !== "trials"
  )
    return null;

  const status: TrialResult | null = trials[currentStep][trialId];

  return (
    status || {
      complete: false,
      answer: null,
    }
  );
}

export type RootState = ReturnType<typeof store.getState>;
