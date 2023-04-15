import { configureStore, createSlice } from "@reduxjs/toolkit";
import { createContext } from "react";
import { createDispatchHook, createSelectorHook } from "react-redux";

const flags = createSlice({
  name: "flags",
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

export const flagsContext = createContext(null);
export const useFlagsSelector = createSelectorHook(flagsContext as any);
export const useFlagsDispatch = createDispatchHook(flagsContext as any);
