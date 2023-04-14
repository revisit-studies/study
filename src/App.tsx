import { createContext} from 'react';

import { TrrackStoreType } from "@trrack/redux";
import { createSelectorHook, Provider } from "react-redux";
import { store, trrackStore } from "./store";

import StudyController from "./controllers/StudyController";
import AppHeader from "./components/interface/AppHeader";
import { AppShell } from '@mantine/core';
import { flagsContext, flagsStore } from './store/flags';
import AppAside from './components/interface/AppAside';
import AppNavBar from './components/interface/AppNavBar';
import HelpModal from './components/interface/HelpModal';

const trrackContext = createContext<TrrackStoreType>(undefined!);
export const useTrrackSelector = createSelectorHook(trrackContext as any);

export default function AppShellDemo() {
  return (
    <Provider store={trrackStore} context={trrackContext as any}>
      <Provider store={store}>
        <Provider store={flagsStore} context={flagsContext as any}>
          <AppShell
          navbarOffsetBreakpoint="sm"
          asideOffsetBreakpoint="sm"
          navbar={
            <AppNavBar />
          }
          aside={
            <AppAside />
          }
          header={
            <AppHeader />
          }
        >
          <HelpModal />

          <StudyController />
        </AppShell>
      </Provider>
    </Provider>
  </Provider>
  );
}
