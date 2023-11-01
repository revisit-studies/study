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
  GlobalConfig,
  Nullable,
  OrderObject, 

  StudyConfig,
} from '../parser/types';
import { StudyIdParam } from '../routes';
import {
  MainStoreContext,
  StudyStore,
  studyStoreCreator,
  useCreatedStore,
} from '../store/store';
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
import { FirebaseContext, getSession, initFirebase } from '../storage/init';
import { ProvenanceStorage } from '../storage/types';
import AppAside from './interface/AppAside';
import AppHeader from './interface/AppHeader';
import AppNavBar from './interface/AppNavBar';
import HelpModal from './interface/HelpModal';
import { StudyEnd } from './StudyEnd';
import { deepCopy } from '../utils/deepCopy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion
const trrackContext: any = createContext<TrrackStoreType>(undefined!);
export const useTrrackSelector = createSelectorHook(trrackContext);

async function fetchStudyConfig(configLocation: string, configKey: string) {
  const config = await (await fetch(`${PREFIX}${configLocation}`)).text();
  return parseStudyConfig(config, configKey);
}

function _orderObjectToList(
  order: OrderObject, 
  pathsFromFirebase: {
    path: string;
    order: string[];
  }[] | null,
 path: string
 ) : string[] {
  
  for(let i = 0; i < order.components.length; i ++) {
    const curr = order.components[i];
    if(typeof curr !== 'string') {
      order.components[i] = _orderObjectToList(curr, pathsFromFirebase, path + '-' + i) as any;
    }
  }

  if(order.order === 'random' && pathsFromFirebase) {
    const randomArr = order.components.sort((a, b) => 0.5 - Math.random());

    order.components = randomArr;
  }

  else if(order.order === 'latinSquare' && pathsFromFirebase) {
    order.components = pathsFromFirebase.find((p) => p.path === path)!.order.map((o) => {
      if(o.startsWith('_orderObj')) {
        return order.components[+o.slice(9)];
      }
      
      return o;
    });
  }

  return order.components.flat().slice(0, order.numSamples ? order.numSamples : undefined) as any;
}

function orderObjectToList(
  order: OrderObject, 
  pathsFromFirebase: {
    path: string;
    order: string[];
  }[] | null
 ) : string[] {
  const orderCopy = deepCopy(order);

  _orderObjectToList(orderCopy, pathsFromFirebase, 'root');
  return orderCopy.components.flat().slice(0, orderCopy.numSamples ? orderCopy.numSamples : undefined) as any as any;
}

export function Shell({ globalConfig }: {
  globalConfig: GlobalConfig;
}) {
  const { studyId } = useParams<StudyIdParam>(); // get and set study identifiers from url

  const [orderSequence, setOrderSequence] = useState<string[] | null>(null);

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
    if (!activeConfig || !studyId || !firebase ) return;

    let active = true;

    async function init(
      sid: string,
      config: StudyConfig,
      fb: ProvenanceStorage
    ) {
      setStoreObj(null);

      if(!firebase) {
        return;
      }

      const randoms = await firebase?.saveStudyConfig(config, sid);
    
      const orderConfig = orderObjectToList(activeConfig!.sequence, randoms);

      const st = await studyStoreCreator(sid, config, orderConfig, fb);

      setOrderSequence(orderConfig);

      if (!active) return;

      setStoreObj(st);
    }

    init(studyId, activeConfig, firebase);

    return () => {
      active = false;
    };
  }, [activeConfig, studyId, firebase]);

  const routing = useStudyRoutes(studyId, activeConfig, orderSequence, storeObj);

  if (!routing || !storeObj || !firebase) return null;

  const { trrackStore, store, trrack } = storeObj;

  return (
    <FirebaseContext.Provider key={trrack.root.id} value={firebase}>
      <MainStoreContext.Provider value={storeObj}>
        <Provider store={trrackStore} context={trrackContext}>
          <Provider store={store}>
            <Provider store={flagsStore} context={flagsContext}>
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
  sequence: Nullable<string[]>,
  store: Nullable<StudyStore> // used only to detect if store is ready
) {
  const routes: RouteObject[] = [];
 
  if (studyId && config && store && sequence) {
    const enhancedSequence = [...sequence as string[], 'end'];

    const stepRoutes: RouteObject[] = [];

    stepRoutes.push({
      path: '/',
      element: <NavigateWithParams to={`${enhancedSequence[0]}`} replace />,
    });

    enhancedSequence.forEach((step: string) => {
      if (step === 'end') {
        stepRoutes.push({
          path: '/end',
          element: <StudyEnd />,
        });
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
