import { createContext, useEffect, useState } from "react";

import { ReactNode } from "react";
import Consent from "./components/Consent";
import { NextButton } from "./components/NextButton";
import TrialController from "./controllers/TrialController";
import { parseStudyConfig } from "./parser/parser";
import { StudyComponent, StudyConfig } from "./parser/types";

import { TrrackStoreType } from "@trrack/redux";
import { createSelectorHook, Provider } from "react-redux";
import { saveConfig, store, trrackStore } from "./store";

import { RouterProvider } from "react-router-dom";
import { StudyEnd } from "./components/StudyEnd";
import { createRouter } from "./routes";
import { flagsContext, flagsStore } from "./store/flags";

const trrackContext = createContext<TrrackStoreType>(undefined!);
export const useTrrackSelector = createSelectorHook(trrackContext as any);

async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(configLocation)).text();
  return parseStudyConfig(config);
}

const elements: Record<StudyComponent["type"], ReactNode> = {
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
  practice: (
    <>
      <div>practice component goes here</div>
      <NextButton />
    </>
  ),
  "attention-test": (
    <>
      <div>attention test component goes here</div>
      <NextButton />
    </>
  ),
  trials: <TrialController />,
  survey: (
    <>
      <div>survey component goes here</div>
      <NextButton />
    </>
  ),
  end: <StudyEnd />,
};

export default function AppShellDemo() {
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
    if (!config) {
      fetchStudyConfig("/src/configs/config-cleveland.hjson").then((cfg) => {
        store.dispatch(saveConfig(cfg));
      });
    }
  }, [config]);

  const storeCfg = () => store.getState().study.config;

  if (!storeCfg()) return null; // Don't load anything till store config is set

  const router = createRouter(config, elements);

  return (
    <Provider store={trrackStore} context={trrackContext as any}>
      <Provider store={store}>
        <Provider store={flagsStore} context={flagsContext as any}>
          {router && <RouterProvider router={router} />}
        </Provider>
      </Provider>
    </Provider>
  );
}
