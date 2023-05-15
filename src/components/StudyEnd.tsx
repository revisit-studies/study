import { Button, Center, Flex, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCodeDots, IconTable } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useFirebase } from '../storage/init';
import { useAppSelector, useCreatedStore } from '../store';
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

export function StudyEnd() {
  const { trrack } = useCreatedStore();
  const config = useStudyConfig();
  const ids = useAppSelector((s) => s.study.studyIdentifiers);
  const [openTidy, { open, close }] = useDisclosure(true);
  const firebase = useFirebase();

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
    <>
      <Center style={{ height: '100%' }}>
        <Flex direction="column">
          <Center>
            <Text size="xl" display="block">
              {config.uiConfig.studyEndMsg
                ? config.uiConfig.studyEndMsg
                : 'Thank you for completing the study. You may close this window now.'}
            </Text>
          </Center>
          <Center>
            <div>
              <Button
                leftIcon={<IconCodeDots />}
                mt="1em"
                mr="0.5em"
                onClick={() => download(graph, jsonFilename)}
                display="block"
              >
                Download Study
              </Button>
            </div>
            <div>
              <Button
                leftIcon={<IconTable />}
                mt="1em"
                ml="0.5em"
                onClick={open}
                display="block"
              >
                Download Tidy
              </Button>
            </div>
          </Center>
          <Center>
            {autoDownload && (
              <Text size="lg">
                Study results will be downloaded in {delayCounter} seconds. If
                the download does not start automatically, click above to
                download.
              </Text>
            )}
          </Center>
        </Flex>
      </Center>
      <DownloadTidy opened={openTidy} close={close} filename={baseFilename} />
    </>
  );
}
