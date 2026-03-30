import {
  Button, Center, Flex, Group, Loader, Space, Text,
} from '@mantine/core';
import {
  useEffect, useState, useCallback, useMemo, useRef,
} from 'react';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { ReactMarkdownWrapper } from './ReactMarkdownWrapper';
import { useDisableBrowserBack } from '../utils/useDisableBrowserBack';
import { useStorageEngine } from '../storage/storageEngineHooks';
import { ParticipantData } from '../storage/types';
import { download } from './downloader/DownloadTidy';
import { useStudyId } from '../routes/utils';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { useStoreDispatch, useStoreActions } from '../store/store';
import {
  createStudyEndFinalizeLoop,
  DEFAULT_STUDY_END_FINALIZE_STATE,
  StudyEndFinalizeLoopState,
} from './StudyEnd.utils';

export function StudyEnd() {
  const studyConfig = useStudyConfig();
  const { storageEngine } = useStorageEngine();
  const dispatch = useStoreDispatch();
  const { setParticipantCompleted } = useStoreActions();

  const isAnalysis = useIsAnalysis();

  const [completed, setCompleted] = useState(false);
  const [finalizeState, setFinalizeState] = useState<StudyEndFinalizeLoopState>(DEFAULT_STUDY_END_FINALIZE_STATE);
  const storageEngineRef = useRef(storageEngine);
  const finalizeLoopRef = useRef<ReturnType<typeof createStudyEndFinalizeLoop> | null>(null);

  useEffect(() => {
    storageEngineRef.current = storageEngine;
  }, [storageEngine]);

  useEffect(() => {
    // Don't save to the storage engine in analysis
    if (!isAnalysis) {
      const finalizeLoop = createStudyEndFinalizeLoop({
        getStorageEngine: () => storageEngineRef.current,
        onComplete: () => {
          setFinalizeState(DEFAULT_STUDY_END_FINALIZE_STATE);
          setCompleted(true);
          dispatch(setParticipantCompleted(true));
        },
        onStateChange: setFinalizeState,
        onUnexpectedError: (error) => {
          console.error('An error occurred while verifying completion', error);
        },
      });

      finalizeLoopRef.current = finalizeLoop;
      finalizeLoop.start();

      return () => {
        finalizeLoopRef.current = null;
        finalizeLoop.cancel();
      };
    }

    setCompleted(true);
    dispatch(setParticipantCompleted(true));
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Disable browser back button on study end
  useDisableBrowserBack();

  const [participantData, setParticipantData] = useState<ParticipantData | null>();
  const [participantId, setParticipantId] = useState('');
  const baseFilename = studyConfig.studyMetadata.title.replace(' ', '_');

  const refreshParticipantData = useCallback(async () => {
    if (storageEngine) {
      const participantDataSnapshot = storageEngine.getCurrentParticipantDataSnapshot();
      const [_participantId, _participantData] = await Promise.all([
        storageEngine.getCurrentParticipantId(),
        participantDataSnapshot ? Promise.resolve(participantDataSnapshot) : storageEngine.getParticipantData(),
      ]);

      setParticipantId(_participantId);
      setParticipantData(_participantData);
      return {
        participantId: _participantId,
        participantData: _participantData,
      };
    }

    return {
      participantId: '',
      participantData: null,
    };
  }, [storageEngine]);

  useEffect(() => {
    refreshParticipantData();
  }, [refreshParticipantData]);

  const downloadParticipant = useCallback(async () => {
    const latestParticipant = await refreshParticipantData();
    const participantDataToDownload = latestParticipant.participantData || participantData;
    const participantIdToDownload = latestParticipant.participantId || participantId;

    if (!participantDataToDownload || !participantIdToDownload) {
      return;
    }

    download(JSON.stringify(participantDataToDownload, null, 2), `${baseFilename}_${participantIdToDownload}.json`);
  }, [baseFilename, participantData, participantId, refreshParticipantData]);

  const handleDownloadParticipant = useCallback(() => {
    downloadParticipant();
  }, [downloadParticipant]);

  const retryFinalize = useCallback(() => {
    finalizeLoopRef.current?.retryNow();
  }, []);

  const autoDownload = studyConfig.uiConfig.autoDownloadStudy || false;
  const autoDownloadDelay = autoDownload
    ? studyConfig.uiConfig.autoDownloadTime || -1
    : -1;

  const [delayCounter, setDelayCounter] = useState(
    Math.floor(autoDownloadDelay / 1000),
  );

  useEffect(() => {
    if (completed) {
      const interval = setInterval(() => {
        setDelayCounter((c) => c - 1);
      }, 1000);

      if (delayCounter <= 0) {
        if (autoDownload) {
          downloadParticipant();
        }
        clearInterval(interval);
        return () => clearInterval(interval);
      }

      return () => clearInterval(interval);
    }
    return () => { };
  }, [autoDownload, completed, delayCounter, downloadParticipant]);

  const studyId = useStudyId();
  const [dataCollectionEnabled, setDataCollectionEnabled] = useState(false);
  useEffect(() => {
    const checkDataCollectionEnabled = async () => {
      if (storageEngine) {
        const modes = await storageEngine.getModes(studyId);
        setDataCollectionEnabled(modes.dataCollectionEnabled);
      }
    };
    checkDataCollectionEnabled();
  }, [storageEngine, studyId]);

  const processedStudyEndMsg = useMemo(() => {
    const { studyEndMsg, urlParticipantIdParam } = studyConfig.uiConfig;

    if (!urlParticipantIdParam || !studyEndMsg?.includes('{PARTICIPANT_ID}')) {
      return studyEndMsg;
    }

    // return the study end message with the participant ID
    return studyEndMsg.replace(/\{PARTICIPANT_ID\}/g, () => participantId);
  }, [studyConfig, participantId]);

  useEffect(() => {
    const { studyEndAutoRedirectURL, studyEndAutoRedirectDelay } = studyConfig.uiConfig;

    if (isAnalysis || !completed || !studyEndAutoRedirectURL) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      window.location.replace(studyEndAutoRedirectURL);
    }, studyEndAutoRedirectDelay ?? 10000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [completed, isAnalysis, studyConfig.uiConfig]);

  const {
    error: finalizeError,
    failedAttemptCount,
    isRetryingAutomatically,
    manualRetryRequired,
    retryDelayMs,
  } = finalizeState;
  const showRetryNotice = failedAttemptCount > 0;
  const downloadUnavailable = !participantId || participantData === null || participantData === undefined;
  const automaticRetryDelaySeconds = retryDelayMs ? Math.ceil(retryDelayMs / 1000) : null;
  const automaticRetryLabel = `${failedAttemptCount}/3 retries`;

  return (
    <Center style={{ height: '100%' }}>
      <Flex direction="column">
        {completed || !dataCollectionEnabled
          ? (processedStudyEndMsg
            ? <ReactMarkdownWrapper text={processedStudyEndMsg} />
            : <Text size="xl" display="block">Thank you for completing the study. You may close this window now.</Text>)
          : (
            <>
              <Text size="xl" display="block">
                {manualRetryRequired
                  ? 'We could not confirm your upload after 3 attempts.'
                  : showRetryNotice
                    ? 'We hit an issue while uploading your answers. Retrying automatically...'
                    : 'Please wait while your answers are uploaded.'}
              </Text>
              <Space h="lg" />
              {manualRetryRequired
                ? (
                  <>
                    <Text c="red" maw={560}>
                      {finalizeError || 'The upload confirmation is taking longer than expected.'}
                      {' '}
                      You can try the upload again, or download your participant data and submit it manually to the study designer.
                    </Text>
                    {participantId
                      ? (
                        <>
                          <Space h="sm" />
                          <Text size="sm" c="dimmed">{`Participant ID: ${participantId}`}</Text>
                        </>
                      )
                      : null}
                    <Space h="lg" />
                    <Group>
                      <Button onClick={retryFinalize}>Retry Upload</Button>
                      <Button variant="default" onClick={handleDownloadParticipant} disabled={downloadUnavailable}>
                        Download Participant Data
                      </Button>
                    </Group>
                  </>
                )
                : showRetryNotice
                  ? (
                    <>
                      <Text c={finalizeError ? 'red' : undefined} maw={560}>
                        {finalizeError || 'The upload confirmation is taking longer than expected.'}
                        {' '}
                        {`${automaticRetryLabel}. `}
                        {isRetryingAutomatically && automaticRetryDelaySeconds
                          ? `We will retry automatically in about ${automaticRetryDelaySeconds} seconds.`
                          : 'We will retry automatically.'}
                      </Text>
                      <Space h="lg" />
                      <Center>
                        <Loader color="blue" />
                      </Center>
                    </>
                  )
                  : (
                    <Center>
                      <Loader color="blue" />
                    </Center>
                  )}
            </>
          )}
      </Flex>
    </Center>
  );
}
