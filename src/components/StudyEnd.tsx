import {
  Center, Flex, Loader, Space, Text,
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
import { getStudyEndFinalizeState } from './StudyEnd.utils';

export function StudyEnd() {
  const studyConfig = useStudyConfig();
  const { storageEngine } = useStorageEngine();
  const dispatch = useStoreDispatch();
  const { setParticipantCompleted } = useStoreActions();

  const isAnalysis = useIsAnalysis();

  const [completed, setCompleted] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const storageEngineRef = useRef(storageEngine);

  useEffect(() => {
    storageEngineRef.current = storageEngine;
  }, [storageEngine]);

  useEffect(() => {
    // Don't save to the storage engine in analysis
    if (!isAnalysis) {
      let cancelled = false;
      let timeoutId: NodeJS.Timeout | null = null;
      const verifyLoop = async () => {
        if (cancelled) {
          return;
        }

        const engine = storageEngineRef.current;
        if (!engine) {
          timeoutId = setTimeout(() => {
            verifyLoop();
          }, 2000);
          return;
        }

        try {
          const result = await engine.finalizeParticipant();

          const nextFinalizeState = getStudyEndFinalizeState(result);
          if (nextFinalizeState.completed) {
            setFinalizeError(null);
            setCompleted(true);
            dispatch(setParticipantCompleted(true));
            return;
          }

          if (!nextFinalizeState.shouldRetry) {
            setFinalizeError(nextFinalizeState.error);
            return;
          }

          setFinalizeError(nextFinalizeState.error);
        } catch (error) {
          console.error('An error occurred while verifying completion', error);
          setFinalizeError('An error occurred while uploading your answers.');
          return;
        }

        if (!cancelled) {
          timeoutId = setTimeout(() => {
            verifyLoop();
          }, 2000);
        }
      };

      verifyLoop();

      return () => {
        cancelled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
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
  useEffect(() => {
    async function fetchParticipantId() {
      if (storageEngine) {
        const _participantId = await storageEngine.getCurrentParticipantId();
        const _participantData = await storageEngine.getParticipantData();

        setParticipantId(_participantId);
        setParticipantData(_participantData);
      }
    }
    fetchParticipantId();
  }, [storageEngine]);
  const downloadParticipant = useCallback(async () => {
    download(JSON.stringify(participantData, null, 2), `${baseFilename}_${participantId}.json`);
  }, [baseFilename, participantData, participantId]);

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
                {finalizeError
                  ? 'We hit an error while uploading your answers.'
                  : 'Please wait while your answers are uploaded.'}
              </Text>
              <Space h="lg" />
              {finalizeError
                ? <Text c="red" maw={520}>{`${finalizeError} Please keep this page open and contact the study administrator if the issue persists.`}</Text>
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
