import { AppShell, Button, Group, Modal } from '@mantine/core';
import { TrrackStoreType } from '@trrack/redux';
import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
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
  StudyStore,
  studyStoreCreator,
  useCreatedStore,
} from '../store';
import {
  flagsContext,
  flagsStore,
  setTrrackExists,
  useFlagsDispatch,
  useFlagsSelector,
} from '../store/flags';
import { NavigateWithParams } from '../utils/NavigateWithParams';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import Consent from './Consent';

import { useDisclosure } from '@mantine/hooks';
import { PREFIX } from '../App';
import TrainingController from '../controllers/TrainingController';
import {
  default as TrialController,
  default as TrialPracticeController,
} from '../controllers/TrialPracticeController';
import { FirebaseContext, initFirebase } from '../storage/init';
import { ProvenanceStorage } from '../storage/types';
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
      .map((c) => sanitizeStringForUrl(globalConfig.configs[c].urlKey))
      .includes(studyId)
  ) {
    throw new Error('Study id invalid');
  }

  const [activeConfig, setActiveConfig] = useState<Nullable<StudyConfig>>(null);
  const [firebase, setFirebase] = useState<Nullable<ProvenanceStorage>>(null);
  const [storeObj, setStoreObj] = useState<Nullable<StudyStore>>(null);

  useEffect(() => {
    const configJSON = globalConfig.configsList
      .map((c) => globalConfig.configs[c])
      .find((cfg) => sanitizeStringForUrl(cfg.urlKey) === studyId);

    if (configJSON)
      fetchStudyConfig(`configs/${configJSON.path}`).then((config) => {
        setActiveConfig(config);
      });
  }, [globalConfig]);

  useEffect(() => {
    if (!activeConfig) return;

    let active = true;

    async function fn() {
      setFirebase(null);
      const fb = await initFirebase(true);

      if (!active) return;

      setFirebase(fb);
    }

    fn();

    return () => {
      active = false;
    };
  }, [activeConfig]);

  useEffect(() => {
    if (!activeConfig || !studyId || !firebase) return;

    let active = true;

    async function init(
      sid: string,
      config: StudyConfig,
      fb: ProvenanceStorage
    ) {
      setStoreObj(null);
      const st = await studyStoreCreator(sid, config, fb);

      if (!active) return;

      setStoreObj(st);
    }

    init(studyId, activeConfig, firebase);

    return () => {
      active = false;
    };
  }, [activeConfig, studyId, firebase]);

  const routing = useStudyRoutes(studyId, activeConfig, storeObj);

  if (!routing || !storeObj || !firebase) return null;

  const { trrackStore, store, trrack } = storeObj;

  return (
    <FirebaseContext.Provider key={trrack.root.id} value={firebase}>
      <MainStoreContext.Provider value={storeObj}>
        <Provider store={trrackStore} context={trrackContext}>
          <Provider store={store}>
            <Provider store={flagsStore} context={flagsContext as any}>
              {routing}
            </Provider>
          </Provider>
        </Provider>
      </MainStoreContext.Provider>
    </FirebaseContext.Provider>
  );
}

function StepRenderer() {
  const store = useCreatedStore();
  const trrackExists = useFlagsSelector((f) => f.trrackExists);
  const flagDispatch = useFlagsDispatch();
  const [opened, handlers] = useDisclosure(trrackExists);

  const close = useCallback(
    (load: boolean) => {
      if (load) {
        store.restoreSession();
      } else {
        store.startNewSession();
      }
      flagDispatch(setTrrackExists(false));
      handlers.close();
    },
    [store, flagDispatch]
  );

  return (
    <AppShell
      navbarOffsetBreakpoint="sm"
      asideOffsetBreakpoint="sm"
      navbar={<AppNavBar />}
      aside={<AppAside />}
      header={<AppHeader />}
    >
      <Modal
        opened={opened}
        onClose={() => close(false)}
        title="Load previous session"
        centered
      >
        <Group mt="xl">
          <Button
            variant="outline"
            onClick={() => {
              close(true);
            }}
          >
            Yes
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              close(false);
            }}
          >
            Start New
          </Button>
        </Group>
      </Modal>
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
      <TrainingController />
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
  trials: <TrialPracticeController />,
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
  store: Nullable<StudyStore> // used only to detect if store is ready
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
