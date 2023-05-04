import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useCurrentStep } from '../routes';
import { useStoreActions } from '../store';
import { useNextStep } from '../store/hooks/useNextStep';
import { useNavigateWithParams } from '../utils/useNavigateWithParams';
import { useTrialsConfig } from './utils';
import { PREFIX as BASE_PREFIX } from '../App';
import { Stimulus } from '../parser/types';

const PREFIX = '@REVISIT_COMMS';

const defaultStyle = {
  minHeight: '300px',
  width: '100%',
  border: 0,
};

const IframeController = ({ stimulus }: { stimulus: Stimulus }) => {
  const { path, style, parameters } = stimulus;

  const { saveTrialAnswer } = useStoreActions();

  const iframeStyle = { ...defaultStyle, ...style };

  const dispatch = useDispatch();

  const ref = useRef<HTMLIFrameElement>(null);

  const iframeId = useMemo(
    () => (crypto.randomUUID ? crypto.randomUUID() : `testID-${Date.now()}`),
    []
  );

  const { trialId = null } = useParams<{ trialId: string }>();

  // navigation
  const currentStep = useCurrentStep();
  const navigate = useNavigateWithParams();
  const computedTo = useNextStep();

  const trialConfig = useTrialsConfig();

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
      if (typeof data === 'object' && trialId && iframeId === data.iframeId) {
        switch (data.type) {
          case `${PREFIX}/WINDOW_READY`:
            if (parameters) {
              sendMessage('STUDY_DATA', parameters);
            }
            break;
          case `${PREFIX}/READY`:
            if (ref.current) {
              ref.current.style.height = `${data.message.documentHeight}px`;
            }
            break;
          case `${PREFIX}/ANSWERS`:
            dispatch(
              saveTrialAnswer({
                trialName: currentStep,
                trialId,
                answer: JSON.stringify({ [trialId]: data.message }),
                type: trialConfig?.type,
              })
            );
            break;
        }
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, [
    computedTo,
    currentStep,
    dispatch,
    iframeId,
    navigate,
    trialConfig?.type,
    trialId,
    parameters,
    sendMessage,
    saveTrialAnswer,
  ]);

  return (
    <div>
      <iframe
        ref={ref}
        src={`${BASE_PREFIX}html-stimuli/${path}?trialid=${trialId}&id=${iframeId}`}
        style={iframeStyle}
      ></iframe>
    </div>
  );
};

export default IframeController;
