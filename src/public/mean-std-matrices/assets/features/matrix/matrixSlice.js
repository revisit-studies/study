import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../../constants/matrixInitialState';

const matrixSlice = createSlice({
  name: 'matrix',
  initialState,
  reducers: {
    setParameters: (state, action) => {
      state.parameters = action.payload;
    },

    setEncoding: (state, action) => {
      state.parameters.encoding = action.payload;
    },
    setIsSnr: (state, action) => {
      state.parameters.isSnr = action.payload === 'snr';
    },
    setIsPow: (state, action) => {
      state.parameters.isPow = action.payload;
    },

    setColorScale: (state, action) => {
      state.parameters.colorScale = action.payload;
    },

    setNMeans: (state, action) => {
      state.parameters.nMeans = action.payload;
    },
    setNStds: (state, action) => {
      state.parameters.nStds = action.payload;
    },

    setShowTooltip: (state, action) => {
      state.parameters.showTooltip = action.payload === 'show';
    },
    setTooltip: (state, action) => {
      state.parameters.tooltipHistogram = action.payload;
    },

    setSelectedNodes: (state, action) => {
      state.selectedNodes = action.payload;
    },
    setHighlightedLinks: (state, action) => {
      state.highlightedLinks = action.payload;
    },
    setOrderNode: (state, action) => {
      state.orderNode = action.payload;
    },
  },
});

export default matrixSlice.reducer;
export const {
  setParameters,

  setEncoding,
  setIsSnr,
  setIsPow,

  setColorScale,
  setNMeans,
  setNStds,
  setTooltip,
  setShowTooltip,

  setSelectedNodes,
  setHighlightedLinks,
  setOrderNode,
} = matrixSlice.actions;
