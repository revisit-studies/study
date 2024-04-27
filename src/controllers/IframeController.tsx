import {
  useCallback, useEffect, useMemo, useRef,
} from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useCurrentStep } from '../routes/utils';
import { useStoreDispatch, useStoreActions, useFlatSequence } from '../store/store';
import { WebsiteComponent } from '../parser/types';
import { PREFIX as BASE_PREFIX } from '../utils/Prefix';

const PREFIX = '@REVISIT_COMMS';

const defaultStyle = {
  minHeight: '500px',
  width: '100%',
  border: 0,
  marginTop: '-50px',
};

export default function IframeController({ currentConfig }: { currentConfig: WebsiteComponent; }) {
  const { setIframeAnswers, setIframeProvenance } = useStoreActions();
  const storeDispatch = useStoreDispatch();
  const dispatch = useDispatch();

  const ref = useRef<HTMLIFrameElement>(null);

  const iframeId = useMemo(
    () => (crypto.randomUUID ? crypto.randomUUID() : `testID-${Date.now()}`),
    [],
  );

  // navigation
  const currentStep = useCurrentStep();
  const currentComponent = useFlatSequence()[currentStep];
  const navigate = useNavigate();

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
    const handler = (e: MessageEvent) => {
      const { data } = e;
      if (typeof data === 'object' && iframeId === data.iframeId) {
        switch (data.type) {
          case `${PREFIX}/WINDOW_READY`:
            if (currentConfig.parameters) {
              sendMessage('STUDY_DATA', currentConfig.parameters);
            }
            break;
          case `${PREFIX}/READY`:
            if (ref.current) {
              ref.current.style.height = `${data.message.documentHeight}px`;
            }
            break;
          case `${PREFIX}/ANSWERS`:
            storeDispatch(setIframeAnswers(data.message));
            break;
          case `${PREFIX}/PROVENANCE`:
            storeDispatch(setIframeProvenance(data.message));
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [storeDispatch, currentStep, dispatch, iframeId, navigate, currentConfig, sendMessage, setIframeAnswers, setIframeProvenance]);

  return (
    <div>
      <iframe
        ref={ref}
        src={`${BASE_PREFIX}${currentConfig.path}?trialid=${currentComponent}&id=${iframeId}`}
        style={defaultStyle}
      />
    </div>
  );
}
