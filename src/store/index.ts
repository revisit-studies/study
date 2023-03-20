import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { configureTrrackableStore } from '@trrack/redux';

const studySlice = createSlice({
  name: 'studySlice',
  initialState: {
    currentIndex: 0
  },
  reducers: {
    nextSection: state => {
      state.currentIndex += 1;
    },
    gotoSection: (state, sectionNum: PayloadAction<number>) => {
      state.currentIndex = sectionNum.payload;
    }
  }
});

export const { nextSection, gotoSection } = studySlice.actions;

export const { store, trrack, trrackStore } = configureTrrackableStore({
  reducer: {
    study: studySlice.reducer,
  },
  slices: [studySlice],
});

export type RootState = ReturnType<typeof store.getState>;
