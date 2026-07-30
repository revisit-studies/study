import {
  ReactNode,
  useEffect,
  useState,
  useMemo,
  useRef,
} from 'react';
import { Provider } from 'react-redux';
import { RouteObject, useRoutes, useSearchParams } from 'react-router';
import {
  Button, LoadingOverlay, Stack, Text, Title,
} from '@mantine/core';
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
import type { AlertModalState, ParticipantMetadata } from '../store/types';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';
import { ResourceNotFound } from '../ResourceNotFound';
import { encryptIndex } from '../utils/encryptDecryptIndex';
import { parseStudyConfig } from '../parser/parser';
import { hash } from '../storage/engines/utils/storageEngineHelpers';
import type { StorageEngine, REVISIT_MODE } from '../storage/engines/types';
import {
  filterSequenceByCondition,
  parseConditionParam,
  resolveParticipantConditions,
} from '../utils/handleConditionLogic';
import { StartupErrorScreen } from './StartupErrorScreen';
import { StartupInteractionProvider } from './StartupContext';

type StartupStorageStatus = Pick<StorageEngine, 'getEngine' | 'isConnected'>;
type StartupPhase = 'config-loading' | 'participant-loading' | 'ready' | 'error';

const GENERIC_STARTUP_ERROR = 'There was a problem loading the study.';
const RESUME_STARTUP_ERROR = 'This study session could not be resumed.';
const STUDY_LOADING_MESSAGE = 'Loading your study. This may take a moment.';
const STUDY_LOADING_MESSAGE_DELAY_MS = 1500;

export function StudyLoadingOverlay({ visible }: { visible: boolean }) {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowMessage(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShowMessage(true);
    }, STUDY_LOADING_MESSAGE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [visible]);

  return (
    <>
      {visible && (
        <div
          data-testid="study-loading-barrier"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            pointerEvents: 'all',
          }}
        >
          <LoadingOverlay visible />
        </div>
      )}
      {visible && showMessage && (
        <Text
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'fixed',
            top: 'calc(50% + 40px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1001,
            width: 'calc(100% - 32px)',
            maxWidth: 420,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {STUDY_LOADING_MESSAGE}
        </Text>
      )}
    </>
  );
}

export function getScreenOrientationType(screen: Screen) {
  return screen.orientation?.type ?? '';
}

export function isStorageStartupFailure(
  storageEngine: StartupStorageStatus,
  configuredEngine: string,
) {
  return !storageEngine.isConnected() || storageEngine.getEngine() !== configuredEngine;
}

export function getStartupErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return GENERIC_STARTUP_ERROR;
}

export function getInitialStartupAlert(
  error: unknown,
  developmentModeEnabled: boolean,
  resumeParticipantId?: string | null,
): AlertModalState {
  return {
    show: true,
    title: 'Problem loading the study',
    message: developmentModeEnabled
      ? getStartupErrorMessage(error)
      : (resumeParticipantId ? RESUME_STARTUP_ERROR : GENERIC_STARTUP_ERROR),
  };
}

export function getShellUiState({
  isValidStudyId,
  hasRoutes,
  hasStore,
  isCompletionCheckResolved,
  completionCheckError,
}: {
  isValidStudyId: boolean;
  hasRoutes: boolean;
  hasStore: boolean;
  isCompletionCheckResolved: boolean;
  completionCheckError: string | null;
}) {
  return {
    isLoading: isValidStudyId && (!hasRoutes || !hasStore || !isCompletionCheckResolved),
    showCompletionCheckError: completionCheckError !== null,
  };
}

function createParticipantMetadata(ip: string = ''): ParticipantMetadata {
  return {
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
    ip,
  };
}

function createEmptyParticipantMetadata(): ParticipantMetadata {
  return {
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
  };
}

