import {
  ReactNode,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { Provider } from 'react-redux';
import { RouteObject, useRoutes, useSearchParams } from 'react-router';
import {
  Anchor, Button, Center, Code, LoadingOverlay, Stack, Text, Title,
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
import type { AlertModalState, ParticipantMetadata, Sequence } from '../store/types';
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
import { getStaticFirstComponent, type StaticFirstComponentPreview } from '../utils/getStaticFirstComponent';
import { StartupPreviewContext } from './StartupPreviewContext';

type StartupStorageStatus = Pick<StorageEngine, 'getEngine' | 'isConnected'>;

const GENERIC_STARTUP_ERROR = 'There was a problem loading the study.';
const RESUME_STARTUP_ERROR = 'This study session could not be resumed.';
const STUDY_LOADING_MESSAGE = 'Loading your study. This may take a moment.';
const STUDY_LOADING_MESSAGE_DELAY_MS = 1500;
const STARTUP_PREVIEW_MODES: Record<REVISIT_MODE, boolean> = {
  dataCollectionEnabled: true,
  developmentModeEnabled: import.meta.env.DEV,
  dataSharingEnabled: false,
};

function getParticipantRoutes(startupPreview = false) {
  return [
    {
      element: <StepRenderer />,
      children: [
        {
          path: '/',
          element: startupPreview
            ? <ComponentController />
            : <NavigateWithParams to={encryptIndex(0)} replace />,
        },
        {
          path: '/:index/:funcIndex?',
          element: <ComponentController />,
        },
      ],
    },
  ];
}

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
      <LoadingOverlay visible={visible} />
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
  hasStageCapacityError = false,
}: {
  isValidStudyId: boolean;
  hasRoutes: boolean;
  hasStore: boolean;
  isCompletionCheckResolved: boolean;
  completionCheckError: string | null;
  hasStageCapacityError?: boolean;
}) {
  return {
    isLoading: isValidStudyId && !hasStageCapacityError && (!hasRoutes || !hasStore || !isCompletionCheckResolved),
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
  const [startupError, setStartupError] = useState<{ error: unknown } | null>(null);
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
          }
        } catch (error) {
          console.error('Error loading study config:', error);
          if (!cancelled) {
            setStartupError({ error });
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
              }

              const sequenceArray = await generateSequenceArray(config);
              if (!cancelled) {
                window.parent.postMessage({ type: 'revisitWidget/SEQUENCE_ARRAY', payload: sequenceArray }, '*');
              }
            } catch (error) {
              console.error('Error loading widget study config:', error);
              if (!cancelled) {
                setStartupError({ error });
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
  const [store, setStore] = useState<Nullable<StudyStore>>(null);
  const [startupPreviewStore, setStartupPreviewStore] = useState<Nullable<StudyStore>>(null);
  const [isCompletionCheckResolved, setIsCompletionCheckResolved] = useState(false);
  const [completionCheckError, setCompletionCheckError] = useState<string | null>(null);
  const [startupPreviewComponent, setStartupPreviewComponent] = useState<StaticFirstComponentPreview | null>(null);
  const { storageEngine } = useStorageEngine();
  const [searchParams] = useSearchParams();

  const participantId = useMemo(() => searchParams.get('participantId'), [searchParams]);
  const studyCondition = useMemo(() => parseConditionParam(searchParams.get('condition')), [searchParams]);
  const urlParticipantId = useMemo(() => (
    activeConfig?.uiConfig.urlParticipantIdParam
      ? searchParams.get(activeConfig.uiConfig.urlParticipantIdParam) ?? undefined
      : undefined
  ), [activeConfig, searchParams]);
  useEffect(() => {
    let cancelled = false;
    setStartupPreviewComponent(null);
    setStartupPreviewStore(null);

    if (!storageEngine || !activeConfig || !canonicalStudyId
      || participantId || urlParticipantId || studyCondition.length > 0
      || (activeConfig.errors?.length ?? 0) > 0) {
      return () => {
        cancelled = true;
      };
    }

    storageEngine.peekCurrentParticipantId(canonicalStudyId).then(async (existingParticipantId) => {
      if (cancelled || existingParticipantId) {
        return;
      }

      const previewComponent = getStaticFirstComponent(activeConfig);
      if (!previewComponent) {
        return;
      }

      const previewSequence: Sequence = {
        id: 'startup-preview',
        orderPath: 'startup-preview',
        order: 'fixed',
        components: [previewComponent.componentName],
        skip: [],
      };
      const previewStore = await studyStoreCreator(
        canonicalStudyId,
        activeConfig,
        previewSequence,
        createEmptyParticipantMetadata(),
        {},
        STARTUP_PREVIEW_MODES,
        '',
        false,
        false,
      );

      if (!cancelled) {
        setStartupPreviewComponent(previewComponent);
        setStartupPreviewStore(previewStore);
        setRoutes(getParticipantRoutes(true));
      }
    }).catch(() => {
      // Startup remains unchanged if preview construction is unavailable.
    });

    return () => {
      cancelled = true;
    };
  }, [storageEngine, activeConfig, canonicalStudyId, participantId, urlParticipantId, studyCondition]);

  useEffect(() => {
    let isCancelled = false;

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
      setStageEntryError(null);

      let modes: Record<REVISIT_MODE, boolean> | null = null;
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
        // Resolve participant-global templates only after loading the participant's persisted
        // sequence, while keeping the canonical config used for hashing unchanged.
        const runtimeConfig = materializeParticipantConfig(
          participantConfig,
          filteredParticipantSequence.parameters || {},
        );
        // Initialize the redux stores
        const newStore = await studyStoreCreator(
          canonicalStudyId,
          runtimeConfig,
          filteredParticipantSequence,
          participantSession.metadata,
          participantSession.answers,
          resolvedModes,
          participantSession.participantId,
          false,
          false,
          participantSession.participantConfigHash !== activeHash,
        );

        if (isCancelled) {
          return;
        }

        setStore(newStore);

        if (resolvedModes.dataCollectionEnabled) {
          fetchParticipantIp().then(async (ip) => {
            if (isCancelled || !ip.ip || participantSession.metadata.ip === ip.ip) {
              return;
            }

            const metadataWithIp = createParticipantMetadata(ip.ip);
            participantSession = {
              ...participantSession,
              metadata: metadataWithIp,
            };

            await storageEngine.updateParticipantMetadata(metadataWithIp);

            if (!isCancelled) {
              newStore.store.dispatch(newStore.actions.setMetadata(metadataWithIp));
            }
          }).catch((error) => {
            console.error('Error fetching participant IP:', error);
          });
        }

        if (!resolvedModes.dataCollectionEnabled) {
          setIsCompletionCheckResolved(true);
        } else {
          storageEngine.getParticipantCompletionStatus(participantSession.participantId).then((participantCompleted) => {
            if (!isCancelled) {
              newStore.store.dispatch(newStore.actions.setParticipantCompleted(participantCompleted));
              setIsCompletionCheckResolved(true);
            }
          }).catch((error) => {
            console.error('Error fetching participant completion status:', error);
            if (!isCancelled) {
              setCompletionCheckError('We could not verify whether this study session was already completed. Please reload this page and try again.');
              // A transient completion-status lookup failure should not block study entry.
              setIsCompletionCheckResolved(true);
            }
          });
        }
      } catch (error) {
        console.error('Error initializing user store routing:', error);
        if (
          error instanceof StageCapacityExceededError
          || error instanceof StageNoAvailableConditionsError
          || error instanceof StageOnlyDisabledConditionsHaveCapacityError
        ) {
          if (!isCancelled) {
            setStageEntryError(error);
            setIsCompletionCheckResolved(true);
          }
          return;
        }
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
          const fallbackConfig = materializeParticipantConfig(
            activeConfig,
            fallbackSequence.parameters || {},
          );

          const emptyStore = await studyStoreCreator(
            canonicalStudyId,
            fallbackConfig,
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

          if (isCancelled) {
            return;
          }

          setStore(emptyStore);
          setIsCompletionCheckResolved(true);
        } catch (fallbackError) {
          console.error('Error initializing fallback study store:', fallbackError);
          if (!isCancelled) {
            setStartupError({ error });
          }
          return;
        }
      }

      if (isCancelled) {
        return;
      }

      // Initialize the routing
      setRoutes(getParticipantRoutes());
    }
    initializeUserStoreRouting().catch((error) => {
      console.error('Unhandled error initializing user store routing:', error);
      if (!isCancelled) {
        setStartupError({ error });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [storageEngine, activeConfig, canonicalStudyId, searchParams, participantId, urlParticipantId, studyCondition]);

  const routing = useRoutes(routes);
  const hasConfigErrors = (activeConfig?.errors?.length ?? 0) > 0;
  const { isLoading, showCompletionCheckError } = getShellUiState({
    isValidStudyId,
    hasRoutes: routes.length > 0,
    hasStore: store !== null,
    isCompletionCheckResolved,
    completionCheckError,
    hasStageCapacityError: stageEntryError !== null,
  });
  const hasStartupPreview = startupPreviewComponent !== null && startupPreviewStore !== null && store === null;
  const activeStore = store ?? startupPreviewStore;
  const hasRenderableStudy = routing !== null && activeStore !== null;

  let content: ReactNode = null;

  if (startupError) {
    content = <StartupErrorScreen error={startupError.error} />;
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
  } else if (routing && activeStore) {
    content = (
      <StudyStoreContext.Provider key={hasStartupPreview ? 'startup-preview' : 'participant-session'} value={activeStore}>
        <StartupPreviewContext.Provider value={hasStartupPreview}>
          <Provider store={activeStore.store}>{routing}</Provider>
        </StartupPreviewContext.Provider>
      </StudyStoreContext.Provider>
    );
  } else if (!isLoading) {
    content = <ResourceNotFound />;
  }

  return (
    <>
      <StudyLoadingOverlay visible={!startupError && !hasConfigErrors && isLoading && !hasRenderableStudy} />
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
      {content}
    </>
  );
}
