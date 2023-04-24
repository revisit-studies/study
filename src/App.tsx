import { createContext, useEffect, useState } from 'react';

import { ReactNode } from 'react';
import Consent from './components/Consent';
import { NextButton } from './components/NextButton';
import TrialController from './controllers/TrialController';
import { parseStudyConfig } from './parser/parser';
import { StudyComponent, StudyConfig } from './parser/types';
import { TrrackStoreType } from '@trrack/redux';
import { createSelectorHook, Provider } from 'react-redux';
import { saveConfig, store, trrackStore } from './store';
import { RouterProvider } from 'react-router-dom';
import { StudyEnd } from './components/StudyEnd';
import { createRouter } from './routes';
import { flagsContext, flagsStore } from './store/flags';
import SurveyController from './controllers/SurveyController';
import PracticeController from './controllers/PracticeController';
import ConfigSwitcher from './components/ConfigSwitcher';


    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion
const trrackContext: any = createContext<TrrackStoreType>(undefined!);
export const useTrrackSelector = createSelectorHook(trrackContext);

async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(configLocation)).text();
  return parseStudyConfig(config);
}

const elements: Record<StudyComponent['type'], ReactNode> = {
  consent: (
    <>
      <Consent />
    </>
  ),
  training: (
    <>
      <div>training component goes here</div>
      <NextButton />
    </>
  ),
  practice:  <PracticeController />,
  'attention-test': (
    <>
      <div>attention test component goes here</div>
      <NextButton />
    </>
  ),
  trials: <TrialController />,
  survey: (
    <>
     <SurveyController />
    </>
  ),
  end: <StudyEnd />,
};

export default function AppShellDemo() {
  const [activeStudyPath, setActiveStudyPath] = useState<string>();
  const [config, setConfig] = useState<StudyConfig | null>(null);

  // Subscribe to store till config is found. Then stop
  useEffect(() => {
    if (config) return;
    return store.subscribe(() => {
      const cfg = store.getState().study.config;
      if (cfg) setConfig(cfg);
    });
  });

  // Fetch and set config
  useEffect(() => {
    if (!config && activeStudyPath) {
      fetchStudyConfig(`/src/configs/${activeStudyPath}`).then((cfg) => {
        store.dispatch(saveConfig(cfg));
      });
    }
  }, [config, activeStudyPath]);

  const handleConfigChange = (path: string) => {
    setActiveStudyPath(path);
  };

  const storeCfg = () => store.getState().study.config;

  if (!activeStudyPath) return <ConfigSwitcher onChange={handleConfigChange}/>;

  if (!storeCfg()) return null; // Don't load anything till store config is set

  const router = createRouter(config, elements);

  return (
    <Provider store={trrackStore} context={trrackContext}>
      <Provider store={store}>
        <Provider store={flagsStore} context={flagsContext}>
          {router && <RouterProvider router={router} />}
        </Provider>
      </Provider>
    </Provider>
  );
}