export function Shell({ globalConfig }: { globalConfig: GlobalConfig }) {
  // Pull study config
  const routeStudyId = useStudyId();
  const [activeConfig, setActiveConfig] = useState<ParsedConfig<StudyConfig> | null>(null);
  const [startupError, setStartupError] = useState<{
    error: unknown;
    retryParticipantStartup?: boolean;
  } | null>(null);
  const [startupPhase, setStartupPhase] = useState<StartupPhase>('config-loading');
  const canonicalStudyId = useMemo(() => {
    if (routeStudyId === '__revisit-widget') {
      return routeStudyId;
    }

    return resolveConfigKey(routeStudyId, globalConfig);
  }, [globalConfig, routeStudyId]);
  const isValidStudyId = routeStudyId === '__revisit-widget' || canonicalStudyId !== null;

  useEffect(() => {
    let cancelled = false;

    if (routeStudyId !== '__revisit-widget') {
      const loadStudyConfig = async () => {
        try {
          const config = await getStudyConfig(routeStudyId, globalConfig);
          if (!cancelled) {
            setActiveConfig(config);
            setStartupPhase('participant-loading');
          }
        } catch (error) {
          console.error('Error loading study config:', error);
          if (!cancelled) {
            setStartupError({ error });
            setStartupPhase('error');
          }
        }
      };

      loadStudyConfig();
      return () => {
        cancelled = true;
      };
    }

    if (globalConfig && routeStudyId) {
      const messageListener = (event: MessageEvent) => {
        if (event.data.type === 'revisitWidget/CONFIG') {
          const loadWidgetConfig = async () => {
            try {
              const config = await parseStudyConfig(event.data.payload);
              if (!cancelled) {
                setActiveConfig(config);
                setStartupPhase('participant-loading');
              }

              const sequenceArray = await generateSequenceArray(config);
              if (!cancelled) {
                window.parent.postMessage({ type: 'revisitWidget/SEQUENCE_ARRAY', payload: sequenceArray }, '*');
              }
            } catch (error) {
              console.error('Error loading widget study config:', error);
              if (!cancelled) {
                setStartupError({ error });
                setStartupPhase('error');
              }
            }
          };

          loadWidgetConfig();
        }
      };

      window.addEventListener('message', messageListener);

      window.parent.postMessage({ type: 'revisitWidget/READY' }, '*');

      return () => {
        cancelled = true;
        window.removeEventListener('message', messageListener);
      };
    }

    return undefined;
  }, [globalConfig, routeStudyId]);

  const [routes, setRoutes] = useState<RouteObject[]>([]);
  const [previewStore, setPreviewStore] = useState<Nullable<StudyStore>>(null);
  const [store, setStore] = useState<Nullable<StudyStore>>(null);
  const [isCompletionCheckResolved, setIsCompletionCheckResolved] = useState(false);
  const [completionCheckError, setCompletionCheckError] = useState<string | null>(null);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const initializationKeyRef = useRef<string | null>(null);
  const interfaceRef = useRef<HTMLDivElement>(null);
  const { storageEngine } = useStorageEngine();
  const [rawSearchParams] = useSearchParams();

  const searchParamsString = rawSearchParams.toString();
  const searchParams = useMemo(
    () => new URLSearchParams(searchParamsString),
    [searchParamsString],
  );
  const participantId = useMemo(
    () => searchParams.get('participantId'),
    [searchParams],
  );
  const studyCondition = useMemo(
    () => parseConditionParam(searchParams.get('condition')),
    [searchParams],
  );

  useEffect(() => {
    let isCancelled = false;

    async function initializePreviewStore() {
      if (!activeConfig || !canonicalStudyId || (activeConfig.errors?.length ?? 0) > 0) {
        return;
      }

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
              element: <ComponentController />,
            },
          ],
        },
      ]);

      const generatedSequences = await generateSequenceArray(activeConfig);
      const generatedSequence = filterSequenceByCondition(
        generatedSequences[0],
        studyCondition,
      );
      const localPreviewStore = await studyStoreCreator(
        canonicalStudyId,
        activeConfig,
        generatedSequence,
        createEmptyParticipantMetadata(),
        {},
        {
          developmentModeEnabled: false,
          dataSharingEnabled: false,
          dataCollectionEnabled: false,
        },
        '',
        true,
        false,
      );

      if (!isCancelled) {
        setPreviewStore(localPreviewStore);
      }
    }

    initializePreviewStore().catch((error) => {
      console.error('Error initializing preview study store:', error);
      if (!isCancelled) {
        setStartupError({ error });
        setStartupPhase('error');
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [activeConfig, canonicalStudyId, studyCondition]);

  useEffect(() => {
    const startupKey = storageEngine && activeConfig && canonicalStudyId
      ? [
        canonicalStudyId,
        participantId ?? '',
        searchParamsString,
        startupAttempt,
      ].join(':')
      : null;

    if (!startupKey || initializationKeyRef.current === startupKey) {
      return undefined;
    }
    initializationKeyRef.current = startupKey;

    const isCurrentStartup = () => initializationKeyRef.current === startupKey;

    async function fetchParticipantIp() {
      const ipTimeoutController = new AbortController();
      const ipTimeoutId = window.setTimeout(() => ipTimeoutController.abort(), 1200);

      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', {
          signal: ipTimeoutController.signal,
        }).catch(() => '');

        return ipRes instanceof Response ? await ipRes.json() as { ip: string } : { ip: '' };
      } finally {
        window.clearTimeout(ipTimeoutId);
      }
    }

    async function initializeUserStoreRouting() {
      // Check that we have a storage engine and active config (studyId is set for config, but typescript complains)
      if (!storageEngine || !activeConfig || !canonicalStudyId || (activeConfig.errors?.length ?? 0) > 0) return;
      setIsCompletionCheckResolved(false);
      setCompletionCheckError(null);
      setStartupError(null);
      setStartupPhase('participant-loading');

      let modes: Record<REVISIT_MODE, boolean> | null = null;
      const urlParticipantId = activeConfig.uiConfig.urlParticipantIdParam
        ? searchParams.get(activeConfig.uiConfig.urlParticipantIdParam) ?? undefined
        : undefined;
      try {
        // Make sure that we have a study database and that the study database has a sequence array
        await storageEngine.initializeStudyDb(canonicalStudyId);

        const activeHashPromise = hash(JSON.stringify(activeConfig));

        await storageEngine.saveConfig(activeConfig);

        const sequenceArray = await storageEngine.getSequenceArray();

        if (!sequenceArray) {
          const generatedSequenceArray = await generateSequenceArray(activeConfig);

          await storageEngine.setSequenceArray(generatedSequenceArray);
        }

        // Get or generate participant session
        const searchParamsObject = Object.fromEntries(searchParams.entries());

        const [resolvedModes, activeHash] = await Promise.all([
          storageEngine.getModes(canonicalStudyId),
          activeHashPromise,
        ]);
        modes = resolvedModes;

        const initialMetadata = createParticipantMetadata();

        let participantSession = await storageEngine.initializeParticipantSession(
          searchParamsObject,
          activeConfig,
          initialMetadata,
          participantId || urlParticipantId,
        );

        if (studyCondition.length > 0 && resolvedModes.developmentModeEnabled) {
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
        let participantConfig = activeConfig;
        if (participantSession.participantConfigHash !== activeHash) {
          participantConfig = (await storageEngine.getAllConfigsFromHash(
            [participantSession.participantConfigHash],
            canonicalStudyId,
          ))[participantSession.participantConfigHash] as ParsedConfig<StudyConfig>;
        }

        const resolvedCondition = resolveParticipantConditions({
          urlCondition: studyCondition,
          participantConditions: participantSession.conditions,
          participantSearchParamCondition: participantSession.searchParams?.condition,
          allowUrlOverride: resolvedModes.developmentModeEnabled,
        });
        const filteredParticipantSequence = filterSequenceByCondition(participantSession.sequence, resolvedCondition);

        // Initialize the redux stores
        const newStore = await studyStoreCreator(
          canonicalStudyId,
          participantConfig,
          filteredParticipantSequence,
          participantSession.metadata,
          participantSession.answers,
          resolvedModes,
          participantSession.participantId,
          false,
          false,
          participantSession.participantConfigHash !== activeHash,
        );

        if (!isCurrentStartup()) {
          return;
        }

        setStore(newStore);

        if (resolvedModes.dataCollectionEnabled) {
          fetchParticipantIp().then(async (ip) => {
            if (!isCurrentStartup() || !ip.ip || participantSession.metadata.ip === ip.ip) {
              return;
            }

            const metadataWithIp = createParticipantMetadata(ip.ip);
            participantSession = {
              ...participantSession,
              metadata: metadataWithIp,
            };

            await storageEngine.updateParticipantMetadata(metadataWithIp);

            if (isCurrentStartup()) {
              newStore.store.dispatch(newStore.actions.setMetadata(metadataWithIp));
            }
          }).catch((error) => {
            console.error('Error fetching participant IP:', error);
          });
        }

        if (!resolvedModes.dataCollectionEnabled) {
          setIsCompletionCheckResolved(true);
          setStartupPhase('ready');
        } else {
          storageEngine.getParticipantCompletionStatus(participantSession.participantId).then((participantCompleted) => {
            if (isCurrentStartup()) {
              newStore.store.dispatch(newStore.actions.setParticipantCompleted(participantCompleted));
              setIsCompletionCheckResolved(true);
              setStartupPhase('ready');
            }
          }).catch((error) => {
            console.error('Error fetching participant completion status:', error);
            if (isCurrentStartup()) {
              setCompletionCheckError('We could not verify whether this study session was already completed. Please reload this page and try again.');
              setIsCompletionCheckResolved(true);
            }
          });
        }
      } catch (error) {
        console.error('Error initializing user store routing:', error);
        const isStorageFailure = isStorageStartupFailure(
          storageEngine,
          import.meta.env.VITE_STORAGE_ENGINE,
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
          || await storageEngine.peekCurrentParticipantId(canonicalStudyId).catch(() => undefined);
        const initialAlertModal = !isStorageFailure
          ? getInitialStartupAlert(error, developmentModeEnabledForAlert, resumeParticipantId)
          : undefined;

        try {
          // Preserve the existing disconnected-storage and participant alert recovery paths.
          const generatedSequences = await generateSequenceArray(activeConfig);

          const matchingSequence = generatedSequences[0];
          const fallbackSequence = filterSequenceByCondition(
            matchingSequence,
            studyCondition,
          );

          const emptyStore = await studyStoreCreator(
            canonicalStudyId,
            activeConfig,
            fallbackSequence,
            createEmptyParticipantMetadata(),
            {},
            fallbackModes,
            '',
            false,
            isStorageFailure,
            false,
            initialAlertModal,
          );

          if (!isCurrentStartup()) {
            return;
          }

          setStore(emptyStore);
          setIsCompletionCheckResolved(true);
          setStartupPhase('ready');
        } catch (fallbackError) {
          console.error('Error initializing fallback study store:', fallbackError);
          if (isCurrentStartup()) {
            setStartupError({ error, retryParticipantStartup: true });
            setStartupPhase('error');
          }
        }
      }
    }
    initializeUserStoreRouting().catch((error) => {
      console.error('Unhandled error initializing user store routing:', error);
      if (isCurrentStartup()) {
        setStartupError({ error, retryParticipantStartup: true });
        setStartupPhase('error');
      }
    });
    return undefined;
  }, [
    storageEngine,
    activeConfig,
    canonicalStudyId,
    searchParams,
    searchParamsString,
    participantId,
    studyCondition,
    startupAttempt,
  ]);

  const routing = useRoutes(routes);
  const hasConfigErrors = (activeConfig?.errors?.length ?? 0) > 0;
  const renderedStore = store ?? previewStore;
  const { isLoading, showCompletionCheckError } = getShellUiState({
    isValidStudyId,
    hasRoutes: routes.length > 0,
    hasStore: store !== null,
    isCompletionCheckResolved,
    completionCheckError,
  });
  const isInteractionBlocked = isValidStudyId && !startupError && !hasConfigErrors
    && (startupPhase !== 'ready' || isLoading || showCompletionCheckError);

  useEffect(() => {
    if (isInteractionBlocked) {
      interfaceRef.current?.setAttribute('inert', '');
    } else {
      interfaceRef.current?.removeAttribute('inert');
    }
  }, [isInteractionBlocked]);

  let content: ReactNode = null;

  if (startupError) {
    content = (
      <StartupErrorScreen
        error={startupError.error}
        actionLabel={startupError.retryParticipantStartup ? 'Retry' : 'Reload'}
        onReload={startupError.retryParticipantStartup
          ? () => {
            initializationKeyRef.current = null;
            setStartupPhase('participant-loading');
            setStartupAttempt((attempt) => attempt + 1);
          }
          : undefined}
      />
    );
  } else if (activeConfig && hasConfigErrors) {
    content = (
      <>
        <Title order={2} mb={8}>
          Error loading config
        </Title>
        <ErrorLoadingConfig
          issues={activeConfig.errors}
          type="error"
        />
      </>
    );
  } else if (!isValidStudyId) {
    content = <ResourceNotFound />;
  } else if (routing && renderedStore) {
    const startupStoreKey = store ? 'authoritative' : 'preview';
    content = (
      <StudyStoreContext.Provider key={startupStoreKey} value={renderedStore}>
        <Provider store={renderedStore.store}>{routing}</Provider>
      </StudyStoreContext.Provider>
    );
  } else if (!isLoading) {
    content = <ResourceNotFound />;
  }

  return (
    <>
      <StudyLoadingOverlay visible={isInteractionBlocked} />
      {!startupError && !hasConfigErrors && showCompletionCheckError && (
        <Stack
          align="center"
          gap="sm"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1001,
            maxWidth: 420,
            textAlign: 'center',
          }}
        >
          <Text>{completionCheckError}</Text>
          <Button onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Stack>
      )}
      <div
        ref={interfaceRef}
        data-testid="study-interface"
        aria-busy={isInteractionBlocked}
        aria-hidden={isInteractionBlocked || undefined}
        style={isInteractionBlocked ? { pointerEvents: 'none', userSelect: 'none' } : undefined}
      >
        <StartupInteractionProvider value={isInteractionBlocked}>
          {content}
        </StartupInteractionProvider>
      </div>
    </>
  );
}
