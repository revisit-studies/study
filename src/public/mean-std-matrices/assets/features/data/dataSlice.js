import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const filesObj = import.meta.glob('/public/mean-std-matrices/data/*');
const files = Object.keys(filesObj).map((path) => path.replace('/public/mean-std-matrices/data/', ''));

const initialState = {
  data: null,
  loading: false,
  files,
  file: null,
};

export const getData = createAsyncThunk('data/getData', async (file, { rejectWithValue }) => {
  if (!file) return rejectWithValue('No file provided');

  try {
    const response = await fetch(`/public/mean-std-matrices/data/${file}`);
    if (!response.ok) throw new Error('Failed to fetch file');

    const text = await response.text();
    const data = text
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));

    return { file, data };
  } catch (error) {
    console.error('Error loading JSON:', error);
    return rejectWithValue(error.message);
  }
});

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    setData: (state, action) => {
      state.data = action.payload;
    },
    setFile: (state, action) => {
      state.file = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getData.fulfilled, (state, action) => {
      state.data = action.payload.data;
      state.file = action.payload.file;
      state.loading = false;
    });
    builder.addCase(getData.rejected, (state, action) => {
      state.loading = false;
      console.error('ERROR IN: getData', action.payload);
    });
  },
});

export default dataSlice.reducer;
export const { setData, setFile } = dataSlice.actions;
