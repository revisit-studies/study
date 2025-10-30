import {
  forwardRef, RefObject, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { APITypes, PlyrProps, usePlyr } from 'plyr-react';
import { VideoComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import 'plyr-react/plyr.css';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { useCurrentComponent, useCurrentStep } from '../routes/utils';
// eslint-disable-next-line import/order
import { Box, LoadingOverlay } from '@mantine/core';

function isValidYouTubeUrl(url: string): boolean {
  // Basic check for YouTube video ID in URL
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;
  return youtubeRegex.test(url);
}

function isValidVimeoUrl(url: string): boolean {
  // Basic check for Vimeo video ID in URL
  const vimeoRegex = /^(https?:\/\/)?(www\.)?vimeo\.com\/\d+/;
  return vimeoRegex.test(url);
}

// eslint-disable-next-line react/display-name
const CustomPlyrInstance = forwardRef<APITypes, PlyrProps & { endedCallback:() => void; }>(
  (props, ref) => {
    const {
      source, options = null, endedCallback,
    } = props;
    const raptorRef = usePlyr(ref, { options, source });

    useEffect(() => {
      const { current } = ref as RefObject<APITypes>;
      if (current.plyr.source === null) return;
      current.plyr.on('ended', endedCallback);
    });

    return (
      <video
        ref={raptorRef}
        className="plyr-react plyr"
      />
    );
  });

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
      setLoading(true);
      if (url.includes('youtube')) {
      // Try YouTube oEmbed API
        const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        try {
          const res = await fetch(oEmbedUrl);
          setAssetFound(res.ok);
        } catch {
          setAssetFound(false);
        }
      } else if (url.includes('vimeo')) {
      // Try Vimeo oEmbed API
        const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
        try {
          const res = await fetch(oEmbedUrl);
          setAssetFound(res.ok);
        } catch {
          setAssetFound(false);
        }
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
      if (!isValidYouTubeUrl(url)) {
        setAssetFound(false);
        return [];
      }
      return [
        {
          src: url,
          provider: 'youtube',
        },
      ];
    }
    if (url.includes('vimeo')) {
      if (!isValidVimeoUrl(url)) {
        setAssetFound(false);
        return [];
      }
      return [
        {
          src: url,
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
  }), [currentConfig.forceCompletion, currentConfig.withTimeline]);

  const currentComponent = useCurrentComponent();
  const currentStep = useCurrentStep();
  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation } = useStoreActions();
  // Set the validation to invalid if forceCompletion is true
  useEffect(() => {
    if (currentConfig.forceCompletion) {
      storeDispatch(
        updateResponseBlockValidation({
          location: 'stimulus',
          identifier: `${currentComponent}_${currentStep}`,
          status: false,
          values: {},
        }),
      );
    }
  }, [currentComponent, currentConfig.forceCompletion, currentStep, storeDispatch, updateResponseBlockValidation]);

  // Set the validation to valid if forceCompletion is true and the video is played
  const endedCallback = useCallback(() => {
    if (currentConfig.forceCompletion) {
      storeDispatch(
        updateResponseBlockValidation({
          location: 'stimulus',
          identifier: `${currentComponent}_${currentStep}`,
          status: true,
          values: {},
        }),
      );
    }
  }, [currentComponent, currentConfig.forceCompletion, currentStep, storeDispatch, updateResponseBlockValidation]);

  const ref = useRef<APITypes>(null);

  return (assetFound && sources.length > 0)
    ? (
      // Box required for proper react node handling in the component tree
      <Box>
        <CustomPlyrInstance
          ref={ref}
          source={{ type: 'video', sources }}
          options={options}
          endedCallback={endedCallback}
        />
      </Box>
    )
    : loading
      ? <LoadingOverlay />
      : <ResourceNotFound path={currentConfig.path} />;
}
