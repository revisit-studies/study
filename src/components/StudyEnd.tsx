import {
  Center, Flex, Loader, Space, Text,
} from '@mantine/core';
import {
  useEffect, useState, useCallback, useMemo,
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

export function StudyEnd() {
  const studyConfig = useStudyConfig();
  const { storageEngine } = useStorageEngine();
  const dispatch = useStoreDispatch();
  const { setParticipantCompleted } = useStoreActions();

  const isAnalysis = useIsAnalysis();

  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // Don't save to the storage engine in analysis
    if (isAnalysis) {
      setCompleted(true);
      return;
    }

    // Set completed in the store
    dispatch(setParticipantCompleted(true));

    // verify that storageEngine.verifyCompletion() returns true, loop until it does
    const interval = setInterval(async () => {
      const isComplete = await storageEngine!.verifyCompletion();
      if (isComplete) {
        setCompleted(true);
        clearInterval(interval);
      }
    }, 2000);
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

  return (
    <Center style={{ height: '100%' }}>
      <Flex direction="column">
        {completed || !dataCollectionEnabled
          ? (processedStudyEndMsg
            ? <ReactMarkdownWrapper text={processedStudyEndMsg} />
            : <Text size="xl" display="block">Thank you for completing the study. You may close this window now.</Text>)
          : (
            <>
              <Text size="xl" display="block">Please wait while your answers are uploaded.</Text>
              <Space h="lg" />
              <Center>
                <Loader color="blue" />
              </Center>
            </>
          )}
      </Flex>
    </Center>
  );
}
