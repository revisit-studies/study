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
import { getStudyConfig, resolveConfigKey } from '../utils/fetchConfig';
import { ParticipantMetadata } from '../store/types';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';
import { ResourceNotFound } from '../ResourceNotFound';
import { encryptIndex } from '../utils/encryptDecryptIndex';
import { parseStudyConfig } from '../parser/parser';
import { hash } from '../storage/engines/utils';
import { REVISIT_MODE } from '../storage/engines/types';
import {
  filterSequenceByCondition,
  parseConditionParam,
  resolveParticipantConditions,
} from '../utils/handleConditionLogic';
import {
  getInitialStartupAlert,
  getScreenOrientationType,
  isStorageStartupFailure,
} from './Shell.utils';

export function Shell({ globalConfig }: { globalConfig: GlobalConfig }) {
  // Pull study config
  const routeStudyId = useStudyId();
  const [activeConfig, setActiveConfig] = useState<ParsedConfig<StudyConfig> | null>(null);
  const canonicalStudyId = useMemo(() => {
    if (routeStudyId === '__revisit-widget') {
      return routeStudyId;
    }

    return resolveConfigKey(routeStudyId, globalConfig);
  }, [globalConfig, routeStudyId]);
  const isValidStudyId = routeStudyId === '__revisit-widget' || canonicalStudyId !== null;

  useEffect(() => {
    if (routeStudyId !== '__revisit-widget') {
      getStudyConfig(routeStudyId, globalConfig).then((config) => {
        setActiveConfig(config);
      });
      return () => { };
    }
    if (globalConfig && routeStudyId) {
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
  }, [globalConfig, routeStudyId]);

  const [routes, setRoutes] = useState<RouteObject[]>([]);
  const [store, setStore] = useState<Nullable<StudyStore>>(null);
  const { storageEngine } = useStorageEngine();
  const [searchParams] = useSearchParams();

  const participantId = useMemo(() => searchParams.get('participantId'), [searchParams]);
  const studyCondition = useMemo(() => parseConditionParam(searchParams.get('condition')), [searchParams]);

  useEffect(() => {
    async function initializeUserStoreRouting() {
      // Check that we have a storage engine and active config (studyId is set for config, but typescript complains)
      if (!storageEngine || !activeConfig || !canonicalStudyId) return;

      let modes: Record<REVISIT_MODE, boolean> | null = null;
      let storageOperationFailed = false;
      const urlParticipantId = activeConfig.uiConfig.urlParticipantIdParam
        ? searchParams.get(activeConfig.uiConfig.urlParticipantIdParam)
        || undefined
        : undefined;
      try {
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
            orientation: getScreenOrientationType(window.screen),
            pixelDepth: window.screen.pixelDepth,
          },
          ip: ip.ip,
        };

        const activeHash = await hash(JSON.stringify(activeConfig));
        let participantSession!: Awaited<ReturnType<typeof storageEngine.initializeParticipantSession>>;
        let participantConfig = activeConfig;
        try {
          // Make sure that we have a study database and that the study database has a sequence array
          await storageEngine.initializeStudyDb(canonicalStudyId);
          await storageEngine.saveConfig(activeConfig);

          const sequenceArray = await storageEngine.getSequenceArray();
          if (!sequenceArray) {
            await storageEngine.setSequenceArray(generateSequenceArray(activeConfig));
          }

          modes = await storageEngine.getModes(canonicalStudyId);
          participantSession = await storageEngine.initializeParticipantSession(
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

          if (participantSession.participantConfigHash !== activeHash) {
            participantConfig = (await storageEngine.getAllConfigsFromHash(
              [participantSession.participantConfigHash],
              canonicalStudyId,
            ))[participantSession.participantConfigHash] as ParsedConfig<StudyConfig>;
          }
        } catch (storageError) {
          storageOperationFailed = true;
          throw storageError;
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
          canonicalStudyId,
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
        const isStorageFailure = isStorageStartupFailure(
          storageEngine,
          import.meta.env.VITE_STORAGE_ENGINE,
          storageOperationFailed,
        );
        const resolvedModes = modes ?? await storageEngine.getModes(canonicalStudyId).catch(() => null);
        const developmentModeEnabledForAlert = resolvedModes?.developmentModeEnabled ?? false;
        const fallbackModes = {
          developmentModeEnabled: resolvedModes?.developmentModeEnabled ?? true,
          dataSharingEnabled: resolvedModes?.dataSharingEnabled ?? true,
          dataCollectionEnabled: false,
        };
        const resumeParticipantId = participantId
          || urlParticipantId
          || await storageEngine.peekCurrentParticipantId(canonicalStudyId);
        const initialAlertModal = !isStorageFailure
          ? getInitialStartupAlert(error, developmentModeEnabledForAlert, resumeParticipantId)
          : undefined;

        // Fallback: initialize the store with empty data
        const generatedSequences = generateSequenceArray(activeConfig);
        const matchingSequence = generatedSequences[0];
        const fallbackSequence = filterSequenceByCondition(
          matchingSequence,
          studyCondition,
        );

        const emptyStore = await studyStoreCreator(
          canonicalStudyId,
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
          fallbackModes,
          '',
          false,
          isStorageFailure,
          false,
          initialAlertModal,
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
  }, [storageEngine, activeConfig, canonicalStudyId, searchParams, participantId, studyCondition]);

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
