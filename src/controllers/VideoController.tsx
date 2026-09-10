import {
  forwardRef, RefObject, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  APITypes, PlyrOptions, PlyrProps, PlyrSource, usePlyr,
} from 'plyr-react';
import { VideoComponent } from '../parser/types';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { PREFIX } from '../utils/Prefix';
import { ResourceNotFound } from '../ResourceNotFound';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { useAssetStatus, useAssetLoadStatus } from '../store/hooks/useAssetStatus';
import 'plyr-react/plyr.css';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { useCurrentIdentifier } from '../routes/utils';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
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
const CustomPlyrInstance = forwardRef<APITypes, PlyrProps & { endedCallback:() => void; loadedCallback: () => void; errorCallback: () => void; }>(
  (props, ref) => {
    const {
      source, options = null, endedCallback, loadedCallback, errorCallback,
    } = props;
    const raptorRef = usePlyr(ref, { options, source });

    useEffect(() => {
      let animationFrameId: number | undefined;
      let cleanup = () => { };

      const registerPlayerHandlers = () => {
        const plyr = (ref as RefObject<APITypes>).current?.plyr;
        if (!plyr || typeof plyr.on !== 'function' || typeof plyr.off !== 'function') {
          animationFrameId = window.requestAnimationFrame(registerPlayerHandlers);
          return;
        }

        const handleReady = () => {
          // If player is not HTML5, it means it's a third-party provider (like YouTube or Vimeo) which requires checking if the video is ready.
          if (plyr.provider !== 'html5' || (plyr.media as HTMLMediaElement).readyState >= 2) loadedCallback();
        };
        try {
          // Make registration idempotent across StrictMode mount/unmount cycles.
          plyr.off('ended', endedCallback);
          plyr.on('ended', endedCallback);
          plyr.on('loadeddata', loadedCallback);
          plyr.on('ready', handleReady);
          plyr.on('error', errorCallback);
          if (plyr.ready || (plyr.media as HTMLMediaElement).readyState >= 2) handleReady();
          cleanup = () => {
            try {
              plyr.off('ended', endedCallback);
              plyr.off('loadeddata', loadedCallback);
              plyr.off('ready', handleReady);
              plyr.off('error', errorCallback);
            } catch {
              // Plyr instance can already be disposed during teardown.
            }
          };
        } catch {
          cleanup = () => { };
        }
      };

      registerPlayerHandlers();

      return () => {
        if (animationFrameId !== undefined) {
          window.cancelAnimationFrame(animationFrameId);
        }
        cleanup();
      };
    }, [endedCallback, loadedCallback, errorCallback, ref, source]);

    return (
      <video
        ref={raptorRef}
        className="plyr-react plyr"
        // Ensure HTML5 videos still trigger completion even if Plyr event wiring fails.
        onLoadedData={loadedCallback}
        onError={errorCallback}
        onEnded={endedCallback}
      />
    );
  });

export function VideoController({ currentConfig }: { currentConfig: VideoComponent; }) {
  const templateData = useTemplateAnswerContext();
  const templatedPath = useMemo(
    () => (templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined),
    [currentConfig.path, currentConfig.parameters, templateData],
  );

  const url = useMemo(() => {
    if (templatedPath === undefined) return undefined;
    if (templatedPath.startsWith('http')) return templatedPath;
    return `${PREFIX}${templatedPath}`;
  }, [templatedPath]);
  const provider = useMemo(() => (url ? getVideoProvider(url) : undefined), [url]);
  const validExternalUrl = useMemo(() => {
    if (!url) {
      return false;
    }
    if (provider === 'youtube') {
      return isValidYouTubeUrl(url);
    }
    if (provider === 'vimeo') {
      return isValidVimeoUrl(url);
    }
    return true;
  }, [provider, url]);

  const identifier = useCurrentIdentifier();
  const requestKey = url === undefined ? undefined : `${identifier}:${url}`;
  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);
  const [fetchedKey, setFetchedKey] = useState<string>();
  // A new trial/path must not reuse the previous request's result before its effect runs.
  const isLoading = loading || url === undefined || fetchedKey !== requestKey;

  useEffect(() => {
    // While the path is templated inside a dynamic block, url is undefined until the block's
    // current iteration resolves — don't fetch an asset built from the wrong iteration.
    if (url === undefined) return undefined;
    let isCancelled = false;

    async function fetchVideo(assetUrl: string) {
      setLoading(true);
      try {
        if (provider !== 'html5') {
          if (!isCancelled) setAssetFound(validExternalUrl);
          return;
        }
        const asset = await getStaticAssetByPath(assetUrl);
        if (!isCancelled) setAssetFound(!!asset);
      } catch {
        if (!isCancelled) setAssetFound(false);
      } finally {
        if (!isCancelled) {
          setFetchedKey(requestKey);
          setLoading(false);
        }
      }
    }

    fetchVideo(url);
    return () => { isCancelled = true; };
  }, [provider, url, validExternalUrl, requestKey]);

  const { status: playerStatus, onReady: loadedCallback, onError: errorCallback } = useAssetLoadStatus(requestKey);
  const assetStatus = isLoading ? 'loading' : assetFound ? playerStatus : 'error';

  const sources = useMemo<PlyrSource['sources']>(() => {
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
  const playerSource = useMemo<PlyrSource>(() => ({ type: 'video', sources }), [sources]);

  const options = useMemo<PlyrOptions>(() => ({
    controls: [
      currentConfig.forceCompletion !== false ? 'play-large' : 'play',
      'current-time',
      ...(currentConfig.withTimeline ? ['progress'] : []),
      'volume',
      'fullscreen',
    ],
  }), [currentConfig.forceCompletion, currentConfig.withTimeline]);

  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation } = useStoreActions();
  const isAnalysis = useIsAnalysis();
  useAssetStatus(assetStatus);

  // Require playback completion when configured; asset loading and errors are gated separately.
  // Skip analysis mode so replay doesn't mutate stimulus validation.
  useEffect(() => {
    if (isLoading || !assetFound || isAnalysis) return;

    if (currentConfig.forceCompletion) {
      storeDispatch(
        updateResponseBlockValidation({
          location: 'stimulus',
          identifier,
          status: false,
          values: {},
          reason: 'forceCompletion',
          message: 'Please finish the video to continue.',
        }),
      );
    }
  }, [identifier, currentConfig.forceCompletion, storeDispatch, updateResponseBlockValidation, isLoading, assetFound, isAnalysis]);

  // Set the validation to valid if forceCompletion is true and the video is played
  const endedCallback = useCallback(() => {
    if (isAnalysis) return;
    if (currentConfig.forceCompletion) {
      storeDispatch(
        updateResponseBlockValidation({
          location: 'stimulus',
          identifier,
          status: true,
          values: {},
        }),
      );
    }
  }, [identifier, currentConfig.forceCompletion, isAnalysis, storeDispatch, updateResponseBlockValidation]);

  const ref = useRef<APITypes>(null);

  return (!isLoading && assetFound && assetStatus !== 'error' && sources.length > 0)
    ? (
      // Box required for proper react node handling in the component tree
      <Box>
        <CustomPlyrInstance
          key={requestKey}
          ref={ref}
          source={playerSource}
          options={options}
          endedCallback={endedCallback}
          loadedCallback={loadedCallback}
          errorCallback={errorCallback}
        />
      </Box>
    )
    : isLoading
      ? <LoadingOverlay />
      : <ResourceNotFound path={templatedPath} />;
}
