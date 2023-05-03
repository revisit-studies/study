import { AppShell } from '@mantine/core';
import { TrrackStoreType } from '@trrack/redux';
import { createContext, ReactNode, useEffect, useMemo, useState } from 'react';
import { createSelectorHook, Provider } from 'react-redux';
import { Outlet, RouteObject, useParams, useRoutes } from 'react-router-dom';
import SurveyController from '../controllers/SurveyController';
import { parseStudyConfig } from '../parser/parser';
import {
  GlobalConfig,
  Nullable,
  StudyComponent,
  StudyConfig,
  TrialsComponent,
} from '../parser/types';
import { StudyIdParam } from '../routes';
import {
  MainStoreContext,
  MainStoreContextValue,
  studyStoreCreator,
} from '../store';
import { flagsContext, flagsStore } from '../store/flags';
import { NavigateWithParams } from '../utils/NavigateWithParams';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import Consent from './Consent';

import { PREFIX } from '../App';
import {
  default as TrialController,
  default as TrialPracticeController,
} from '../controllers/TrialPracticeController';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';
import { NextButton } from './NextButton';
import { StudyEnd } from './StudyEnd';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion
const trrackContext: any = createContext<TrrackStoreType>(undefined!);
export const useTrrackSelector = createSelectorHook(trrackContext);

async function fetchStudyConfig(configLocation: string) {
  const config = await (await fetch(`${PREFIX}${configLocation}`)).text();
  return parseStudyConfig(config);
}

type Props = {
  globalConfig: GlobalConfig;
};

export function Shell({ globalConfig }: Props) {
  const { studyId } = useParams<StudyIdParam>(); // get and set study identifiers from url

  if (
    !studyId ||
    !globalConfig.configsList
      .map((c) => sanitizeStringForUrl(globalConfig.configs[c].title))
      .includes(studyId)
  ) {
    throw new Error('Study id invalid');
  }

  const configJSON = globalConfig.configsList
    .map((c) => globalConfig.configs[c])
    .find((con) => sanitizeStringForUrl(con.title) === studyId);

  const [activeConfig, setActiveConfig] = useState<Nullable<StudyConfig>>(null);

  useEffect(() => {
    if (!configJSON) return;

    fetchStudyConfig(`configs/${configJSON.path}`).then((config) => {
      setActiveConfig(config);
    });
  }, [configJSON]);

  const storeLike: Nullable<MainStoreContextValue> = useMemo(() => {
    if (!activeConfig || !studyId) return null;

    return studyStoreCreator(studyId, activeConfig);
  }, [activeConfig, studyId]);

  const routing = useStudyRoutes(studyId, activeConfig, storeLike);

  if (!routing || !storeLike) return null;

  const { trrackStore, store } = storeLike;

  return (
    <MainStoreContext.Provider value={storeLike}>
      <Provider store={trrackStore} context={trrackContext}>
        <Provider store={store}>
          <Provider store={flagsStore} context={flagsContext as any}>
            {routing}
          </Provider>
        </Provider>
      </Provider>
    </MainStoreContext.Provider>
  );
}

function StepRenderer() {
  return (
    <AppShell
      navbarOffsetBreakpoint="sm"
      asideOffsetBreakpoint="sm"
      navbar={<AppNavBar />}
      aside={<AppAside />}
      header={<AppHeader />}
    >
      <HelpModal /> {/* <StudyController /> */}
      <Outlet />
    </AppShell>
  );
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
  practice: <TrialPracticeController />,
  attentionTest: (
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

function useStudyRoutes(
  studyId: Nullable<string>,
  config: Nullable<StudyConfig>,
  store: Nullable<MainStoreContextValue> // used only to detect if store is ready
) {
  const routes: RouteObject[] = [];

  if (studyId && config && store) {
    const { sequence, components } = config;

    const enhancedSequence = [...sequence, 'end'];

    const stepRoutes: RouteObject[] = [];

    stepRoutes.push({
      path: '/',
      element: <NavigateWithParams to={`${enhancedSequence[0]}`} replace />,
    });

    enhancedSequence.forEach((step: string) => {
      const component = components[step];
      const componentType = component?.type || 'end';

      const element = elements[componentType];

      if (componentType === 'trials' || componentType === 'practice') {
        const { order } = component as TrialsComponent;

        if (order.length > 0) {
          const baseRoute: RouteObject = {
            path: step,
            element: <NavigateWithParams to={`${order[0]}`} replace />,
          };
          const trialRoute: RouteObject = {
            path: `${step}/:trialId`,
            element:
              componentType === 'trials' ? (
                <TrialController />
              ) : (
                <TrialPracticeController />
              ),
          };
          stepRoutes.push(baseRoute);
          stepRoutes.push(trialRoute);
        }
      } else {
        stepRoutes.push({
          path: `/${step}`,
          element,
        });
      }
    });

    const studyRoute: RouteObject = {
      element: <StepRenderer />,
      children: stepRoutes,
    };

    routes.push(studyRoute);
  }

  const rt = useRoutes(routes);

  return routes.length > 0 ? rt : null;
}
