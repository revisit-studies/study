import {
  useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { useComputedColorScheme } from '@mantine/core';
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
import { RestorationError } from '../components/interface/RestorationError';
import { useTrialProvenance } from '../store/hooks/useTrialProvenance';
import { RestorationWarning } from '../components/interface/RestorationWarning';
import { responseValueKeys } from '../utils/responseVisibility';

const PREFIX = '@REVISIT_COMMS';

export function IframeController({ currentConfig, provState, answers }: { currentConfig: WebsiteComponent; provState?: unknown, answers: ParticipantData['answers'] }) {
  const studyColorMode = useComputedColorScheme('light');
  const colorMode = currentConfig.colorMode ?? studyColorMode;
  const {
    setReactiveAnswers, updateProvenance, updateResponseBlockValidation,
  } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const dispatch = useDispatch();
  const identifier = useCurrentIdentifier();
  const isAnalysis = useIsAnalysis();
  const provenance = useTrialProvenance('stimulus');
  const [resumeStatus, setResumeStatus] = useState<'unknown' | 'pending' | 'ready' | 'unsupported' | 'error'>('unknown');
  const resumeStatusRef = useRef(resumeStatus);
  const resumeRequest = useRef<string>('');
  const hostResponseKeys = new Set((currentConfig.response ?? [])
    .filter((response) => response.type !== 'reactive').flatMap(responseValueKeys));
  const replay = useContext(ReplayContext);
  const initialReplayTime = useRef(replay?.seekTime ?? 0);
  const [hasReplayStarted, setHasReplayStarted] = useState(false);
  const stimulusValidation = useStoreSelector((state) => state.trialValidation[identifier]?.stimulus);
  const [restoredAnswers] = useState(() => ({ ...answers[identifier]?.answer, ...stimulusValidation?.values }));
  const hasSavedData = !!provenance || Object.keys(restoredAnswers).some((key) => !hostResponseKeys.has(key));

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
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
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
    if (templatedPath.startsWith('http')) return templatedPath;
    return `${BASE_PREFIX}${templatedPath}?trialid=${currentComponent}&id=${iframeId}`;
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
      {
        baseHref: getBaseHref(templatedPath), documentUrl: new URL(fetchUrl, window.location.href).href, iframeId, trialId: currentComponent,
      },
    );
  }, [fetchUrl, templatedPath, isTemplated, currentConfig.parameters, iframeId, currentComponent]);
  const { status, value } = useAsyncResource<string | true>(requestKey, loadWebsite);
  const srcDoc = typeof value === 'string' ? value : undefined;
  const {
    status: frameStatus, onLoading, onReady, onError,
  } = useAssetLoadStatus(requestKey);
  const assetStatus = getAssetStatus(status, frameStatus);

  const applyColorMode = useCallback(() => {
    // The iframe hint alone does not override an embedded page's own `light dark` choice.
    // contentDocument is null for cross-origin pages; those retain the CSS hint below.
    ref.current?.contentDocument?.documentElement?.style.setProperty('color-scheme', colorMode, 'important');
  }, [colorMode]);

  useLayoutEffect(applyColorMode, [applyColorMode, srcDoc, url]);

  useLayoutEffect(() => {
    if (!frameDocument || frameDocument !== ref.current?.contentDocument) return undefined;
    const frameWindow = frameDocument.defaultView;
    if (!frameWindow) return undefined;
    const events = new frameWindow.AbortController();
    // Internal navigation keeps the iframe URL prop and request key unchanged.
    frameWindow.addEventListener('pagehide', onLoading, { signal: events.signal });
    frameWindow.addEventListener('pageshow', () => {
      applyColorMode();
      onReady();
    }, { signal: events.signal });
    // Abort removes listeners safely even after the frame changes origin.
    return () => events.abort();
  }, [frameDocument, applyColorMode, onLoading, onReady]);

  useAssetStatus(resumeStatus === 'pending' ? 'loading' : resumeStatus === 'error' ? 'error' : assetStatus);

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
      const isBootstrap = data?.type === `${PREFIX}/WINDOW_READY` && data.message?.protocolVersion === 1;
      if (data && typeof data === 'object' && (iframeId === data.iframeId || isBootstrap) && e.source === ref.current?.contentWindow) {
        if (data.requestId && data.requestId !== resumeRequest.current) return;
        switch (data.type) {
          case `${PREFIX}/WINDOW_READY`:
            if (data.message?.protocolVersion === 1) {
              resumeRequest.current = `${iframeId}:${data.message.documentId}`;
              resumeStatusRef.current = 'pending';
              setResumeStatus('pending');
              sendMessage('RESUME', {
                documentId: data.message.documentId,
                protocolVersion: 1,
                requestId: resumeRequest.current,
                isAnalysis,
                answers: restoredAnswers,
                provenanceGraph: isAnalysis ? undefined : provenance,
              });
            }
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
          case `${PREFIX}/RESTORATION_CAPABILITY`:
            if (data.message?.requestId !== resumeRequest.current || data.message?.protocolVersion !== 1) return;
            if (data.message.supported === true) {
              resumeStatusRef.current = 'pending';
              setResumeStatus('pending');
            }
            if (data.message.supported === false) {
              resumeStatusRef.current = 'unsupported';
              setResumeStatus('unsupported');
            }
            break;
          case `${PREFIX}/RESTORED`:
            if (data.message?.requestId !== resumeRequest.current || data.message?.protocolVersion !== 1) return;
            resumeStatusRef.current = 'ready';
            setResumeStatus('ready');
            break;
          case `${PREFIX}/RESTORATION_ERROR`:
            if (data.message?.requestId !== resumeRequest.current) return;
            resumeStatusRef.current = 'error';
            setResumeStatus('error');
            break;
          case `${PREFIX}/READY`:
            break;
          case `${PREFIX}/ANSWERS`:
            if (isAnalysis || resumeStatusRef.current === 'pending' || resumeStatusRef.current === 'error') return;
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
            if (isAnalysis || resumeStatusRef.current === 'pending' || resumeStatusRef.current === 'error') return;
            // Legacy initialization may arrive before an asynchronous restoration handler registers.
            if (provenance && data.message?.root !== provenance.root) return;
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
  }, [storeDispatch, dispatch, iframeId, currentConfig, sendMessage, setReactiveAnswers, updateProvenance, updateResponseBlockValidation, identifier, isAnalysis, provState, answers, shouldSendProvenance, provenance, restoredAnswers]);

  // While the path is templated inside a dynamic block, templatedPath is undefined until the
  // block's current iteration resolves — don't load an iframe built from the wrong iteration.
  if (templatedPath === undefined) {
    return null;
  }

  if (assetStatus === 'error') {
    return <ResourceNotFound path={templatedPath} />;
  }

  if (isTemplated && srcDoc === undefined) {
    return null;
  }

  return (
    <>
      <RestorationWarning component={identifier} website visible={hasSavedData && resumeStatus === 'unsupported'} />
      {resumeStatus === 'error' && (
        <RestorationError onRetry={() => {
          resumeStatusRef.current = 'pending';
          setResumeStatus('pending');
          sendMessage('RETRY_RESTORE', { requestId: resumeRequest.current });
        }}
        />
      )}
      <iframe
        key={requestKey}
        ref={ref}
        inert={isAnalysis || resumeStatus === 'pending' || resumeStatus === 'error'}
        aria-disabled={isAnalysis || resumeStatus === 'pending' || resumeStatus === 'error'}
        style={{
          width: '100%',
          flexGrow: 1,
          border: 0,
          colorScheme: colorMode,
          // Do not expose the document's automatic theme before onLoad applies the study scheme.
          visibility: frameStatus === 'ready' ? undefined : 'hidden',
          // Keep transparent embedded pages readable when their scheme differs from the study.
          backgroundColor: currentConfig.colorMode ? 'Canvas' : undefined,
          pointerEvents: isAnalysis ? 'none' : undefined,
        }}
        {...(srcDoc !== undefined ? { srcDoc } : { src: url })}
        onLoad={() => {
          applyColorMode();
          setFrameDocument(ref.current?.contentDocument ?? null);
          onReady();
        }}
        onErrorCapture={onError}
      />
    </>
  );
}
