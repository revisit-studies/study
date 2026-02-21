import {
  ReactNode,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { Provider } from 'react-redux';
import { RouteObject, useRoutes, useSearchParams } from 'react-router';
import { LoadingOverlay, Title } from '@mantine/core';
import {
  GlobalConfig,
  Nullable,
  ParsedConfig,
  StudyConfig,
} from '../parser/types';
import { useStudyId } from '../routes/utils';
import {
  StudyStoreContext,
  StudyStore,
  studyStoreCreator,
} from '../store/store';

import { ComponentController } from '../controllers/ComponentController';
import { NavigateWithParams } from '../utils/NavigateWithParams';
import { StepRenderer } from './StepRenderer';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { generateSequenceArray } from '../utils/handleRandomSequences';
import { getStudyConfig } from '../utils/fetchConfig';
import { ParticipantMetadata } from '../store/types';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';
import { ResourceNotFound } from '../ResourceNotFound';
import { encryptIndex } from '../utils/encryptDecryptIndex';
import { parseStudyConfig } from '../parser/parser';
import { hash } from '../storage/engines/utils';
import {
  filterSequenceByCondition,
  parseConditionParam,
  resolveParticipantConditions,
} from '../utils/handleConditionLogic';

export function Shell({ globalConfig }: { globalConfig: GlobalConfig }) {
  // Pull study config
  const studyId = useStudyId();
  const [activeConfig, setActiveConfig] = useState<ParsedConfig<StudyConfig> | null>(null);
  const isValidStudyId = globalConfig.configsList.includes(studyId) || studyId === '__revisit-widget';

  useEffect(() => {
    if (studyId !== '__revisit-widget') {
      getStudyConfig(studyId, globalConfig).then((config) => {
        setActiveConfig(config);
      });
      return () => { };
    }
    if (globalConfig && studyId) {
      const messageListener = (event: MessageEvent) => {
        if (event.data.type === 'revisitWidget/CONFIG') {
          parseStudyConfig(event.data.payload).then(async (config) => {
            setActiveConfig(config);
            const sequenceArray = await generateSequenceArray(config);
            window.parent.postMessage({ type: 'revisitWidget/SEQUENCE_ARRAY', payload: sequenceArray }, '*');
          });
        }
      };

      window.addEventListener('message', messageListener);

      window.parent.postMessage({ type: 'revisitWidget/READY' }, '*');

      return () => {
        window.removeEventListener('message', messageListener);
      };
    }
    return () => { };
  }, [globalConfig, studyId]);

  const [routes, setRoutes] = useState<RouteObject[]>([]);
  const [store, setStore] = useState<Nullable<StudyStore>>(null);
  const { storageEngine } = useStorageEngine();
  const [searchParams] = useSearchParams();

  const participantId = useMemo(() => searchParams.get('participantId'), [searchParams]);
  const studyCondition = useMemo(() => parseConditionParam(searchParams.get('condition')), [searchParams]);

  useEffect(() => {
    async function initializeUserStoreRouting() {
      // Check that we have a storage engine and active config (studyId is set for config, but typescript complains)
      if (!storageEngine || !activeConfig || !studyId) return;

      try {
        // Make sure that we have a study database and that the study database has a sequence array
        await storageEngine.initializeStudyDb(studyId);
        await storageEngine.saveConfig(activeConfig);

        const sequenceArray = await storageEngine.getSequenceArray();
        if (!sequenceArray) {
          await storageEngine.setSequenceArray(
            await generateSequenceArray(activeConfig),
          );
        }

        const modes = await storageEngine.getModes(studyId);

        // Get or generate participant session
        const urlParticipantId = activeConfig.uiConfig.urlParticipantIdParam
          ? searchParams.get(activeConfig.uiConfig.urlParticipantIdParam)
          || undefined
          : undefined;
        const searchParamsObject = Object.fromEntries(searchParams.entries());

        const ipTimeoutController = new AbortController();
        const ipTimeoutId = window.setTimeout(() => ipTimeoutController.abort(), 1200);
        const ipRes = await fetch('https://api.ipify.org?format=json', {
          signal: ipTimeoutController.signal,
        }).catch(() => '');
        window.clearTimeout(ipTimeoutId);
        const ip: { ip: string } = ipRes instanceof Response ? await ipRes.json() : { ip: '' };

        const metadata: ParticipantMetadata = {
          language: navigator.language,
          userAgent: navigator.userAgent,
          resolution: {
            width: window.screen.width,
            height: window.screen.height,
            availHeight: window.screen.availHeight,
            availWidth: window.screen.availWidth,
            colorDepth: window.screen.colorDepth,
            orientation: window.screen.orientation.type,
            pixelDepth: window.screen.pixelDepth,
          },
          ip: ip.ip,
        };

        let participantSession = await storageEngine.initializeParticipantSession(
          searchParamsObject,
          activeConfig,
          metadata,
          participantId || urlParticipantId,
        );

        if (studyCondition.length > 0 && modes.developmentModeEnabled) {
          const updatedSearchParams = {
            ...participantSession.searchParams,
            condition: studyCondition.join(','),
          };
          await storageEngine.updateParticipantSearchParams(updatedSearchParams);
          await storageEngine.updateStudyCondition(studyCondition);
          participantSession = {
            ...participantSession,
            searchParams: updatedSearchParams,
            conditions: studyCondition,
          };
        }
        const activeHash = await hash(JSON.stringify(activeConfig));

        let participantConfig = activeConfig;

        if (participantSession.participantConfigHash !== activeHash) {
          participantConfig = (await storageEngine.getAllConfigsFromHash([participantSession.participantConfigHash], studyId))[participantSession.participantConfigHash] as ParsedConfig<StudyConfig>;
        }

        const effectiveStudyCondition = resolveParticipantConditions({
          urlCondition: studyCondition,
          participantConditions: participantSession.conditions,
          participantSearchParamCondition: participantSession.searchParams?.condition,
          allowUrlOverride: modes.developmentModeEnabled,
        });
        const filteredParticipantSequence = filterSequenceByCondition(participantSession.sequence, effectiveStudyCondition);
        // Initialize the redux stores
        const newStore = await studyStoreCreator(
          studyId,
          participantConfig,
          filteredParticipantSequence,
          metadata,
          participantSession.answers,
          modes,
          participantSession.participantId,
          participantSession.completed,
          false,
          participantSession.participantConfigHash !== activeHash,
        );
        setStore(newStore);
      } catch (error) {
        console.error('Error initializing user store routing:', error);
        // Fallback: initialize the store with empty data
        const generatedSequences = generateSequenceArray(activeConfig);
        const matchingSequence = generatedSequences[0];
        const fallbackSequence = filterSequenceByCondition(
          matchingSequence,
          studyCondition,
        );

        const emptyStore = await studyStoreCreator(
          studyId,
          activeConfig,
          fallbackSequence,
          {
            language: '',
            userAgent: '',
            resolution: {
              width: 0,
              height: 0,
              availHeight: 0,
              availWidth: 0,
              colorDepth: 0,
              orientation: '',
              pixelDepth: 0,
            },
            ip: '',
          },
          {},
          { developmentModeEnabled: true, dataSharingEnabled: true, dataCollectionEnabled: false },
          '',
          false,
          true,
        );
        setStore(emptyStore);
      }

      // Initialize the routing
      setRoutes([
        {
          element: <StepRenderer />,
          children: [
            {
              path: '/',
              element: <NavigateWithParams to={encryptIndex(0)} replace />,
            },
            {
              path: '/:index/:funcIndex?',
              element:
                activeConfig.errors.length > 0 ? (
                  <>
                    <Title order={2} mb={8}>
                      Error loading config
                    </Title>
                    <ErrorLoadingConfig
                      issues={activeConfig.errors}
                      type="error"
                    />
                  </>
                ) : (
                  <ComponentController />
                ),
            },
          ],
        },
      ]);
    }
    initializeUserStoreRouting();
  }, [storageEngine, activeConfig, studyId, searchParams, participantId, studyCondition]);

  const routing = useRoutes(routes);

  let toRender: ReactNode = null;

  // Definitely a 404
  if (!isValidStudyId) {
    toRender = <ResourceNotFound />;
  } else if (routes.length === 0) {
    toRender = <LoadingOverlay visible />;
  } else {
    // If routing is null, we didn't match any routes
    toRender = routing && store ? (
      <StudyStoreContext.Provider value={store}>
        <Provider store={store.store}>{routing}</Provider>
      </StudyStoreContext.Provider>
    ) : (
      <ResourceNotFound />
    );
  }
  return toRender;
}
