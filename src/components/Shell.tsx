import {
  ReactNode,
  useEffect,
  useState,
} from 'react';
import { Provider } from 'react-redux';
import {
  RouteObject, useRoutes, useSearchParams,
} from 'react-router-dom';
import { LoadingOverlay, Title } from '@mantine/core';
import {
  GlobalConfig,
  Nullable,
  ParsedStudyConfig,
} from '../parser/types';
import { useStudyId } from '../routes/utils';
import {
  StudyStoreContext,
  StudyStore,
  studyStoreCreator,
} from '../store/store';

import ComponentController from '../controllers/ComponentController';
import { NavigateWithParams } from '../utils/NavigateWithParams';
import { StepRenderer } from './StepRenderer';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { generateSequenceArray } from '../utils/handleRandomSequences';
import { getStudyConfig } from '../utils/fetchConfig';
import { ParticipantMetadata } from '../store/types';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';
import ResourceNotFound from '../ResourceNotFound';
import { useAuth } from '../store/hooks/useAuth';

export function Shell({ globalConfig }: {
  globalConfig: GlobalConfig;
}) {
  // Pull study config
  const studyId = useStudyId();
  const [activeConfig, setActiveConfig] = useState<ParsedStudyConfig | null>(null);
  const isValidStudyId = globalConfig.configsList.includes(studyId);

  const auth = useAuth();

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

      const ipRes = await fetch('https://api.ipify.org?format=json').catch((_) => '');
      const ip: { ip: string } = ipRes instanceof Response ? await ipRes.json() : { ip: '' };

      const metadata: ParticipantMetadata = {
        language: navigator.language,
        userAgent: navigator.userAgent,
        resolution: {
          width: window.screen.width, height: window.screen.height, availHeight: window.screen.availHeight, availWidth: window.screen.availWidth, colorDepth: window.screen.colorDepth, orientation: window.screen.orientation.type, pixelDepth: window.screen.pixelDepth,
        },
        ip: ip.ip,
      };

      const participantSession = await storageEngine.initializeParticipantSession(searchParamsObject, activeConfig, metadata, urlParticipantId);

      // Initialize the redux stores
      const newStore = await studyStoreCreator(studyId, activeConfig, participantSession.sequence, metadata, participantSession.answers, auth.user.isAdmin);
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
            element: activeConfig.errors.length > 0 ? (
              <>
                <Title order={2} mb={8}>Error loading config</Title>
                <ErrorLoadingConfig issues={activeConfig.errors} type="error" />
              </>
            ) : <ComponentController />,
          },
        ],
      }]);
    }
    initializeUserStoreRouting();
  }, [storageEngine, activeConfig, studyId, searchParams, auth.user.isAdmin]);

  const routing = useRoutes(routes);

  let toRender: ReactNode = null;

  // Definitely a 404
  if (!isValidStudyId) {
    toRender = <ResourceNotFound />;
  } else if (routes.length === 0) {
    toRender = <LoadingOverlay visible />;
  } else {
    // If routing is null, we didn't match any routes
    toRender = routing && store
      ? (
        <StudyStoreContext.Provider value={store}>
          <Provider store={store.store}>
            {routing}
          </Provider>
        </StudyStoreContext.Provider>
      )
      : <ResourceNotFound />;
  }
  return toRender;
}
