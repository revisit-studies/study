import { PayloadAction, configureStore, createSlice } from '@reduxjs/toolkit';
import { createContext } from 'react';
import { createDispatchHook, createSelectorHook } from 'react-redux';
import { ResponseBlockLocation } from '../parser/types';

const flags = createSlice({
  name: 'flags',
  initialState: {
    showAdmin: false,
    showHelpText: false,
    responseBlocksValid: { aboveStimulus: false, belowStimulus: false, sidebar: false},
  },
  reducers: {
    toggleShowAdmin: (state) => {
      state.showAdmin = !state.showAdmin;
    },
    toggleShowHelpText: (state) => {
      state.showHelpText = !state.showHelpText;
    },
    resetResponseBlockValidation: (state) => {
      state.responseBlocksValid = { aboveStimulus: false, belowStimulus: false, sidebar: false};
    },
    updateResponseBlockValidation: (state, payload: PayloadAction<{ location: ResponseBlockLocation, status: boolean }>) => {
      state.responseBlocksValid[payload.payload.location] = payload.payload.status;
    }
  },
});

export const { toggleShowAdmin, toggleShowHelpText, resetResponseBlockValidation, updateResponseBlockValidation } = flags.actions;

export const flagsStore = configureStore({
  reducer: flags.reducer,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const flagsContext: any = createContext(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useFlagsSelector = createSelectorHook(flagsContext as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useFlagsDispatch = createDispatchHook(flagsContext as any);
