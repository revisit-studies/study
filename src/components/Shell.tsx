import { AppShell, Button, Group, Modal, Text } from '@mantine/core';
import { TrrackStoreType } from '@trrack/redux';
import {
  createContext,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { createSelectorHook, Provider } from 'react-redux';
import { Outlet, RouteObject, useParams, useRoutes } from 'react-router-dom';
import { parseStudyConfig } from '../parser/parser';
import {
  ContainerComponent,
  GlobalConfig,
  Nullable,
  StudyComponent,
  StudyComponents,
  StudyConfig,
  isContainerComponent,
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

import { useDisclosure } from '@mantine/hooks';
import { PREFIX } from '../App';
import ComponentController from '../controllers/ComponentController';
import { FirebaseContext, initFirebase } from '../storage/init';
import { ProvenanceStorage } from '../storage/types';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';
import { StudyEnd } from './StudyEnd';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion
const trrackContext: any = createContext<TrrackStoreType>(undefined!);
export const useTrrackSelector = createSelectorHook(trrackContext);

async function fetchStudyConfig(configLocation: string, configKey: string) {
  const config = await (await fetch(`${PREFIX}${configLocation}`)).text();
  return parseStudyConfig(config, configKey);
}

function createRandomOrders(components: StudyComponents) {
  Object.keys(components).forEach((componentKey) => {
    const component = components[componentKey];
    if(component.type === 'container') {
      if(component.order === 'random') {
        const allComps = Object.keys(component.components);
        const randomArr = allComps.sort((a, b) => 0.5 - Math.random());
        component.order = randomArr;
      }

      createRandomOrders(component.components);
    }
  });
}

function assignRandomOrders(config: StudyConfig, randoms: {path: string, order: string[]}[] | undefined) {
  if(!randoms) {
    return;
  }
   
  randoms.forEach((rand) => {
    const pathArr = rand.path.split('/');

    let obj: StudyConfig | ContainerComponent = config;

    pathArr.forEach((s) => {
      const newObj = (obj.components[s] as ContainerComponent) ;
      obj = newObj;
    });

    if(pathArr.length > 0) {
     (obj as unknown as ContainerComponent).order = rand.order;
    }
  });
}

function randomizeSequence(sequence: (string | string[])[]) {
  sequence.forEach((s: string | string[], i) => {
    if(Array.isArray(s)) {
      s = s.sort((a, b) => 0.5 - Math.random());
    }
  });

  return sequence.flat();
}

function assignSequence(sequence: (string | string[])[], randoms: {path: string, order: string[]}[] | undefined) {
  if(!randoms) {
    return [];
  }
  
  let counter = 0;
  sequence.forEach((s: string | string[], i) => {
    if(Array.isArray(s)) {
      sequence[i] = randoms.find((rand) => rand.path === `_sequence-${counter}`)?.order || [];
      counter += 1;
    }
  });

  return sequence.flat();
}

type Props = {
  globalConfig: GlobalConfig;
};

export function Shell({ globalConfig }: Props) {
  const { studyId } = useParams<StudyIdParam>(); // get and set study identifiers from url

  if (
    !studyId ||
    !globalConfig.configsList
      .map((c) => sanitizeStringForUrl(c))
      .includes(studyId)
  ) {
    throw new Error('Study id invalid');
  }

  const [activeConfig, setActiveConfig] = useState<Nullable<StudyConfig>>(null);
  const [firebase, setFirebase] = useState<Nullable<ProvenanceStorage>>(null);
  const [storeObj, setStoreObj] = useState<Nullable<StudyStore>>(null);

  useEffect(() => {
    const configKey = globalConfig.configsList.find(
      (c) => sanitizeStringForUrl(c) === studyId
    );

    if (configKey) {
      const configJSON = globalConfig.configs[configKey];
      fetchStudyConfig(`${configJSON.path}`, configKey).then((config) => {
        setActiveConfig(config);
      });
    }
  }, [globalConfig, studyId]);

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

      const randoms = await firebase?.saveStudyConfig(config, sid);

      const containerRandoms = randoms?.filter((rand) => !rand.path.startsWith('_sequence-'));
      const sequenceRandoms = randoms?.filter((rand) => rand.path.startsWith('_sequence-'));

      if(config.randomizationStrategy && config.randomizationStrategy === 'latinSquares') {
        assignRandomOrders(config, containerRandoms);
        config.sequence = assignSequence(config.sequence, sequenceRandoms);
      }
      else {
        createRandomOrders(config.components);
        config.sequence = randomizeSequence(config.sequence);
      }

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
    [flagDispatch, handlers, store]
  );

  return (
    <AppShell
      navbar={<AppNavBar />}
      aside={<AppAside />}
      header={<AppHeader />}
    >
      <Modal
        opened={opened}
        onClose={() => close(false)}
        title={<Text weight="bold">Detected ongoing session</Text>}
        centered
      >
        <Text>Do you want to continue that session or start over?</Text>
        <Group mt="xl">
          <Button
            variant="outline"
            onClick={() => {
              close(true);
            }}
          >
            Continue
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              close(false);
            }}
          >
            Start Over
          </Button>
        </Group>
      </Modal>
      <HelpModal />
      <Outlet />
    </AppShell>
  );
}

function useStudyRoutes(
  studyId: Nullable<string>,
  config: Nullable<StudyConfig>,
  store: Nullable<StudyStore> // used only to detect if store is ready
) {
  const routes: RouteObject[] = [];

  if (studyId && config && store) {
    const { sequence, components } = config;

    const enhancedSequence = [...sequence as string[], 'end'];

    const stepRoutes: RouteObject[] = [];

    stepRoutes.push({
      path: '/',
      element: <NavigateWithParams to={`${enhancedSequence[0]}`} replace />,
    });

    enhancedSequence.forEach((step: string) => {
      const component = components[step];

      if (step === 'end') {
        stepRoutes.push({
          path: '/end',
          element: <StudyEnd />,
        });
      } else if (component.type === 'container') {
        const { order } = component as ContainerComponent;

        if (order.length > 0) {
          const baseRoute: RouteObject = {
            path: step,
            element: <NavigateWithParams to={`${order[0]}`} replace />,
          };
          const trialRoute: RouteObject = {
            path: `${step}/:trialId`,
            element: <ComponentController />,
          };
          stepRoutes.push(baseRoute);
          stepRoutes.push(trialRoute);
        }
      } else {
        stepRoutes.push({
          path: `/${step}`,
          element: <ComponentController />,
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
