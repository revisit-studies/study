import {
  Button, Group, Tooltip,
} from '@mantine/core';
import {
  IconDatabaseExport, IconDeviceDesktopDown, IconMusicDown, IconTableExport,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { DownloadTidy, download } from './DownloadTidy';
import { ParticipantData } from '../../storage/types';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { downloadParticipantsAudioZip, downloadParticipantsScreenRecordingZip } from '../../utils/handleDownloadAudio';

type ParticipantDataFetcher = ParticipantData[] | (() => Promise<ParticipantData[]>);

export function DownloadButtons({
  visibleParticipants, studyId, gap, fileName, hasAudio, hasScreenRecording,
}: { visibleParticipants: ParticipantDataFetcher; studyId: string, gap?: string, fileName?: string | null; hasAudio?: boolean; hasScreenRecording?: boolean; }) {
  const [openDownload, { open, close }] = useDisclosure(false);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [loadingScreenRecording, setLoadingScreenRecording] = useState(false);
  const { storageEngine } = useStorageEngine();

  const fetchParticipants = async () => {
    const currParticipants = typeof visibleParticipants === 'function' ? await visibleParticipants() : visibleParticipants;
    return currParticipants;
  };

  const handleDownloadJSON = async () => {
    const currParticipants = await fetchParticipants();
    const currFileName = fileName ? `${fileName}.json` : `${studyId}_all.json`;
    download(JSON.stringify(currParticipants, null, 2), currFileName);
  };

  const handleOpenTidy = async () => {
    const currParticipants = await fetchParticipants();
    setParticipants(currParticipants);
    open();
  };

  const handleDownloadAudio = async () => {
    setLoadingAudio(true);

    try {
      const currParticipants = await fetchParticipants();
      if (!storageEngine) return;
      await downloadParticipantsAudioZip({
        storageEngine,
        participants: currParticipants,
        studyId,
        fileName,
      });
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleDownloadScreenRecording = async () => {
    setLoadingScreenRecording(true);

    try {
      const currParticipants = await fetchParticipants();
      if (!storageEngine) return;
      await downloadParticipantsScreenRecordingZip({
        storageEngine,
        participants: currParticipants,
        studyId,
        fileName,
      });
    } finally {
      setLoadingScreenRecording(false);
    }
  };

  const tooltipText = typeof visibleParticipants !== 'function' ? `Download ${visibleParticipants.length} participants` : 'Download participants data';

  return (
    <>
      <Group style={{ gap }}>
        <Tooltip label={`${tooltipText} as JSON`}>
          <Button
            variant="light"
            disabled={visibleParticipants.length === 0 && typeof visibleParticipants !== 'function'}
            onClick={handleDownloadJSON}
            px={4}
          >
            <IconDatabaseExport />
          </Button>
        </Tooltip>
        <Tooltip label={`${tooltipText} as tidy CSV`}>
          <Button
            variant="light"
            disabled={visibleParticipants.length === 0 && typeof visibleParticipants !== 'function'}
            onClick={handleOpenTidy}
            px={4}
          >
            <IconTableExport />
          </Button>
        </Tooltip>
        {hasAudio && (
          <Tooltip label={`${tooltipText} audio & transcripts as ZIP`}>
            <Button
              variant="light"
              disabled={visibleParticipants.length === 0 && typeof visibleParticipants !== 'function'}
              onClick={handleDownloadAudio}
              px={4}
              loading={loadingAudio}
            >
              <IconMusicDown />
            </Button>
          </Tooltip>
        )}

        {hasScreenRecording && (
          <Tooltip label={`${tooltipText} screen recordings ZIP`}>
            <Button
              variant="light"
              disabled={visibleParticipants.length === 0 && typeof visibleParticipants !== 'function'}
              onClick={handleDownloadScreenRecording}
              px={4}
              loading={loadingScreenRecording}
            >
              <IconDeviceDesktopDown />
            </Button>
          </Tooltip>
        )}

      </Group>

      {openDownload && participants.length > 0 && (
        <DownloadTidy
          opened={openDownload}
          close={close}
          filename={fileName ? `${fileName}_tidy.csv` : `${studyId}_all_tidy.csv`}
          data={participants}
          studyId={studyId}
        />
      )}
    </>
  );
}
