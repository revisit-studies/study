import {
  useEffect,
  useState,
} from 'react';
import { Provider } from 'react-redux';
import {
  RouteObject, useRoutes, useSearchParams,
} from 'react-router-dom';
import { Box, Center, Loader } from '@mantine/core';
import {
  GlobalConfig,
  Nullable,
  StudyConfig,
} from '../parser/types';
import { useStudyId } from '../routes/utils';
import {
  StudyStoreContext,
  StudyStore,
  studyStoreCreator,
} from '../store/store';
import { sanitizeStringForUrl } from '../utils/sanitizeStringForUrl';

import ComponentController from '../controllers/ComponentController';
import { NavigateWithParams } from '../utils/NavigateWithParams';
import { StepRenderer } from './StepRenderer';
import { useStorageEngine } from '../store/storageEngineHooks';
import { generateSequenceArray } from '../utils/handleRandomSequences';
import { getStudyConfig } from '../utils/fetchConfig';

export function Shell({ globalConfig }: {
  globalConfig: GlobalConfig;
}) {
  // Pull study config
  const studyId = useStudyId();
  if (!studyId || !globalConfig.configsList.find((c) => sanitizeStringForUrl(c))) {
    throw new Error('Study id invalid');
  }
  const [activeConfig, setActiveConfig] = useState<Nullable<StudyConfig>>(null);
  useEffect(() => {
    getStudyConfig(studyId, globalConfig).then((config) => {
      setActiveConfig(config);
    });
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
      const participantSession = await storageEngine.initializeParticipantSession(searchParamsObject, activeConfig, urlParticipantId);

      // Initialize the redux stores
      const newStore = await studyStoreCreator(studyId, activeConfig, participantSession.sequence, participantSession.answers);
      setStore(newStore);

      // Initialize the routing
      setRoutes([{
        element: <StepRenderer />,
        children: [
          {
            path: '/',
            element: <NavigateWithParams to="0" replace />,
          },
          {
            path: '/:index',
            element: <ComponentController />,
          },
        ],
      }]);
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
