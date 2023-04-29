import { Button, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useAppSelector, useCreatedStore } from '../store';
import { useStudyConfig } from '../store/hooks/useStudyConfig';

function download(graph: unknown, filename: string) {
  const dataStr =
    'data:text/json;charset=utf-8,' +
    encodeURIComponent(JSON.stringify(graph, null, 2));
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

  const autoDownload = config?.uiConfig.autoDownloadStudy || false;
  const autoDownloadDelay = autoDownload
    ? config?.uiConfig.autoDownloadTime || -1
    : -1;

  const [delayCounter, setDelayCounter] = useState(
    Math.floor(autoDownloadDelay / 1000)
  );

  useEffect(() => {
    if (delayCounter <= 0) return;

    const interval = setInterval(() => {
      setDelayCounter((c) => c - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [delayCounter]);

  if (!config || !ids) return null;

  const graph = trrack.graph.backend;
  const filename = `${config['study-metadata'].title.replace(' ', '_')}_${
    ids.pid
  }_${ids.session_id}.json`;

  if (delayCounter === 0) {
    download(graph, filename);
  }

  return (
    <>
      <Text size="xl">Study completed.</Text>
      <Button onClick={() => download(graph, filename)}>Download Study</Button>
      {autoDownload && (
        <Text size="lg">
          Study results will be downloaded in {delayCounter} seconds. If the
          download does not start automatically, click above to download.
        </Text>
      )}
    </>
  );
}
