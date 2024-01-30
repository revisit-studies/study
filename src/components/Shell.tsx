import {
  useEffect,
  useState,
} from 'react';
import { Provider } from 'react-redux';
import {
  RouteObject, useParams, useRoutes, useSearchParams,
} from 'react-router-dom';
import { Box, Center, Loader } from '@mantine/core';
import { parseStudyConfig } from '../parser/parser';
import {
  GlobalConfig,
  Nullable,
  StudyConfig,
} from '../parser/types';
import { StudyIdParam } from '../routes';
import {
  StudyStoreContext,
  StudyStore,
  studyStoreCreator,
} from '../store/store';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';

import ComponentController from '../controllers/ComponentController';
import { NavigateWithParams } from '../utils/NavigateWithParams';
import { StepRenderer } from './StepRenderer';
import { StudyEnd } from './StudyEnd';
import { useStorageEngine } from '../store/storageEngineHooks';
import { generateSequenceArray } from '../utils/handleRandomSequences';
import { PREFIX } from './Prefix';

async function fetchStudyConfig(configLocation: string, configKey: string) {
  const config = await (await fetch(`${PREFIX}${configLocation}`)).text();
  return parseStudyConfig(config, configKey);
}

export function generateStudiesRoutes(
  studyId: Nullable<string>,
  config: Nullable<StudyConfig>,
  sequence: Nullable<string[]>,
) {
  const routes: RouteObject[] = [];

  if (studyId && config && sequence) {
    const stepRoutes: RouteObject[] = [];

    stepRoutes.push({
      path: '/',
      element: <NavigateWithParams to={`${sequence[0]}`} replace />,
    });

    sequence.forEach((step: string) => {
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

  return routes;
}

export function Shell({ globalConfig }: {
  globalConfig: GlobalConfig;
}) {
  // Pull study config
  const { studyId } = useParams<StudyIdParam>();
  if (!studyId || !globalConfig.configsList.find((c) => sanitizeStringForUrl(c))) {
    throw new Error('Study id invalid');
  }
  const [activeConfig, setActiveConfig] = useState<Nullable<StudyConfig>>(null);
  useEffect(() => {
    const configKey = globalConfig.configsList.find(
      (c) => sanitizeStringForUrl(c) === studyId,
    );

    if (configKey) {
      const configJSON = globalConfig.configs[configKey];
      fetchStudyConfig(`${configJSON.path}`, configKey).then((config) => {
        setActiveConfig(config);
      });
    }
  }, [globalConfig, studyId]);

  const [routes, setRoutes] = useState<RouteObject[]>([]);
  const [store, setStore] = useState<Nullable<StudyStore>>(null);
  const { storageEngine } = useStorageEngine();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    async function initializeUserStoreRouting() {
      // Check that we have a storage engine and active config (studyId is set for config, but typescript complains)
      if (!storageEngine || !activeConfig || !studyId) return;

      // Make sure that we have a study database and that the study database has a sequence array
      await storageEngine.initializeStudyDb(studyId, activeConfig);
      const sequenceArray = await storageEngine.getSequenceArray();
      if (!sequenceArray) {
        await storageEngine.setSequenceArray(await generateSequenceArray(activeConfig));
      }

      // Get or generate participant session
      const urlParticipantId = activeConfig.uiConfig.urlParticipantIdParam ? searchParams.get(activeConfig.uiConfig.urlParticipantIdParam) || undefined : undefined;
      const searchParamsObject = Object.fromEntries(searchParams.entries());
      const participantSession = await storageEngine.initializeParticipantSession(searchParamsObject, urlParticipantId);

      // Initialize the redux stores
      const newStore = await studyStoreCreator(studyId, activeConfig, participantSession.sequence, participantSession.answers);
      setStore(newStore);

      // Initialize the routing
      setRoutes(generateStudiesRoutes(studyId, activeConfig, participantSession.sequence));
    }
    initializeUserStoreRouting();
  }, [storageEngine, activeConfig, studyId, searchParams]);

  const routing = useRoutes(routes);

  return !routing || !store
    ? (
      <Box style={{ height: '100vh' }}>
        <Center style={{ height: '100%' }}>
          <Loader style={{ height: '100%' }} size={60} />
        </Center>
      </Box>
    ) : (
      <StudyStoreContext.Provider value={store}>
        <Provider store={store.store}>
          {routing}
        </Provider>
      </StudyStoreContext.Provider>
    );
}
