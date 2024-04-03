import { Button, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCodeDots, IconCodePlus, IconTable } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { DownloadTidy, download } from './DownloadTidy';
import { useStorageEngine } from '../store/storageEngineHooks';
import { StudyConfig } from '../parser/types';
import { ParticipantData } from '../storage/types';

export function DownloadPanel({ studyConfig }: { studyConfig: StudyConfig }) {
  const { storageEngine } = useStorageEngine();
  const [openDownload, { open, close }] = useDisclosure(false);

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
  }, [participantData]);

  const autoDownload = studyConfig.uiConfig.autoDownloadStudy || false;
  const autoDownloadDelay = autoDownload
    ? studyConfig.uiConfig.autoDownloadTime || -1
    : -1;

  const [delayCounter, setDelayCounter] = useState(
    Math.floor(autoDownloadDelay / 1000),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setDelayCounter((c) => c - 1);
    }, 1000);

    if (delayCounter <= 0) {
      downloadParticipant();
      clearInterval(interval);
      return () => clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [delayCounter]);

  return (
    <Stack>
      <Button
        leftIcon={<IconCodeDots />}
        onClick={() => download(JSON.stringify(participantData, null, 2), `${baseFilename}_${participantId}.json`)}
        display="block"
      >
        Download Current (JSON)
      </Button>
      <Button
        disabled={!storageEngine?.isConnected()}
        leftIcon={<IconCodePlus />}
        onClick={async () => {
          if (!storageEngine) return;
          const participants = await storageEngine.getAllParticipantsData();
          download(JSON.stringify(participants, null, 2), `${baseFilename}_all.json`);
        }}
        display="block"
      >
        Download All (JSON)
      </Button>
      <Button
        disabled={!storageEngine?.isConnected()}
        leftIcon={<IconTable />}
        onClick={open}
        display="block"
      >
        Download All (Tidy)
      </Button>
      {autoDownload && (
        <Text size="lg">
          Study results will be downloaded in
          {' '}
          {delayCounter}
          {' '}
          seconds. If the
          download does not start automatically, click above to download.
        </Text>
      )}
      <DownloadTidy
        opened={openDownload}
        close={close}
        filename={`${baseFilename}_${participantId}.csv`}
        studyConfig={studyConfig}
      />
    </Stack>
  );
}
