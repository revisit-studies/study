import { Button, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCodeDots, IconCodePlus, IconTable } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useStudyId } from '../routes';
import { useFirebase } from '../storage/init';
import { getAllSessionGraphs } from '../storage/queries';
import { useAppSelector, useCreatedStore } from '../store/store';
import { useStudyConfig } from '../store/hooks/useStudyConfig';
import { DownloadTidy } from './DownloadTidy';

export function download(graph: string, filename: string) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(graph);
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', filename);
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function DownloadPanel() {
  const { trrack } = useCreatedStore();
  const config = useStudyConfig();
  const ids = useAppSelector((s) => s.trrackedSlice.studyIdentifiers);
  const studyId = useStudyId();
  const firebase = useFirebase();
  const [openDownload, { open, close }] = useDisclosure(false);

  const autoDownload = config?.uiConfig.autoDownloadStudy || false;
  const autoDownloadDelay = autoDownload
    ? config?.uiConfig.autoDownloadTime || -1
    : -1;

  const [delayCounter, setDelayCounter] = useState(
    Math.floor(autoDownloadDelay / 1000)
  );

  useEffect(() => {
    async function fn() {
      await firebase.completeSession(trrack.root.id);
    }

    fn();
  }, [trrack, firebase]);

  useEffect(() => {
    if (delayCounter <= 0) return;

    const interval = setInterval(() => {
      setDelayCounter((c) => c - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [delayCounter]);

  if (!config || !ids) return null;

  const graph = JSON.parse(trrack.export());

  const baseFilename = `${config.studyMetadata.title.replace(' ', '_')}_${
    ids.session_id
  }`;
  const jsonFilename = `${baseFilename}.json`;

  if (delayCounter === 0) {
    download(JSON.stringify(graph, null, 2), jsonFilename);
  }

  return (
    <Stack>
      <Button
        leftIcon={<IconCodeDots />}
        mt="1em"
        mr="0.5em"
        onClick={() => download(JSON.stringify(graph, null, 2), jsonFilename)}
        display="block"
      >
        Download Current (JSON)
      </Button>
      <Button
        disabled={!firebase.connected}
        leftIcon={<IconCodePlus />}
        mt="1em"
        mr="0.5em"
        onClick={async () => {
          const graphs = await getAllSessionGraphs(firebase.firestore, studyId);

          download(JSON.stringify(graphs, null, 2), jsonFilename);
        }}
        display="block"
      >
        Download All (JSON)
      </Button>
      <Button
        disabled={!firebase.connected}
        leftIcon={<IconTable />}
        mt="1em"
        mr="0.5em"
        onClick={open}
        display="block"
      >
        Download All (Tidy)
      </Button>
      {autoDownload && (
        <Text size="lg">
          Study results will be downloaded in {delayCounter} seconds. If the
          download does not start automatically, click above to download.
        </Text>
      )}
      <DownloadTidy
        opened={openDownload}
        close={close}
        filename={baseFilename}
      />
    </Stack>
  );
}
