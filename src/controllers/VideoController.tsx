import {
  forwardRef, RefObject, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  APITypes, PlyrOptions, PlyrProps, PlyrSource, usePlyr,
} from 'plyr-react';
import { VideoComponent } from '../parser/types';
import { PREFIX } from '../utils/Prefix';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { ResourceNotFound } from '../ResourceNotFound';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import 'plyr-react/plyr.css';
import { useStoreActions, useStoreDispatch } from '../store/store';
import { useCurrentComponent, useCurrentStep } from '../routes/utils';
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
const CustomPlyrInstance = forwardRef<APITypes, PlyrProps & { endedCallback:() => void; }>(
  (props, ref) => {
    const {
      source, options = null, endedCallback,
    } = props;
    const raptorRef = usePlyr(ref, { options, source });

    useEffect(() => {
      let animationFrameId: number | undefined;
      let cleanup = () => { };

      const registerEndedHandler = () => {
        const plyr = (ref as RefObject<APITypes>).current?.plyr;
        if (!plyr || typeof plyr.on !== 'function' || typeof plyr.off !== 'function') {
          animationFrameId = window.requestAnimationFrame(registerEndedHandler);
          return;
        }

        try {
          // Make registration idempotent across StrictMode mount/unmount cycles.
          plyr.off('ended', endedCallback);
          plyr.on('ended', endedCallback);
          cleanup = () => {
            try {
              plyr.off('ended', endedCallback);
            } catch {
              // Plyr instance can already be disposed during teardown.
            }
          };
        } catch {
          cleanup = () => { };
        }
      };

      registerEndedHandler();

      return () => {
        if (animationFrameId !== undefined) {
          window.cancelAnimationFrame(animationFrameId);
        }
        cleanup();
      };
    }, [endedCallback, ref, source]);

    return (
      <video
        ref={raptorRef}
        className="plyr-react plyr"
        // Ensure HTML5 videos still trigger completion even if Plyr event wiring fails.
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
    if (templatedPath === undefined) {
      return undefined;
    }
    if (templatedPath.startsWith('http')) {
      return templatedPath;
    }
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

  const [loading, setLoading] = useState(true);
  const [assetFound, setAssetFound] = useState(false);

  useEffect(() => {
    // While the path is templated inside a dynamic block, url is undefined until the block's
    // current iteration resolves — don't fetch an asset built from the wrong iteration.
    if (url === undefined) {
      return undefined;
    }

    let isCancelled = false;

    async function fetchVideo(assetUrl: string) {
      setLoading(true);
      try {
        if (provider !== 'html5') {
          if (!isCancelled) {
            setAssetFound(validExternalUrl);
            setLoading(false);
          }
          return;
        }

        const asset = await getStaticAssetByPath(assetUrl);
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

    fetchVideo(url);
    return () => {
      isCancelled = true;
    };
  }, [provider, url, validExternalUrl]);

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

  const currentComponent = useCurrentComponent();
  const currentStep = useCurrentStep();
  const storeDispatch = useStoreDispatch();
  const { updateResponseBlockValidation } = useStoreActions();
  const isAnalysis = useIsAnalysis();
  // Set the validation to invalid if forceCompletion is true — unless the
  // asset is missing (404), in which case clear the gate so the participant
  // isn't stuck on a trial that can never complete. Skipped in analysis mode
  // so replay doesn't mutate stimulus validation.
  useEffect(() => {
    if (loading || isAnalysis) return;

    const identifier = `${currentComponent}_${currentStep}`;

    if (!assetFound) {
      console.error(`Video asset at "${templatedPath}" could not be loaded. Clearing stimulus validation so the participant is not stuck.`);
      storeDispatch(
        updateResponseBlockValidation({
          location: 'stimulus',
          identifier,
          status: true,
          values: {},
        }),
      );
      return;
    }

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
  }, [currentComponent, currentConfig.forceCompletion, templatedPath, currentStep, storeDispatch, updateResponseBlockValidation, loading, assetFound, isAnalysis]);

  // Set the validation to valid if forceCompletion is true and the video is played
  const endedCallback = useCallback(() => {
    if (isAnalysis) return;
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
  }, [currentComponent, currentConfig.forceCompletion, currentStep, isAnalysis, storeDispatch, updateResponseBlockValidation]);

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
      : <ResourceNotFound path={templatedPath} />;
}
