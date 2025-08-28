import {
  Button, Group, Tooltip,
} from '@mantine/core';
import { IconDatabaseExport, IconFileExport, IconTableExport } from '@tabler/icons-react';
import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import JSZip from 'jszip';
import { DownloadTidy, download } from './DownloadTidy';
import { ParticipantData } from '../../storage/types';
import { useStorageEngine } from '../../storage/storageEngineHooks';
import { downloadParticipantsAudio } from '../../utils/handleDownloadAudio';

type ParticipantDataFetcher = ParticipantData[] | (() => Promise<ParticipantData[]>);

export function DownloadButtons({
  visibleParticipants, studyId, gap, fileName, hasAudio,
}: { visibleParticipants: ParticipantDataFetcher; studyId: string, gap?: string, fileName?: string | null; hasAudio?: boolean }) {
  const [openDownload, { open, close }] = useDisclosure(false);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [loadingAudio, setLoadingAudio] = useState(false);
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

      const namePrefix = fileName || studyId;
      const zip = new JSZip();

      const audioPromises = currParticipants.flatMap((participant) => {
        const entries = Object.values(participant.answers)
          .filter((ans) => ans.endTime > 0)
          .sort((a, b) => a.startTime - b.startTime);

        return entries.map(async (ans) => {
          const identifier = `${ans.componentName}_${ans.trialOrder}`;

          await downloadParticipantsAudio({
            storageEngine,
            participantId: participant.participantId,
            identifier,
            zip,
            namePrefix,
          });
        });
      });

      await Promise.all(audioPromises);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      Object.assign(document.createElement('a'), {
        href: url,
        download: `${namePrefix}_audio.zip`,
      }).click();
      URL.revokeObjectURL(url);
    } finally {
      setLoadingAudio(false);
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
              <IconFileExport />
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
