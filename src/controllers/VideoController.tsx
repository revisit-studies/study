import { useEffect, useMemo, useState } from 'react';
import { Box } from '@mantine/core';
import Plyr from 'plyr-react';
import { VideoComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import 'plyr-react/plyr.css';

export function VideoController({ currentConfig }: { currentConfig: VideoComponent; }) {
  const url = useMemo(() => {
    if (currentConfig.path.startsWith('http')) {
      return currentConfig.path;
    }
    return `${PREFIX}${currentConfig.path}`;
  }, [currentConfig.path]);

  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);
  useEffect(() => {
    async function fetchVideo() {
      if (url.startsWith('http')) {
        // It is impossible to check whether a video exists on a remote server because of CORS
        // We just assume it exists and if it doesn't, the player will throw an error
        // We use that error callback to set assetFound to false and show not found component
        setAssetFound(true);
      } else {
        const asset = await getStaticAssetByPath(url);
        setAssetFound(!!asset);
      }
      setLoading(false);
    }

    fetchVideo();
  }, [url]);

  const sources = useMemo<Plyr.Source[]>(() => {
    if (url.includes('youtube')) {
      const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

      // Extract video ID from the URL
      const match = url.match(regex);
      const videoId = match ? match[1] : '';
      return [
        {
          src: videoId,
          provider: 'youtube',
        },
      ];
    }
    if (url.includes('vimeo')) {
      const regex = /https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/;
      // Extract video ID from the URL
      const match = url.match(regex);
      const videoId = match ? match[1] : '';
      return [
        {
          src: videoId,
          provider: 'vimeo',
        },
      ];
    }
    return [
      {
        src: url,
        type: 'video/mp4',
      },
    ];
  }, [url]);

  const options = useMemo<Plyr.Options>(() => ({
    controls: [
      currentConfig.forceCompletion !== false ? 'play-large' : 'play',
      'current-time',
      ...(currentConfig.withTimeline ? ['progress'] : []),
      'volume',
      'fullscreen',
    ],
    settings: ['captions', 'quality', 'speed'],
  }), [currentConfig.forceCompletion, currentConfig.withTimeline]);

  return loading || assetFound
    ? (
      <Box>
        <Plyr source={{ type: 'video', sources }} options={options} />
      </Box>
    )
    : <ResourceNotFound path={currentConfig.path} />;
}
