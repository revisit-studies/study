import {
  Button, Group, Tooltip,
} from '@mantine/core';
import { IconDatabaseExport, IconFileExport, IconTableExport } from '@tabler/icons-react';
import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { DownloadTidy, download } from './DownloadTidy';
import { ParticipantData } from '../../storage/types';

type ParticipantDataFetcher = ParticipantData[] | (() => Promise<ParticipantData[]>);

export function DownloadButtons({
  visibleParticipants, studyId, gap, fileName,
}: { visibleParticipants: ParticipantDataFetcher; studyId: string, gap?: string, fileName?: string | null }) {
  const [openDownload, { open, close }] = useDisclosure(false);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);

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
        <Tooltip label={`${tooltipText} audio`}>
          <Button
            variant="light"
            disabled={visibleParticipants.length === 0 && typeof visibleParticipants !== 'function'}
            // TODO: Implement audio download
            onClick={handleOpenTidy}
            px={4}
          >
            <IconFileExport />
          </Button>
        </Tooltip>
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
