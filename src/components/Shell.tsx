import {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useRef,
} from 'react';
import { Provider } from 'react-redux';
import { RouteObject, useRoutes, useSearchParams } from 'react-router';
import {
  Anchor, Center, Code, Loader, LoadingOverlay, Paper, Stack, Text, Title,
} from '@mantine/core';
import { GLOBAL_STORE_TASK } from '../store/globalStoreProvenance';
import { projectHistoricalGlobalStore } from '../store/globalStoreHistory';
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
import { getComponent } from '../utils/handleComponentInheritance';
import { PREFIX } from '../utils/Prefix';
import { StudyRouteGuard } from '../routes/StudyRouteGuard';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { generateSequenceArray } from '../utils/handleRandomSequences';
import { getStudyConfig, resolveConfigKey } from '../utils/fetchConfig';
import type { AlertModalState, ParticipantMetadata } from '../store/types';
import { ErrorLoadingConfig } from './ErrorLoadingConfig';
import { ResourceNotFound } from '../ResourceNotFound';
import { encryptIndex } from '../utils/encryptDecryptIndex';
import { parseStudyConfig } from '../parser/parser';
import { hash } from '../storage/engines/utils/storageEngineHelpers';
import {
  StageCapacityExceededError,
  StageNoAvailableConditionsError,
  StageOnlyDisabledConditionsHaveCapacityError,
  type StorageEngine,
  type REVISIT_MODE,
} from '../storage/engines/types';
import {
  filterSequenceByCondition,
  parseConditionParam,
  resolveParticipantConditions,
} from '../utils/handleConditionLogic';
import { StartupErrorScreen } from './StartupErrorScreen';
import { materializeParticipantConfig } from '../parser/libraryParser';
import { useStudyColorMode } from './AppThemeProvider';
import {
  StartupInteractionProvider,
  useStudyStorageReady,
} from './StartupContext';

type StartupStorageStatus = Pick<StorageEngine, 'getEngine' | 'isConnected'>;
type StartupPhase = 'config-loading' | 'participant-loading' | 'ready' | 'error';

const GENERIC_STARTUP_ERROR = 'There was a problem loading the study.';
const RESUME_STARTUP_ERROR = 'This study session could not be resumed.';
const STUDY_LOADING_MESSAGE = 'Loading your study. This may take a moment.';
const STUDY_LOADING_MESSAGE_DELAY_MS = 1500;
export function StudyLoadingOverlay({
  visible,
  showMessage = true,
}: {
  visible: boolean;
  showMessage?: boolean;
}) {
  const [showDelayedMessage, setShowDelayedMessage] = useState(false);

  useEffect(() => {
    if (!visible || !showMessage) {
      setShowDelayedMessage(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShowDelayedMessage(true);
    }, STUDY_LOADING_MESSAGE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [showMessage, visible]);

  return visible ? (
    <div
      data-testid="study-loading-barrier"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="polite"
      aria-label={STUDY_LOADING_MESSAGE}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        pointerEvents: 'all',
      }}
    >
      <LoadingOverlay
        visible
        loaderProps={{
          style: { width: 'min(420px, calc(100vw - 32px))', height: 'auto' },
          children: (
            <Paper p="xl" radius="md" shadow="md" withBorder bg="var(--mantine-color-body)" c="var(--mantine-color-text)">
              <Stack align="center" gap="md">
                <Loader />
                {showMessage && showDelayedMessage && (
                  <Text role="status" aria-live="polite" aria-atomic="true" ta="center">
                    {STUDY_LOADING_MESSAGE}
                  </Text>
                )}
              </Stack>
            </Paper>
          ),
        }}
      />
    </div>
  ) : null;
}

