import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { PREFIX as BASE_PREFIX } from '../components/GlobalConfigParser';
import { useCurrentStep } from '../routes';
import { useNextStep } from '../store/hooks/useNextStep';
import { useStoreDispatch, useUntrrackedActions } from '../store/store';
import { WebsiteComponent } from '../parser/types';


const PREFIX = '@REVISIT_COMMS';

const defaultStyle = {
  minHeight: '500px',
  width: '100%',
  border: 0,
  marginTop: '-50px'
};

export default function IframeController({ currentConfig }: { currentConfig: WebsiteComponent; }) {
  const unTrrackedActions = useUntrrackedActions();
  const storeDispatch = useStoreDispatch();
  const dispatch = useDispatch();

  const ref = useRef<HTMLIFrameElement>(null);

  const iframeId = useMemo(
    () => (crypto.randomUUID ? crypto.randomUUID() : `testID-${Date.now()}`),
    []
  );


  // navigation
  const currentStep = useCurrentStep();
  const navigate = useNavigate();
  const computedTo = useNextStep();

  const sendMessage = useCallback(
    (tag: string, message: unknown) => {
      ref.current?.contentWindow?.postMessage(
        {
          error: false,
          type: `${PREFIX}/${tag}`,
          iframeId,
          message,
        },
        '*'
      );
    },
    [ref, iframeId]
  );

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
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
            storeDispatch(unTrrackedActions.setIframeAnswers(data.message.answer));
            break;
        }
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [
    storeDispatch,
    computedTo,
    currentStep,
    dispatch,
    iframeId,
    navigate,
    currentConfig,
    sendMessage,
  ]);

  return (
    <div >
      <iframe
        ref={ref}
        src={`${BASE_PREFIX}${currentConfig.path}?trialid=${currentStep}&id=${iframeId}`}
        style={defaultStyle}
      ></iframe>
    </div>
  );
}
