import {
  useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useDispatch } from 'react-redux';
import { useCurrentComponent, useCurrentIdentifier } from '../routes/utils';
import { useStoreDispatch, useStoreActions, useStoreSelector } from '../store/store';
import { ParticipantData, WebsiteComponent } from '../parser/types';
import { useIsAnalysis } from '../store/hooks/useIsAnalysis';
import { ReplayContext } from '../store/hooks/useReplay';
import { compileTemplate } from '../utils/handlebars';
import { useTemplateAnswerContext } from '../store/hooks/useTemplateAnswerContext';
import { getAssetStatus, useAssetStatus, useAssetLoadStatus } from '../store/hooks/useAssetStatus';
import { useAsyncResource } from '../store/hooks/useAsyncResource';
import { getStaticAssetByPath } from '../utils/getStaticAsset';
import { buildIframeSrcDoc, getBaseHref } from '../utils/iframeSrcDoc';
import { PREFIX as BASE_PREFIX } from '../utils/Prefix';
import { ResourceNotFound } from '../ResourceNotFound';

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

  const templateData = useTemplateAnswerContext();
  const templatedPath = useMemo(
    () => (templateData ? compileTemplate(currentConfig.path, currentConfig.parameters ?? {}, { noEscape: true, data: templateData }) : undefined),
    [currentConfig.path, currentConfig.parameters, templateData],
  );

  const isExternal = templatedPath?.startsWith('http') ?? false;
  // External sites can't be fetched and rewritten without their CORS permission, so templating
  // silently doesn't apply to them.
  const isTemplated = (currentConfig.templated ?? false) && !isExternal;

  // The template data changes while a trial is in progress (help counter, saved answers). Markdown
  // re-renders harmlessly, but re-compiling an iframe's srcDoc reloads the page and destroys the
  // participant's in-frame state, so the stimulus is compiled once from a snapshot taken at load.
  const templateDataRef = useRef(templateData);
  useEffect(() => {
    templateDataRef.current = templateData;
  }, [templateData]);

  useEffect(() => {
    if (currentConfig.templated && isExternal) {
      console.warn(`Ignoring "templated" for website component with external path ${templatedPath}. Templating is only supported for websites served from the study's public folder.`);
    }
  }, [currentConfig.templated, isExternal, templatedPath]);

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

  const url = useMemo(() => {
    if (templatedPath === undefined) return undefined;
    return templatedPath.startsWith('http')
      ? templatedPath
      : `${BASE_PREFIX}${templatedPath}?trialid=${currentComponent}&id=${iframeId}`;
  }, [templatedPath, currentComponent, iframeId]);
  // Templated stimuli are fetched without the query string, so the request is cacheable and isn't
  // busted by the per-mount iframe id.
  const fetchUrl = isTemplated && templatedPath !== undefined ? `${BASE_PREFIX}${templatedPath}` : url;
  const requestKey = fetchUrl === undefined ? undefined : `${identifier}:${fetchUrl}:${iframeId}`;
  const loadWebsite = useCallback(async (): Promise<string | true | undefined> => {
    if (fetchUrl === undefined || templatedPath === undefined) return undefined;
    // External iframe responses cannot be inspected without the site's CORS permission.
    if (new URL(fetchUrl, window.location.href).origin !== window.location.origin) return true;
    const text = await getStaticAssetByPath(fetchUrl);
    if (text === undefined) return undefined;
    if (!isTemplated) return true;
    return buildIframeSrcDoc(
      compileTemplate(text, currentConfig.parameters ?? {}, { data: templateDataRef.current }),
      { baseHref: getBaseHref(templatedPath), iframeId, trialId: currentComponent },
    );
  }, [fetchUrl, templatedPath, isTemplated, currentConfig.parameters, iframeId, currentComponent]);
  const { status, value } = useAsyncResource<string | true>(requestKey, loadWebsite);
  const srcDoc = typeof value === 'string' ? value : undefined;
  const { status: frameStatus, onReady, onError } = useAssetLoadStatus(requestKey);
  const assetStatus = getAssetStatus(status, frameStatus);

  useAssetStatus(assetStatus);

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

  // While the path is templated inside a dynamic block, templatedPath is undefined until the
  // block's current iteration resolves — don't load an iframe built from the wrong iteration.
  if (templatedPath === undefined) {
    return null;
  }

  if (assetStatus === 'error') {
    return <ResourceNotFound path={templatedPath} />;
  }

  return (
    <iframe
      key={requestKey}
      ref={ref}
      inert={isAnalysis}
      aria-disabled={isAnalysis}
      style={{
        width: '100%',
        flexGrow: 1,
        border: 0,
        pointerEvents: isAnalysis ? 'none' : undefined,
      }}
      {...(srcDoc !== undefined ? { srcDoc } : { src: url })}
      onLoad={onReady}
      onErrorCapture={onError}
    />
  );
}