function StudyAssetPrefetch({ config }: { config: StudyConfig }) {
  const first = config.sequence.order === 'fixed' ? config.sequence.components[0] : undefined;
  const component = typeof first === 'string' ? getComponent(first, config) : null;
  if (!component || (component.type !== 'markdown' && component.type !== 'image') || component.path.includes('{{')) {
    return null;
  }
  const href = component.path.startsWith('http') ? component.path : `${PREFIX}${component.path}`;
  return <link rel="prefetch" as={component.type === 'image' ? 'image' : 'fetch'} href={href} crossOrigin={component.type === 'markdown' ? 'anonymous' : undefined} />;
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
  let message = '';
  if (error instanceof Error) {
    message = error.message.trim();
  } else if (typeof error === 'string') {
    message = error.trim();
  }
  if (!message) return GENERIC_STARTUP_ERROR;

  if (message.toLowerCase().includes('query requires an index')) {
    return `${message}\n\nCreating this index is a one-time setup for this Firebase project/database; it does not need to be repeated for each study. It must be completed by the study owner (Study Designer) who administers the Firebase deployment.`;
  }

  return message;
}

export function getInitialStartupAlert(
  error: unknown,
  developmentModeEnabled: boolean,
  resumeParticipantId?: string | null,
): AlertModalState {
  const message = getStartupErrorMessage(error);
  // Keep index failures blocking even when participant-facing details are redacted.
  const isIndexError = message.toLowerCase().includes('query requires an index');
  return {
    show: true,
    title: isIndexError ? 'Failed to connect to the storage engine' : 'Problem loading the study',
    message: developmentModeEnabled
      ? message
      : (resumeParticipantId ? RESUME_STARTUP_ERROR : GENERIC_STARTUP_ERROR),
  };
}

