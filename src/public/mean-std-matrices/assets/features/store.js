import { combineReducers, configureStore } from '@reduxjs/toolkit';
import matrixReducer from './matrix/matrixSlice';
import dataReducer from './data/dataSlice';

const rootReducer = combineReducers({
  matrix: matrixReducer,
  data: dataReducer,
});

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => {
    const middlewares = getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
      immutableStateInvariant: false,
    });
    return middlewares;
  },
});

export default store;
