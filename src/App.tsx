import { createContext } from 'react';

import { TrrackStoreType } from '@trrack/redux';
import { createSelectorHook, Provider } from 'react-redux';
import { store, trrackStore } from './store';

import StudyController from './controllers/StudyController';

const trrackContext = createContext<TrrackStoreType>(undefined!);
export const useTrrackSelector = createSelectorHook(trrackContext as any);

export default function AppShellDemo() {
  return (
    <Provider store={trrackStore} context={trrackContext as any}>
      <Provider store={store}>
        <StudyController />
      </Provider>
    </Provider>
  );
}