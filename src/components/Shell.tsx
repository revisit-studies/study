import {
  useEffect,
  useState,
} from 'react';
import { Provider } from 'react-redux';
import { RouteObject, useParams, useRoutes } from 'react-router-dom';
import { parseStudyConfig } from '../parser/parser';
import {
  GlobalConfig,
  Nullable,
  OrderObject, 
  StudyConfig,
} from '../parser/types';
import { StudyIdParam } from '../routes';
import {
  StudyStoreContext,
  StudyStore,
  studyStoreCreator,
} from '../store/store';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';
import { v4 as uuidv4 } from 'uuid';

import { PREFIX } from './GlobalConfigParser';
import { deepCopy } from '../utils/deepCopy';
import ComponentController from '../controllers/ComponentController';
import { NavigateWithParams } from '../utils/NavigateWithParams';
import { StepRenderer } from './StepRenderer';
import { StudyEnd } from './StudyEnd';
import { useStorageEngine } from '../store/contexts/storage';
import { ParticipantData } from '../storage/types';
import latinSquare from '@quentinroy/latin-square';

async function fetchStudyConfig(configLocation: string, configKey: string) {
  const config = await (await fetch(`${PREFIX}${configLocation}`)).text();
  return parseStudyConfig(config, configKey);
}

function _orderObjectToList(
  order: OrderObject, 
  pathsFromFirebase: Record<string, string[][]>,
  path: string
 ) : string[] {
  
  for(let i = 0; i < order.components.length; i ++) {
    const curr = order.components[i];
    if(typeof curr !== 'string') {
      order.components[i] = _orderObjectToList(curr, pathsFromFirebase, path + '-' + i) as any;
    }
  }

  if(order.order === 'random') {
    const randomArr = order.components.sort((a, b) => 0.5 - Math.random());

    order.components = randomArr;
  }

  else if(order.order === 'latinSquare' && pathsFromFirebase) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    order.components = pathsFromFirebase[path].pop()!.map((o) => {
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
  pathsFromFirebase: Record<string, string[][]>,
 ) : string[] {
  const orderCopy = deepCopy(order);

  _orderObjectToList(orderCopy, pathsFromFirebase, 'root');
  return orderCopy.components.flat().slice(0, orderCopy.numSamples ? orderCopy.numSamples : undefined) as any;
}

function _createRandomOrders(order: OrderObject, paths: string[], path: string, index = 0) {
  const newPath = path.length > 0 ? `${path}-${index}` : 'root';
  if(order.order === 'latinSquare') {
    paths.push(newPath);
  }

  order.components.forEach((comp, i) => {
    if(typeof comp !== 'string') {
      _createRandomOrders(comp, paths, newPath, i);
    }
  });
}

function createRandomOrders(order: OrderObject) {
  const paths: string[] = [];
  _createRandomOrders(order, paths, '', 0);

  return paths;
}

function generateLatinSquare(config: StudyConfig, path: string) {
  const pathArr = path.split('-');

  let locationInSequence: any;
  pathArr.forEach((p) => {
    if (p === 'root') {
      locationInSequence = config.sequence;
    }
    else {
      locationInSequence = locationInSequence.components[+p];
    }
  });

  const options = locationInSequence.components.map((c: unknown, i: number) => typeof c === 'string' ? c : `_orderObj${i}`);
  const newSquare: string[][] = latinSquare<string>(options.sort(() => 0.5 - Math.random()), true);
  return newSquare;
}

function generateSequenceArray(config: StudyConfig, numSequences = 10000) {
  const paths = createRandomOrders(config.sequence);
  const latinSquareObject: Record<string, string[][]> = paths
    .map((p) => ({ [p]: generateLatinSquare(config, p) }))
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const sequenceArray: string[][] = [];
  Array.from({ length: numSequences }).forEach(() => {
    const sequence = orderObjectToList(config.sequence, latinSquareObject);

    // Refill the latin square if it is empty
    Object.entries(latinSquareObject).forEach(([key, value]) => {
      if (value.length === 0) {
        latinSquareObject[key] = generateLatinSquare(config, key);
      }
    });

    sequenceArray.push(sequence);
  });

  return sequenceArray;
}

export function Shell({ globalConfig }: {
  globalConfig: GlobalConfig;
}) {
  const { studyId } = useParams<StudyIdParam>();
  if (!studyId ||!globalConfig.configsList.find((c) => sanitizeStringForUrl(c))) {
    throw new Error('Study id invalid');
  }

  const [activeConfig, setActiveConfig] = useState<Nullable<StudyConfig>>(null);
  const [orderSequence, setOrderSequence] = useState<string[] | null>(null);
  const [participantSession, setParticipantSession] = useState<Nullable<ParticipantData>>(null);

  const { storageEngine } = useStorageEngine();
  useEffect(() => {
    async function fn() {
      if (!studyId || !storageEngine || !activeConfig) return;

      await storageEngine.initializeStudy(studyId, activeConfig);

      // Check if we have a sequence array
      const sequenceArray = await storageEngine.getSequenceArray();

      if (!sequenceArray) {
        // Generate a new sequence array
        await storageEngine.setSequenceArray(await generateSequenceArray(activeConfig));
      }
    }
    fn();
  }, [storageEngine, activeConfig, studyId]);

  useEffect(() => {
    async function fn() {
      if (!storageEngine || !storageEngine.isConnected()) return;

      const particpantId = await storageEngine.getCurrentParticipantId();
      const sequenceArray = await storageEngine.getSequenceArray();

      if (particpantId === null && sequenceArray !== null) {
        // Pull an order sequence from storage
        const orderSequence = await storageEngine.getSequence();
        setOrderSequence(orderSequence);
        
        // Generate a new participant id and participant session
        const newParticipantId = uuidv4();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const participantSession = await storageEngine.initializeParticipantSession(newParticipantId, orderSequence!);
        setParticipantSession(participantSession);
      } else if (particpantId) {
        const participantSession = await storageEngine.getParticipantSession(particpantId);
        setParticipantSession(participantSession);
        setOrderSequence(participantSession?.sequence || null);
      }
    }

    fn();
  }, [storageEngine, activeConfig]);

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


  const [store, setStore] = useState<Nullable<StudyStore>>(null);
  useEffect(() => {
    async function fn() {
        if (studyId === undefined || !activeConfig || !orderSequence || !participantSession) return null;

        const store = await studyStoreCreator(studyId, activeConfig, orderSequence, participantSession.answers);
        setStore(store);
    }
    
    fn();
  }, [studyId, activeConfig, orderSequence, participantSession]);

  const routing = generateStudiesRoutes(studyId, activeConfig, orderSequence);
  
  if (!routing || !store) return null;

  return (
    <StudyStoreContext.Provider value={store}>
      <Provider store={store.store}>
        {routing}
      </Provider>
    </StudyStoreContext.Provider>
  );
}

export function generateStudiesRoutes(
  studyId: Nullable<string>,
  config: Nullable<StudyConfig>,
  sequence: Nullable<string[]>,
) {
  const routes: RouteObject[] = [];
 
  if (studyId && config && sequence) {
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

  // Always used inside a component that has hooks available
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rt = useRoutes(routes);

  return routes.length > 0 ? rt : null;
}
