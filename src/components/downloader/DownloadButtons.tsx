import {
  Popover, Button, Text, Group,
} from '@mantine/core';
import { IconDatabaseExport, IconTableExport } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { DownloadTidy, download } from './DownloadTidy';
import { ParticipantData } from '../../storage/types';

export function DownloadButtons({ allParticipants, studyId }: { allParticipants: ParticipantData[]; studyId: string }) {
  const [jsonOpened, { close: closeJson, open: openJson }] = useDisclosure(false);
  const [csvOpened, { close: closeCsv, open: openCsv }] = useDisclosure(false);
  const [openDownload, { open, close }] = useDisclosure(false);

  return (
    <>
      <Group>
        <Popover opened={jsonOpened}>
          <Popover.Target>
            <Button
              variant="light"
              disabled={allParticipants.length === 0}
              onClick={() => {
                download(JSON.stringify(allParticipants, null, 2), `${studyId}_all.json`);
              }}
              onMouseEnter={openJson}
              onMouseLeave={closeJson}
              px={4}
            >
              <IconDatabaseExport />
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Text>Download all participants data as JSON</Text>
          </Popover.Dropdown>
        </Popover>
        <Popover opened={csvOpened}>
          <Popover.Target>
            <Button
              variant="light"
              disabled={allParticipants.length === 0}
              onClick={open}
              onMouseEnter={openCsv}
              onMouseLeave={closeCsv}
              px={4}
            >
              <IconTableExport />
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Text>Download all participants data as a tidy CSV</Text>
          </Popover.Dropdown>
        </Popover>
      </Group>

      {openDownload && (
      <DownloadTidy
        opened={openDownload}
        close={close}
        filename={`${studyId}_all_tidy.csv`}
        data={allParticipants}
        studyId={studyId}
      />
      )}
    </>
  );
}
