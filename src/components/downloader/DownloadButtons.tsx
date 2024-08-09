import {
  Button, Group, Tooltip,
} from '@mantine/core';
import { IconDatabaseExport, IconTableExport } from '@tabler/icons-react';
import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { DownloadTidy, download } from './DownloadTidy';
import { ParticipantData } from '../../storage/types';

type ParticipantDataFetcher = ParticipantData[] | (() => Promise<ParticipantData[]>);

export function DownloadButtons({
  allParticipants, studyId, gap, fileName,
}: { allParticipants: ParticipantDataFetcher; studyId: string, gap?: string, fileName?: string }) {
  // const [jsonOpened, { close: closeJson, open: openJson }] = useDisclosure(false);
  // const [csvOpened, { close: closeCsv, open: openCsv }] = useDisclosure(false);
  const [openDownload, { open, close }] = useDisclosure(false);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);

  const fetchParticipants = async () => {
    const currParticipants = typeof allParticipants === 'function' ? await allParticipants() : allParticipants;
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

  return (
    <>
      <Group style={{ gap }}>
        {/* <Popover opened={jsonOpened}>
          <Popover.Target> */}
        <Tooltip label="Download all participants data as JSON">
          <Button
            variant="light"
            disabled={allParticipants.length === 0 && typeof allParticipants !== 'function'}
            onClick={handleDownloadJSON}
            // onMouseEnter={openJson}
            // onMouseLeave={closeJson}
            px={4}
          >
            <IconDatabaseExport />
          </Button>
        </Tooltip>
        {/* </Popover.Target>
          <Popover.Dropdown>
            <Text>Download all participants data as JSON</Text>
          </Popover.Dropdown>
        </Popover> */}
        {/* <Popover opened={csvOpened}>
          <Popover.Target> */}
        <Tooltip label="Download all participants data as a tidy CSV">
          <Button
            variant="light"
            disabled={allParticipants.length === 0 && typeof allParticipants !== 'function'}
            onClick={handleOpenTidy}
            // onMouseEnter={openCsv}
            // onMouseLeave={closeCsv}
            px={4}
          >
            <IconTableExport />
          </Button>
        </Tooltip>
        {/* </Popover.Target>
          <Popover.Dropdown>
            <Text>Download all participants data as a tidy CSV</Text>
          </Popover.Dropdown>
        </Popover> */}
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
