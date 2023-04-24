import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { saveTrialAnswer } from '../store';
import { useCurrentStep } from '../routes';
import { useParams } from 'react-router-dom';
import { useNavigateWithParams } from '../utils/useNavigateWithParams';
import { useNextStep } from '../store/hooks/useNextStep';

const PREFIX = '@REVISIT_COMMS';

const defaultStyle = {
  minHeight: '300px',
  width: '100%',
  border: 0,
};

const IframeController = ({
  path,
  style = {},
  type,
}: {
  path?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: { [key: string]: any };
  type: 'trials' | 'practice',
}) => {
  const iframeStyle = { ...defaultStyle, ...style };

  const dispatch = useDispatch();

  const iframeId = useMemo(() => crypto.randomUUID(), []);
  const { trialId = null } = useParams<{ trialId: string }>();

  // navigation
  const currentStep = useCurrentStep();
  const navigate = useNavigateWithParams();
  const computedTo = useNextStep();

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
              type
            })
          );

          navigate(`/${computedTo}`, { replace: false });
        }
      }
    };

    window.addEventListener('message', handler);

    return () => window.removeEventListener('message', handler);
  }, []);

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
