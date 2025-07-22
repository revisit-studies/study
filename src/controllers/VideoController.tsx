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
import { Box } from '@mantine/core';

// eslint-disable-next-line react/display-name
const CustomPlyrInstance = forwardRef<APITypes, PlyrProps & { endedCallback:() => void; errorCallback: () => void }>(
  (props, ref) => {
    const {
      source, options = null, endedCallback, errorCallback,
    } = props;
    const raptorRef = usePlyr(ref, { options, source });

    useEffect(() => {
      const { current } = ref as RefObject<APITypes>;
      if (current.plyr.source === null) return;
      current.plyr.on('ended', endedCallback);
      current.plyr.on('error', errorCallback);
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
      return [
        {
          src: url,
          provider: 'youtube',
        },
      ];
    }
    if (url.includes('vimeo')) {
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

  const errorCallback = useCallback(() => {
    setAssetFound(false);
  }, []);

  const ref = useRef<APITypes>(null);

  return loading || assetFound
    ? (
      // Box required for proper react node handling in the component tree
      <Box>
        <CustomPlyrInstance
          ref={ref}
          source={{ type: 'video', sources }}
          options={options}
          endedCallback={endedCallback}
          errorCallback={errorCallback}
        />
      </Box>
    )
    : <ResourceNotFound path={currentConfig.path} />;
}
