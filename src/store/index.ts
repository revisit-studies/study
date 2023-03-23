import { type PayloadAction } from '@reduxjs/toolkit'
import { configureTrrackableStore, createTrrackableSlice } from '@trrack/redux';

interface State {
  currentIndex: number;
  answers: Array<{ [id: string]: unknown }>,
}

const initialState: State = {
  currentIndex: 0,
  answers: [],
}

const studySlice = createTrrackableSlice({
  name: 'studySlice',
  initialState,
  reducers: {
    nextSection: state => {
      state.currentIndex += 1;
    },
    gotoSection: (state, sectionNum: PayloadAction<number>) => {
      state.currentIndex = sectionNum.payload;
    },
    saveAnswer: (state, answer: PayloadAction<{ [id: string]: unknown }>) => {
      state.answers.push(answer);
    },
  }
});

export const { nextSection, gotoSection, saveAnswer } = studySlice.actions;

export const { store, trrack, trrackStore } = configureTrrackableStore({
  reducer: {
    study: studySlice.reducer,
  },
  slices: [studySlice],
});

export type RootState = ReturnType<typeof store.getState>;
