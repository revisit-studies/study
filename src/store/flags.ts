import { configureStore, createSlice } from '@reduxjs/toolkit';
import { createContext } from 'react';
import { createDispatchHook, createSelectorHook } from 'react-redux';

const flags = createSlice({
  name: 'flags',
  initialState: {
    showAdmin: false,
    showHelpText: false,
  },
  reducers: {
    toggleShowAdmin: (state) => {
      state.showAdmin = !state.showAdmin;
    },
    toggleShowHelpText: (state) => {
      state.showHelpText = !state.showHelpText;
    },
  },
});

export const { toggleShowAdmin, toggleShowHelpText } = flags.actions;

export const flagsStore = configureStore({
  reducer: flags.reducer,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const flagsContext: any = createContext(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useFlagsSelector = createSelectorHook(flagsContext as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useFlagsDispatch = createDispatchHook(flagsContext as any);
