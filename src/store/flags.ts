import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createContext } from 'react';
import {
  createDispatchHook,
  createSelectorHook,
  ReactReduxContextValue,
  TypedUseSelectorHook,
} from 'react-redux';
import { ResponseBlockLocation } from '../parser/types';
import { StimulusParams } from './types';
import { NodeId } from '@trrack/core';

type TrialRecord = Record<
  string,
  {
    valid: {
      aboveStimulus: boolean;
      belowStimulus: boolean;
      sidebar: boolean;
    };
    answers: Record<string, any>;
    provenanceRoot: NodeId | null,
  }
>;

const flags = createSlice({
  name: 'flags',
  initialState: {
    showAdmin: false,
    showHelpText: false,
    trialRecord: {} as TrialRecord,
    trrackExists: false,
    iframeAnswers: [] as string[],
  },
  reducers: {
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
        provenanceRoot?: NodeId;
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
          provenanceRoot: null,
        };
      }
      state.trialRecord[payload.trialId].valid[payload.location] =
        payload.status;
        const prev = state.trialRecord[payload.trialId].answers;

      if(payload.provenanceRoot !== undefined) {
        state.trialRecord[payload.trialId].provenanceRoot = payload.provenanceRoot;
      }

      const answers = {...prev,...payload.answers};
      const validAnswers = Object.keys(answers).
      filter((key) => key.includes(payload.trialId)).
      reduce((cur, key) => { return Object.assign(cur, { [key]: answers[key] });}, {});

      state.trialRecord[payload.trialId].answers = validAnswers;
    },
  },
});

export const {
  toggleShowAdmin,
  toggleShowHelpText,
  setTrrackExists,
  updateResponseBlockValidation,
  setIframeAnswers,
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

export function setAnswer({trialId, status, provenanceRoot, answers}: Parameters<StimulusParams<any>['setAnswer']>[0]) {
    flagsStore.dispatch(updateResponseBlockValidation({
      location: 'sidebar',
      trialId,
      status,
      provenanceRoot,
      answers,
    }));
}

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
