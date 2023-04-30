import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createContext } from 'react';
import {
  createDispatchHook,
  createSelectorHook,
  ReactReduxContextValue,
  TypedUseSelectorHook,
} from 'react-redux';
import { ResponseBlockLocation } from '../parser/types';

type TrialRecord = Record<
  string,
  {
    valid: {
      aboveStimulus: boolean;
      belowStimulus: boolean;
      sidebar: boolean;
    };
    answers: Record<string, any>;
  }
>;

const flags = createSlice({
  name: 'flags',
  initialState: {
    showAdmin: false,
    showHelpText: false,
    trialRecord: {} as TrialRecord,
  },
  reducers: {
    toggleShowAdmin: (state) => {
      state.showAdmin = !state.showAdmin;
    },
    toggleShowHelpText: (state) => {
      state.showHelpText = !state.showHelpText;
    },
    updateResponseBlockValidation: (
      state,
      {
        payload,
      }: PayloadAction<{
        location: ResponseBlockLocation;
        trialId: string;
        status: boolean;
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
        };
      }

      state.trialRecord[payload.trialId].valid[payload.location] =
        payload.status;
      const prev = state.trialRecord[payload.trialId].answers;

      state.trialRecord[payload.trialId].answers = {
        ...prev,
        ...payload.answers,
      };
    },
  },
});

export const {
  toggleShowAdmin,
  toggleShowHelpText,
  updateResponseBlockValidation,
} = flags.actions;

export const flagsStore = configureStore({
  reducer: flags.reducer,
});

type FlagStore = ReturnType<typeof flagsStore.getState>;
type FlagDispatch = typeof flagsStore.dispatch;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const flagsContext = createContext<ReactReduxContextValue<FlagStore>>(
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  {} as any
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useFlagsSelector: TypedUseSelectorHook<FlagStore> =
  createSelectorHook(flagsContext);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useFlagsDispatch: () => FlagDispatch =
  createDispatchHook<FlagStore>(flagsContext);

export function useAreResponsesValid(id: string) {
  return useFlagsSelector((state) => {
    if (id.length === 0) return true;

    const valid = state.trialRecord[id]?.valid;

    if (!valid) return false;

    return Object.values(valid).every((x) => x);
  });
}

export function useAggregateResponses(id: string) {
  return useFlagsSelector((state) => {
    if (id.length === 0) return null;

    const answers = state.trialRecord[id]?.answers;
    if (!answers) return null;

    return answers; // Test
  });
}
