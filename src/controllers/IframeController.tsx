import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useCurrentStep } from '../routes';
import { useStoreActions } from '../store';
import { useNextStep } from '../store/hooks/useNextStep';
import { useNavigateWithParams } from '../utils/useNavigateWithParams';
import { useTrialsConfig } from './utils';

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

  const iframeId = useMemo(() => crypto.randomUUID(), []);
  const { trialId = null } = useParams<{ trialId: string }>();

  // navigation
  const currentStep = useCurrentStep();
  const navigate = useNavigateWithParams();
  const computedTo = useNextStep();

  const trialConfig = useTrialsConfig();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (
        typeof data === 'object' &&
        'type' in data &&
        data.type.substring(0, PREFIX.length) === PREFIX &&
        data.iframeId === iframeId &&
        trialId
      ) {
        if (data.type === `${PREFIX}/ANSWERS`) {
          dispatch(
            saveTrialAnswer({
              trialName: currentStep,
              trialId,
              answer: data.message as object,
              type: trialConfig?.type,
            })
          );

          navigate(`/${computedTo}`, { replace: false });
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
  ]);

  return (
    <div>
      <iframe
        src={`/html-stimuli/${path}?id=${iframeId}`}
        style={iframeStyle}
      ></iframe>
    </div>
  );
};

export default IframeController;