export function getShellUiState({
  isValidStudyId,
  hasRoutes,
  hasStore,
  isCompletionCheckResolved,
  hasStageCapacityError = false,
}: {
  isValidStudyId: boolean;
  hasRoutes: boolean;
  hasStore: boolean;
  isCompletionCheckResolved: boolean;
  hasStageCapacityError?: boolean;
}) {
  return {
    isLoading: isValidStudyId && !hasStageCapacityError && (!hasRoutes || !hasStore || !isCompletionCheckResolved),
    showLoadingMessage: isValidStudyId && !hasStageCapacityError && (!hasRoutes || !hasStore),
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
function StudyShell({ globalConfig }: { globalConfig: GlobalConfig }) {
  // Capture the system preference once, independently of saved app theme toggles.
  const [initialSystemColorMode] = useState<'light' | 'dark'>(() => (
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  ));
  // Pull study config
  const routeStudyId = useStudyId();
  const [activeConfig, setActiveConfig] = useState<ParsedConfig<StudyConfig> | null>(null);
  const [startupError, setStartupError] = useState<{
    error: unknown;
    retryParticipantStartup?: boolean;
  } | null>(null);
  const [startupPhase, setStartupPhase] = useState<StartupPhase>('config-loading');
  const [stageEntryError, setStageEntryError] = useState<
    StageCapacityExceededError | StageNoAvailableConditionsError | StageOnlyDisabledConditionsHaveCapacityError | null
  >(null);
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

              const sequenceArray = await generateSequenceArray(config, config.warnings);
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
  const [startupAttempt, setStartupAttempt] = useState(0);
  const initializationRef = useRef<{
    key: string;
    config: ParsedConfig<StudyConfig>;
    storageEngine: StorageEngine;
  } | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const interfaceRef = useRef<HTMLDivElement>(null);
  const { storageEngine, configuredStorageEngine } = useStorageEngine();
  const studyStorageReady = useStudyStorageReady();
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
  const urlParticipantId = useMemo(() => (
    activeConfig?.uiConfig?.urlParticipantIdParam
      ? searchParams.get(activeConfig.uiConfig.urlParticipantIdParam) ?? undefined
      : undefined
  ), [activeConfig, searchParams]);

  useEffect(() => {
    let isCancelled = false;

    async function initializePreviewStore() {
      if (!activeConfig || !canonicalStudyId || (activeConfig.errors?.length ?? 0) > 0) {
        return;
      }

      setRoutes([
        {
          element: <StudyRouteGuard><StepRenderer /></StudyRouteGuard>,
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

      const previewSequence = {
        order: 'fixed' as const, components: [], skip: [], orderPath: 'root',
      };
      const previewConfig = {
        ...activeConfig, components: {}, globalVariables: undefined, sequence: { order: 'fixed' as const, components: [] },
      };
      const localPreviewStore = await studyStoreCreator(
        canonicalStudyId,
        previewConfig,
        previewSequence,
        {
          ...createEmptyParticipantMetadata(),
          colorMode: activeConfig.uiConfig.colorMode === 'userPreference'
            ? initialSystemColorMode : activeConfig.uiConfig.colorMode ?? 'light',
        },
        {},
        {
          developmentModeEnabled: false,
          dataSharingEnabled: false,
          dataCollectionEnabled: false,
        },
        '',
        false,
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
  }, [activeConfig, canonicalStudyId, initialSystemColorMode, studyCondition]);

  const startupKey = storageEngine && activeConfig && canonicalStudyId
    ? [
      canonicalStudyId,
      participantId ?? '',
      searchParamsString,
      startupAttempt,
    ].join(':')
    : null;

  useEffect(() => {
    if (!studyStorageReady) {
      initializationRef.current = null;
      return undefined;
    }

    if (!startupKey || !activeConfig || !storageEngine || (
      initializationRef.current?.key === startupKey
      && initializationRef.current.config === activeConfig
      && initializationRef.current.storageEngine === storageEngine
    )) {
      return undefined;
    }
    const initialization = { key: startupKey, config: activeConfig, storageEngine };
    initializationRef.current = initialization;

    const isCurrentStartup = () => mountedRef.current
      && initializationRef.current === initialization;

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
      setStore(null);
      setIsCompletionCheckResolved(false);
      setStageEntryError(null);
      setStartupError(null);
      setStartupPhase('participant-loading');

      let modes: Record<REVISIT_MODE, boolean> | null = null;
      const initialColorMode = activeConfig.uiConfig.colorMode === 'userPreference'
        ? initialSystemColorMode : activeConfig.uiConfig.colorMode ?? 'light';
      try {
        // Make sure that we have a study database and that the study database has a sequence array
        await storageEngine.initializeStudyDb(canonicalStudyId);
        if (!isCurrentStartup()) return;

        const activeHashPromise = hash(JSON.stringify(activeConfig));

        await storageEngine.saveConfig(activeConfig);
        if (!isCurrentStartup()) return;

        const activeHash = await activeHashPromise;
        const sequenceArray = await storageEngine.getOrCreateSequenceArray(
          activeHash,
          () => generateSequenceArray(activeConfig, activeConfig.warnings),
        );
        if (!isCurrentStartup()) return;

        // Get or generate participant session
        const searchParamsObject = Object.fromEntries(searchParams.entries());

        const resolvedModes = await storageEngine.getModes(canonicalStudyId);
        if (!isCurrentStartup()) return;
        modes = resolvedModes;

        const initialMetadata: ParticipantMetadata = {
          ...createParticipantMetadata(),
          colorMode: initialColorMode,
        };

        let participantSession = await storageEngine.initializeParticipantSession(
          searchParamsObject,
          activeConfig,
          initialMetadata,
          participantId || urlParticipantId,
          { modesDocument: resolvedModes, sequenceArray },
        );

        if (!isCurrentStartup()) return;

        if (studyCondition.length > 0 && resolvedModes.developmentModeEnabled) {
          const updatedSearchParams = {
            ...participantSession.searchParams,
            condition: studyCondition.join(','),
          };
          await storageEngine.updateParticipantSearchParams(updatedSearchParams);
          if (!isCurrentStartup()) return;
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
        // Resolve participant-global templates only after loading the participant's persisted
        // sequence, while keeping the canonical config used for hashing unchanged.
        const runtimeConfig = materializeParticipantConfig(
          participantConfig,
          filteredParticipantSequence.parameters || {},
        );
        const globalProvenance = participantSession.globalStoreHead
          ? await storageEngine.getProvenance(GLOBAL_STORE_TASK, participantSession.participantId, true) : null;
        let globalGraph = globalProvenance?.globalStore;
        let projectedAnswers = participantSession.answers;
        if (participantSession.globalStoreHead && (!globalGraph || !globalGraph.nodes[participantSession.globalStoreHead])) {
          throw new Error('The accepted global store history could not be restored. Please reconnect and reload.');
        }
        if (globalGraph && participantSession.globalStoreHead) globalGraph.current = participantSession.globalStoreHead as typeof globalGraph.current;
        const historicalNode = searchParams.has('participantId') ? searchParams.get('globalStoreNode') : null;
        if (globalGraph && historicalNode) {
          const historical = projectHistoricalGlobalStore(globalGraph, historicalNode, participantSession.answers);
          globalGraph = historical.graph;
          projectedAnswers = historical.answers;
        }
        // Initialize the redux stores
        const newStore = await studyStoreCreator(
          canonicalStudyId,
          runtimeConfig,
          filteredParticipantSequence,
          participantSession.metadata,
          projectedAnswers,
          resolvedModes,
          participantSession.participantId,
          !!participantSession.finalized,
          false,
          participantSession.participantConfigHash !== activeHash,
          undefined,
          globalGraph,
          participantSession.globalStoreRevision,
        );

        if (!isCurrentStartup()) {
          return;
        }

        const finishStartup = (participantCompleted: boolean) => {
          newStore.store.dispatch(newStore.actions.setParticipantCompleted(participantCompleted));
          setStore(newStore);
          setIsCompletionCheckResolved(true);
          setStartupPhase('ready');

          if (!resolvedModes.dataCollectionEnabled || searchParams.has('participantId')) {
            return;
          }
          fetchParticipantIp().then(async (ip) => {
            if (!isCurrentStartup() || !ip.ip || participantSession.metadata.ip === ip.ip) {
              return;
            }

            const metadataWithIp = { ...participantSession.metadata, ip: ip.ip };
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
        };

        if (!resolvedModes.dataCollectionEnabled) {
          finishStartup(!!participantSession.finalized);
        } else {
          storageEngine.getParticipantCompletionStatus(participantSession.participantId).then((participantCompleted) => {
            if (isCurrentStartup()) {
              finishStartup(participantCompleted || !!participantSession.finalized);
            }
          }).catch((error) => {
            console.error('Error fetching participant completion status:', error);
            if (isCurrentStartup()) {
              setStartupError({ error, retryParticipantStartup: true });
              setStartupPhase('error');
            }
          });
        }
      } catch (error) {
        if (!isCurrentStartup()) return;
        console.error('Error initializing user store routing:', error);
        if (
          error instanceof StageCapacityExceededError
          || error instanceof StageNoAvailableConditionsError
          || error instanceof StageOnlyDisabledConditionsHaveCapacityError
        ) {
          if (isCurrentStartup()) {
            setStageEntryError(error);
            setIsCompletionCheckResolved(true);
          }
          return;
        }
        const isStorageFailure = isStorageStartupFailure(
          storageEngine,
          storageEngine !== configuredStorageEngine && configuredStorageEngine
            ? storageEngine.getEngine() : import.meta.env.VITE_STORAGE_ENGINE,
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

        if (!isStorageFailure && initialAlertModal?.title !== 'Failed to connect to the storage engine') {
          if (isCurrentStartup()) {
            setStartupError({ error, retryParticipantStartup: true });
            setStartupPhase('error');
          }
          return;
        }

        try {
          // Preserve the existing disconnected-storage and participant alert recovery paths.
          const generatedSequences = await generateSequenceArray(activeConfig, activeConfig.warnings);

          const matchingSequence = generatedSequences[0];
          const fallbackSequence = filterSequenceByCondition(
            matchingSequence,
            studyCondition,
          );
          const fallbackConfig = materializeParticipantConfig(
            activeConfig,
            fallbackSequence.parameters || {},
          );

          const emptyStore = await studyStoreCreator(
            canonicalStudyId,
            fallbackConfig,
            fallbackSequence,
            { ...createEmptyParticipantMetadata(), colorMode: initialColorMode },
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
    configuredStorageEngine,
    urlParticipantId,
    initialSystemColorMode,
    activeConfig,
    canonicalStudyId,
    searchParams,
    searchParamsString,
    participantId,
    studyCondition,
    startupAttempt,
    startupKey,
    studyStorageReady,
  ]);

  const routing = useRoutes(routes);
  const participantState = store?.store.getState();
  const loadingColorMode = activeConfig?.uiConfig?.colorMode === 'userPreference'
    ? initialSystemColorMode : activeConfig?.uiConfig?.colorMode;
  const studyColorMode = participantState
    ? participantState.metadata.colorMode ?? (participantState.config.uiConfig.colorMode === 'dark' ? 'dark' : 'light')
    : loadingColorMode;
  useStudyColorMode(studyColorMode);
  const hasConfigErrors = (activeConfig?.errors?.length ?? 0) > 0;
  const { isLoading, showLoadingMessage } = getShellUiState({
    isValidStudyId,
    hasRoutes: routes.length > 0,
    hasStore: store !== null,
    isCompletionCheckResolved,
    hasStageCapacityError: stageEntryError !== null,
  });
  const isInteractionBlocked = isValidStudyId && !startupError && !hasConfigErrors && !stageEntryError
    && (!studyStorageReady
      || initializationRef.current?.key !== startupKey
      || initializationRef.current?.config !== activeConfig
      || initializationRef.current?.storageEngine !== storageEngine
      || startupPhase !== 'ready' || isLoading);
  const renderedStore = isInteractionBlocked ? previewStore : store ?? previewStore;

  useLayoutEffect(() => {
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
            initializationRef.current = null;
            setStartupPhase('participant-loading');
            setStartupAttempt((attempt) => attempt + 1);
          }
          : undefined}
      />
    );
  } else if (stageEntryError) {
    content = (
      <Center style={{ height: '80vh', flexDirection: 'column', textAlign: 'center' }}>
        <Title order={2}>Study full</Title>
        <Text mt="md">
          {stageEntryError instanceof StageCapacityExceededError ? (
            <>
              Sorry, no more participants can join the
              {' '}
              {stageEntryError.stageName}
              {' '}
              stage at this time.
            </>
          ) : (
            <>Sorry, this study is full and cannot accept more participants at this time.</>
          )}
        </Text>
        {!(stageEntryError instanceof StageCapacityExceededError) && (
          <>
            <Text mt="md">
              Please email
              {' '}
              <Anchor href={`mailto:${activeConfig?.uiConfig.contactEmail}`}>
                {activeConfig?.uiConfig.contactEmail}
              </Anchor>
              {' '}
              if you think you are seeing this page in error, and include the following details:
            </Text>
            <Code block mt="sm" maw={700} ta="left">{`Study ID: ${canonicalStudyId}\nURL: ${window.location.href}\nParticipant ID: ${participantId || urlParticipantId || 'Not assigned'}\nTimestamp (UTC): ${new Date().toISOString()}\nStorage Engine: ${import.meta.env.VITE_STORAGE_ENGINE}\nUser Agent: ${navigator.userAgent}\nResolution: ${JSON.stringify(createParticipantMetadata().resolution, null, 2)}\nIP: Unavailable\nLanguage: ${navigator.language}`}</Code>
          </>
        )}
      </Center>
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
    const startupStoreKey = renderedStore === store ? 'authoritative' : 'preview';
    content = (
      <StudyStoreContext.Provider key={startupStoreKey} value={renderedStore}>
        <Provider key={searchParams.has('participantId') ? renderedStore.store.getState().globalStoreGraph?.current : undefined} store={renderedStore.store}>{routing}</Provider>
      </StudyStoreContext.Provider>
    );
  } else if (!isLoading) {
    content = <ResourceNotFound email={activeConfig?.uiConfig.contactEmail} />;
  }

  return (
    <>
      {isInteractionBlocked && activeConfig && <StudyAssetPrefetch config={activeConfig} />}
      <StudyLoadingOverlay visible={isInteractionBlocked} showMessage={showLoadingMessage} />
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

export function Shell({ globalConfig }: { globalConfig: GlobalConfig }) {
  const studyId = useStudyId();
  const [searchParams] = useSearchParams();
  // A new study or replay participant must not retain the previous participant's store.
  return <StudyShell key={`${studyId}:${searchParams.get('participantId') ?? ''}`} globalConfig={globalConfig} />;
}
