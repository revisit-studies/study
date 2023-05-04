import { useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useCurrentStep } from '../routes';
import { useStoreActions } from '../store';
import { useNextStep } from '../store/hooks/useNextStep';
import { useNavigateWithParams } from '../utils/useNavigateWithParams';
import { useTrialsConfig } from './utils';
import { PREFIX as BASE_PREFIX } from '../App';

const PREFIX = '@REVISIT_COMMS';

const defaultStyle = {
  minHeight: '300px',
  width: '100%',
  border: 0,
};

const IframeController = ({
  path,
  style = {},
}: {
  path?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: { [key: string]: any };
}) => {
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

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (typeof data === 'object' && trialId && iframeId === data.iframeId) {
        if (data.type === `${PREFIX}/ANSWERS`) {
          dispatch(
            saveTrialAnswer({
              trialName: currentStep,
              trialId,
              answer: JSON.stringify({ [trialId]: data.message }),
              type: trialConfig?.type,
            })
          );
        } else if (data.type === `${PREFIX}/READY`) {
          if (ref.current) {
            ref.current.style.height = `${data.message.documentHeight}px`;
          }
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
    ref,
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
