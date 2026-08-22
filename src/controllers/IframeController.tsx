import {
  useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { useCurrentComponent, useCurrentIdentifier } from '../routes/utils';
import { useStoreDispatch, useStoreActions, useStoreSelector } from '../store/store';
import { ParticipantData, WebsiteComponent } from '../parser/types';
import { PREFIX as BASE_PREFIX } from '../utils/Prefix';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { ReplayContext } from '../store/hooks/useReplay';
import { compileTemplate } from '../utils/handlebars';

const PREFIX = '@REVISIT_COMMS';

export function IframeController({ currentConfig, provState, answers }: { currentConfig: WebsiteComponent; provState?: unknown, answers: ParticipantData['answers'] }) {
  const {
    setReactiveAnswers, updateProvenance, updateResponseBlockValidation,
  } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const dispatch = useDispatch();
  const identifier = useCurrentIdentifier();
  const isAnalysis = useIsAnalysis();
  const replay = useContext(ReplayContext);
  const initialReplayTime = useRef(replay?.seekTime ?? 0);
  const [hasReplayStarted, setHasReplayStarted] = useState(false);
  const stimulusValidation = useStoreSelector((state) => state.trialValidation[identifier]?.stimulus);

  useEffect(() => {
    if (replay && (replay.isPlaying || replay.seekTime !== initialReplayTime.current)) {
      setHasReplayStarted(true);
    }
  }, [replay]);

  const shouldSendProvenance = !isAnalysis || !replay || hasReplayStarted;

  const templatedPath = useMemo(
    () => compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true }),
    [currentConfig.path, currentConfig.parameters],
  );

  const ref = useRef<HTMLIFrameElement>(null);
  const stimulusValidationRef = useRef(stimulusValidation);

  useEffect(() => {
    stimulusValidationRef.current = stimulusValidation;
  }, [stimulusValidation]);

  const iframeId = useMemo(
    () => (crypto.randomUUID ? crypto.randomUUID() : `testID-${Date.now()}`),
    [],
  );

  // navigation
  const currentComponent = useCurrentComponent();

  const sendMessage = useCallback(
    (tag: string, message: unknown) => {
      ref.current?.contentWindow?.postMessage(
        {
          error: false,
          type: `${PREFIX}/${tag}`,
          iframeId,
          message,
        },
        '*',
      );
    },
    [ref, iframeId],
  );

  useEffect(() => {
    if (provState && shouldSendProvenance) {
      sendMessage('PROVENANCE', provState);
    }
  }, [provState, sendMessage, shouldSendProvenance]);

  useEffect(() => {
    if (answers) {
      sendMessage('ANSWERS', answers);
    }
  }, [answers, sendMessage]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const { data } = e;
      if (typeof data === 'object' && iframeId === data.iframeId) {
        switch (data.type) {
          case `${PREFIX}/WINDOW_READY`:
            if (currentConfig.parameters) {
              sendMessage('STUDY_DATA', currentConfig.parameters);
            }
            if (provState && shouldSendProvenance) {
              sendMessage('PROVENANCE', provState);
            }
            if (answers) {
              sendMessage('ANSWERS', answers);
            }
            break;
          case `${PREFIX}/READY`:
            break;
          case `${PREFIX}/ANSWERS`:
            if (isAnalysis) return;
            stimulusValidationRef.current = {
              valid: true,
              values: data.message,
            };
            storeDispatch(setReactiveAnswers(data.message));
            storeDispatch(updateResponseBlockValidation({
              location: 'stimulus',
              identifier,
              status: true,
              values: data.message,
            }));
            break;
          case `${PREFIX}/PROVENANCE`: {
            if (isAnalysis) return;
            storeDispatch(updateProvenance({
              location: 'stimulus',
              identifier,
              provenanceGraph: data.message,
            }));
            break;
          }
          default:
            break;
        }
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [storeDispatch, dispatch, iframeId, currentConfig, sendMessage, setReactiveAnswers, updateProvenance, updateResponseBlockValidation, identifier, isAnalysis, provState, answers, shouldSendProvenance]);

  return (
    <iframe
      ref={ref}
      inert={isAnalysis}
      aria-disabled={isAnalysis}
      style={{
        width: '100%',
        flexGrow: 1,
        border: 0,
        pointerEvents: isAnalysis ? 'none' : undefined,
      }}
      src={
        templatedPath.startsWith('http')
          ? templatedPath
          : `${BASE_PREFIX}${templatedPath}?trialid=${currentComponent}&id=${iframeId}`
      }
    />
  );
}
