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

type VideoProvider = 'youtube' | 'vimeo' | 'html5';

function getVideoProvider(url: string): VideoProvider {
  if (url.includes('youtube') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('vimeo')) {
    return 'vimeo';
  }
  return 'html5';
}

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
      const plyr = (ref as RefObject<APITypes>).current?.plyr;
      if (!plyr || typeof plyr.on !== 'function' || typeof plyr.off !== 'function') return undefined;

      try {
        // Make registration idempotent across StrictMode mount/unmount cycles.
        plyr.off('ended', endedCallback);
        plyr.on('ended', endedCallback);
      } catch {
        return undefined;
      }

      return () => {
        try {
          plyr.off('ended', endedCallback);
        } catch {
          // Plyr instance can already be disposed during teardown.
        }
      };
    }, [endedCallback, ref, source]);

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
  const provider = useMemo(() => getVideoProvider(url), [url]);
  const validExternalUrl = useMemo(() => {
    if (provider === 'youtube') {
      return isValidYouTubeUrl(url);
    }
    if (provider === 'vimeo') {
      return isValidVimeoUrl(url);
    }
    return true;
  }, [provider, url]);

  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function fetchVideo() {
      setLoading(true);
      try {
        if (provider !== 'html5') {
          if (!isCancelled) {
            setAssetFound(validExternalUrl);
            setLoading(false);
          }
          return;
        }

        const asset = await getStaticAssetByPath(url);
        if (!isCancelled) {
          setAssetFound(!!asset);
          setLoading(false);
        }
      } catch {
        if (!isCancelled) {
          setAssetFound(false);
          setLoading(false);
        }
      }
    }

    fetchVideo();
    return () => {
      isCancelled = true;
    };
  }, [provider, url, validExternalUrl]);

  const sources = useMemo<Plyr.Source[]>(() => {
    if (provider === 'youtube') {
      if (!validExternalUrl) return [];
      return [
        {
          src: url,
          provider: 'youtube',
        },
      ];
    }
    if (provider === 'vimeo') {
      if (!validExternalUrl) return [];
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
  }, [provider, url, validExternalUrl]);
  const playerSource = useMemo<Plyr.SourceInfo>(() => ({ type: 'video', sources }), [sources]);

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
          source={playerSource}
          options={options}
          endedCallback={endedCallback}
        />
      </Box>
    )
    : loading
      ? <LoadingOverlay />
      : <ResourceNotFound path={currentConfig.path} />;
}
